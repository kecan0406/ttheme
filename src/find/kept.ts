import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fetchProfiles } from '../artists.ts'
import { origins } from '../backdrop.ts'
import {
  type Credit,
  cacheDir,
  credit,
  fetchBytes,
  fetchCredits,
  fetchPost,
  fileOf,
  headOf,
  LENDER,
  locate,
  mates,
  type Post,
  postKey,
  SITES,
  type Site,
  uncredited,
} from '../booru.ts'
import { writeAtomic } from '../edits.ts'
import type { Pick } from '../fit.ts'
import type { Manifest, PaletteEntry } from '../manifest.ts'

function readCache<T>(site: Site, name: string): Record<string, T> {
  try {
    return JSON.parse(readFileSync(join(cacheDir(site), name), 'utf8')) as Record<string, T>
  } catch {
    return {}
  }
}

function writeCache(site: Site, name: string, data: Record<string, unknown>): void {
  writeAtomic(join(cacheDir(site), name), `${JSON.stringify(data)}\n`)
}

interface Known {
  at: number
  urls: string[]
}

const FRESH = 7 * 24 * 60 * 60 * 1000

interface Shelf {
  home: string
  catalog: Manifest
  entry: PaletteEntry
  signal: AbortSignal
  credited: () => void
}

export class Kept {
  private readonly caches = new Map<string, Record<string, unknown>>()
  private readonly unsaved = new Set<string>()
  private readonly owners = new Map<string, Map<string, string[]>>()
  private readonly crediting = new Map<number, Promise<void>>()
  private readonly inflight = new Map<string, Promise<number>>()
  private readonly asking = new Map<string, Promise<void>>()

  private readonly home: string
  private readonly catalog: Manifest
  private readonly entry: PaletteEntry
  private readonly signal: AbortSignal
  private readonly credited: () => void

  constructor(shelf: Shelf) {
    this.home = shelf.home
    this.catalog = shelf.catalog
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
      this.unsaved.add(`${site.key}/probes.json`)
      return alpha
    } catch {
      return false
    }
  }

  save(): void {
    for (const at of this.unsaved) {
      const [key, name] = at.split('/') as [string, string]
      const site = SITES.find((s) => s.key === key)
      if (site) {
        writeCache(site, name, this.keep(site, name))
      }
    }
    this.unsaved.clear()
  }

  owned(site: Site, id: number, owner: string): void {
    this.keep<string>(site, 'owners.json')[id] = owner
    this.unsaved.add(`${site.key}/owners.json`)
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
    const siblings = this.catalog.palettes.flatMap((sibling) => {
      const origin = found.get(sibling.name)
      return sibling.group === this.entry.group && sibling.name !== this.entry.name && origin?.site === site.key
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
    this.unsaved.add(`${site.key}/owners.json`)
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
    let known = this.caches.get(at)
    if (!known) {
      known = readCache<T>(site, name)
      this.caches.set(at, known)
    }
    return known as Record<string, T>
  }

  private async profiles(names: readonly string[], signal: AbortSignal): Promise<void> {
    const known = this.keep<Known>(LENDER, 'profiles.json')
    const now = Date.now()
    const due = names.filter((name) => !this.asking.has(name) && now - (known[name]?.at ?? 0) >= FRESH)
    if (due.length > 0) {
      const job = fetchProfiles(due, signal)
        .then(
          (found) => {
            for (const name of due) {
              known[name] = { at: Date.now(), urls: found.get(name) ?? [] }
            }
            this.unsaved.add(`${LENDER.key}/profiles.json`)
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
      this.unsaved.add(`${site.key}/credits.json`)
    }
    credit(post, found)
    this.credited()
  }
}
