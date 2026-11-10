import { existsSync, statSync } from 'node:fs'
import {
  type Credit,
  credit,
  fileOf,
  LENDER,
  mates,
  type Post,
  postKey,
  type Site,
  uncredited,
} from '../../core/booru.ts'
import { shelfOf } from '../../core/commons.ts'
import type { Manifest, PaletteEntry } from '../../core/manifest.ts'
import { origins } from '../../pictures/backdrop.ts'
import { fetchBytes, fetchCredits, fetchPost, fetchProfiles, headOf, locate } from '../../pictures/booru-net.ts'
import type { Pick } from '../../pictures/fit.ts'
import { writeAtomic } from '../../store/edits.ts'

interface Known {
  urls: string[]
}

interface Shelf {
  home: string
  manifest: Manifest
  entry: PaletteEntry
  signal: AbortSignal
  credited: () => void
}

export class Kept {
  private readonly answers = new Map<string, Record<string, unknown>>()
  private readonly owners = new Map<string, Map<string, string[]>>()
  private readonly crediting = new Map<number, Promise<void>>()
  private readonly inflight = new Map<string, Promise<number>>()
  private readonly asking = new Map<string, Promise<void>>()

  private readonly home: string
  private readonly manifest: Manifest
  private readonly entry: PaletteEntry
  private readonly signal: AbortSignal
  private readonly credited: () => void

  constructor(shelf: Shelf) {
    this.home = shelf.home
    this.manifest = shelf.manifest
    this.entry = shelf.entry
    this.signal = shelf.signal
    this.credited = shelf.credited
  }

  matesOf(site: Site, owner: string): string[] {
    return this.owners.get(site.key)?.get(owner) ?? []
  }

  async transparent(site: Site, post: Post): Promise<boolean> {
    const known = this.keep<boolean>(site, 'probes.json')
    const cached = known[post.id]

    if (cached !== undefined) {
      return cached
    }

    try {
      const found = await locate(site, post, this.signal)
      const from = fileOf(site, post)
      const alpha = (found === undefined ? await headOf(from.site, from.url, this.signal) : found)?.alpha === true
      known[post.id] = alpha

      return alpha
    } catch {
      return false
    }
  }

  owned(site: Site, id: number, owner: string): void {
    this.keep<string>(site, 'owners.json')[id] = owner
  }

  credit(pick: Pick, signal: AbortSignal): Promise<void> {
    const { site, post } = pick

    if (!uncredited(site, post)) {
      return Promise.resolve()
    }

    const key = postKey(site, post.id)
    let job = this.crediting.get(key)

    if (!job) {
      job = this.credits(pick, signal).finally(() => this.crediting.delete(key))
      this.crediting.set(key, job)
    }

    return job
  }

  links(names: readonly string[]): Record<string, string[]> {
    const known = this.keep<Known>(LENDER, 'profiles.json')

    return Object.fromEntries(
      names.flatMap((name): [string, string[]][] => {
        const urls = known[name]?.urls ?? []

        return urls.length > 0 ? [[name, urls]] : []
      }),
    )
  }

  profile(pick: Pick, signal: AbortSignal): Promise<void> {
    return this.credit(pick, signal).then(() => this.profiles(pick.post.named.artist, signal))
  }

  async mateOwners(site: Site): Promise<Map<string, string[]>> {
    const cached = this.owners.get(site.key)

    if (cached) {
      return cached
    }

    const found = origins(this.home)
    const known = this.keep<string>(site, 'owners.json')

    const works = this.manifest.works
    const shelf = shelfOf(this.entry, works)

    const siblings = this.manifest.palettes.flatMap((sibling) => {
      const origin = found.get(sibling.name)

      return shelfOf(sibling, works) === shelf && sibling.name !== this.entry.name && origin?.site === site.key
        ? [{ name: sibling.name, id: origin.id }]
        : []
    })

    const asked = await Promise.all(
      siblings.map(async (sibling) => {
        const owner = known[sibling.id]

        if (owner !== undefined) {
          return { ...sibling, owner }
        }

        try {
          return { ...sibling, owner: (await fetchPost(site, sibling.id, this.signal))?.owner ?? '' }
        } catch {
          return undefined
        }
      }),
    )

    const byPalette = new Map<string, string>()

    for (const sibling of asked) {
      if (sibling) {
        known[sibling.id] = sibling.owner
        byPalette.set(sibling.name, sibling.owner)
      }
    }

    const owners = mates(byPalette)
    this.owners.set(site.key, owners)

    return owners
  }

  async cached(site: Site, path: string, url: string, progress?: (got: number, size: number) => void): Promise<number> {
    if (existsSync(path)) {
      return statSync(path).size
    }

    const running = this.inflight.get(path)

    if (running) {
      return running
    }

    const job = (async () => {
      const bytes = await fetchBytes(site, url, this.signal, progress)
      writeAtomic(path, bytes)

      return bytes.length
    })()

    this.inflight.set(path, job)

    try {
      return await job
    } finally {
      this.inflight.delete(path)
    }
  }

  private keep<T>(site: Site, name: string): Record<string, T> {
    const at = `${site.key}/${name}`
    let known = this.answers.get(at)

    if (!known) {
      known = Object.create(null) as Record<string, T>
      this.answers.set(at, known)
    }

    return known as Record<string, T>
  }

  private async profiles(names: readonly string[], signal: AbortSignal): Promise<void> {
    const known = this.keep<Known>(LENDER, 'profiles.json')
    const due = names.filter((name) => !this.asking.has(name) && known[name] === undefined)

    if (due.length > 0) {
      const job = fetchProfiles(due, signal)
        .then(
          (found) => {
            for (const name of due) {
              known[name] = { urls: found.get(name) ?? [] }
            }

            this.credited()
          },
          () => {},
        )
        .finally(() => {
          for (const name of due) {
            this.asking.delete(name)
          }
        })

      for (const name of due) {
        this.asking.set(name, job)
      }
    }

    await Promise.all(names.flatMap((name) => this.asking.get(name) ?? []))
  }

  private async credits({ site, post }: Pick, signal: AbortSignal): Promise<void> {
    const known = this.keep<Credit>(site, 'credits.json')
    let found = known[post.id]

    if (!found) {
      try {
        found = await fetchCredits(site, post.id, signal)
      } catch {
        return
      }

      if (!found?.owner) {
        return
      }

      known[post.id] = found
    }

    credit(post, found)
    this.credited()
  }
}
