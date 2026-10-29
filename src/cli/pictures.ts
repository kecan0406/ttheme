import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { backdropTone } from '../core/backdrop-tone.ts'
import {
  blockSet,
  credit,
  exposed,
  fileOf,
  LENDER,
  lend,
  MAX_PIXELS,
  rated,
  ratingSet,
  rendition,
  SITES,
  sourcePage,
  uncredited,
} from '../core/booru.ts'
import type { PaletteEntry } from '../core/manifest.ts'
import { decodeImage, transparency } from '../core/png.ts'
import { inert } from '../core/text.ts'
import { MAX_STRENGTH, type SharedPicture } from '../core/theme.ts'
import type { Wired } from '../core/wired.ts'
import {
  backgroundsDir,
  colorsOf,
  DEFAULT_POSITION,
  dropImage,
  imageKey,
  installBackdrop,
  type Picture,
  rackIn,
  rackOf,
  readStore,
  rescaled,
  showImage,
  type Tune,
  tuneOf,
  writeTune,
} from '../pictures/backdrop.ts'
import { cacheDir, fetchBytes, fetchCredits, fetchLent, fetchPost, fetchProfiles } from '../pictures/booru-net.ts'
import { canRemoveBackground, keepable, removeBackground } from '../pictures/cutout.ts'
import { TIMEOUT } from '../pictures/redrawing.ts'
import { writeAtomic } from '../store/edits.ts'
import { blurOf, coloringFor } from '../store/wiring.ts'
import { colorless } from '../terminals/osc.ts'
import { linkable } from '../terminals/terminal.ts'
import { linked } from '../tui/ansi.ts'
import { pending, progress } from '../tui/pending.ts'
import { FG_RESET, MARKS, slotFg } from '../tui/style.ts'
import { aligns as alignsFor, refreshPictures } from './sync.ts'

export function heldPictures(configHome: string, name: string): SharedPicture[] | undefined {
  const dir = backgroundsDir(configHome)

  const held = rackOf(configHome, name).flatMap((picture) => {
    const [, site, id] = /^([a-z.]+)_(\d+)$/.exec(picture.key) ?? []

    return site && id && SITES.some((s) => s.key === site)
      ? [{ site, id: Number(id), ...shareable(picture, tuneOf(dir, picture)) }]
      : []
  })

  return held.length > 0 ? held : undefined
}

function shareable(picture: Picture, { opacity, ...framing }: Tune): Omit<SharedPicture, 'site' | 'id'> {
  const strength =
    opacity === undefined || picture.opacity <= 0
      ? undefined
      : Math.min(MAX_STRENGTH, Math.round((opacity / picture.opacity) * 100) / 100)

  return { ...framing, ...(strength === undefined || strength === 1 ? {} : { strength }) }
}

function framedBy(picture: Picture, { size, position, strength }: SharedPicture): Tune {
  return {
    ...(size === undefined ? {} : { size }),
    ...(position === undefined ? {} : { position }),
    ...(strength === undefined ? {} : { opacity: rescaled(strength, 1, picture.opacity) }),
  }
}

const NUDGE = 0.01

function sameTune(a: Tune, b: Tune, opacity: number): boolean {
  return (
    (a.size ?? 'fill') === (b.size ?? 'fill') &&
    (a.position ?? DEFAULT_POSITION) === (b.position ?? DEFAULT_POSITION) &&
    Math.abs((a.opacity ?? opacity) - (b.opacity ?? opacity)) < NUDGE / 2
  )
}

function sameFraming(a: SharedPicture, b: SharedPicture): boolean {
  return (
    (a.size ?? 'fill') === (b.size ?? 'fill') &&
    (a.position ?? DEFAULT_POSITION) === (b.position ?? DEFAULT_POSITION) &&
    (a.strength ?? 1) === (b.strength ?? 1)
  )
}

interface Followed {
  drop: SharedPicture[]
  reframe: SharedPicture[]
}

export function followed(
  before: readonly SharedPicture[],
  after: readonly SharedPicture[],
  untouched: (was: SharedPicture) => boolean,
): Followed {
  const now = new Map(after.map((picture) => [imageKey(picture), picture]))

  const ours = before.filter(
    (was, at) => before.findIndex((picture) => imageKey(picture) === imageKey(was)) === at && untouched(was),
  )

  return {
    drop: ours.filter((was) => !now.has(imageKey(was))),
    reframe: ours.flatMap((was) => {
      const next = now.get(imageKey(was))

      return next && !sameFraming(next, was) ? [next] : []
    }),
  }
}

function missingPictures(configHome: string, entry: PaletteEntry): SharedPicture[] {
  const have = new Set(rackIn(readStore(backgroundsDir(configHome)), entry.name)?.pictures.map((p) => p.key))

  return (entry.pictures ?? []).filter((p) => !have.has(imageKey(p)))
}

function since(entry: PaletteEntry, before: readonly SharedPicture[] | undefined): PaletteEntry {
  const seen = new Set((before ?? []).map((p) => imageKey(p)))

  return { ...entry, pictures: (entry.pictures ?? []).filter((p) => !seen.has(imageKey(p))) }
}

async function install(
  configHome: string,
  entry: PaletteEntry,
  shared: SharedPicture,
  aligns: boolean,
  signal: AbortSignal,
  step: (stage: string, detail?: string) => void,
): Promise<void> {
  const site = SITES.find((s) => s.key === shared.site)

  if (!site) {
    throw new Error(`no site called ${shared.site}`)
  }

  step('Fetching')
  const post = await fetchPost(site, shared.id, signal)

  if (!post) {
    throw new Error('the post is gone')
  }

  if (site !== LENDER && post.md5) {
    try {
      lend([post], await fetchLent([post.md5], signal))
    } catch {}
  }

  let profiles: Record<string, string[]> = {}

  const credited = (
    uncredited(site, post)
      ? fetchCredits(site, post.id, signal).then(
          (found) => {
            if (found) {
              credit(post, found)
            }
          },
          () => {},
        )
      : Promise.resolve()
  )
    .then(() => (post.named.artist.length > 0 ? fetchProfiles(post.named.artist, signal) : new Map()))
    .then(
      (found) => {
        profiles = Object.fromEntries(found.entries().filter(([, urls]) => urls.length > 0))
      },
      () => {},
    )

  if (
    !rated(site, post, ratingSet(process.env.TTHEME_FIND_RATING)) ||
    exposed(post, blockSet(process.env.TTHEME_FIND_BLOCK)).length > 0
  ) {
    throw new Error('outside your find filters — TTHEME_FIND_RATING and TTHEME_FIND_BLOCK')
  }

  const version = rendition(post)

  if (!version) {
    throw new Error('too large to use')
  }

  const orig = join(cacheDir(site), 'orig', `${shared.id}.${version.ext}`)
  let bytes: Uint8Array

  if (existsSync(orig)) {
    bytes = new Uint8Array(readFileSync(orig))
  } else {
    step('Downloading')
    const from = fileOf(site, post, version)
    bytes = await fetchBytes(from.site, from.url, signal, (got, size) => step('Downloading', progress(got, size)))
    writeAtomic(orig, bytes)
  }

  let image = decodeImage(bytes, MAX_PIXELS)
  let cut = false

  if (transparency(image) === 0 && canRemoveBackground() && process.env.TTHEME_FIND_REMOVE_BG !== 'off') {
    const path = join(cacheDir(site), 'cut', `${shared.id}.png`)

    try {
      if (!existsSync(path)) {
        step('Cutting out')
        mkdirSync(dirname(path), { recursive: true })
        await removeBackground(orig, path, signal)
      }

      const figure = decodeImage(new Uint8Array(readFileSync(path)), MAX_PIXELS)

      if (keepable(transparency(figure))) {
        image = figure
        cut = true
      }
    } catch {}
  }

  await credited
  const colors = colorsOf(entry)
  step('Drawing')
  installBackdrop(
    configHome,
    colors,
    backdropTone(colors),
    image,
    {
      site: site.key,
      id: shared.id,
      ext: version.ext,
      bytes,
      from: `${site.name} ${shared.id} ${site.pageUrl(shared.id)}`,
      artist: post.named.artist,
      profiles,
      source: sourcePage(post.source),
      cut,
    },
    { width: 0, height: 0 },
    blurOf(configHome),
    coloringFor(configHome),
  )
  const picture = rackOf(configHome, entry.name).find((p) => p.key === imageKey(shared))

  if (picture) {
    writeTune(backgroundsDir(configHome), picture, framedBy(picture, shared), aligns, homedir())
  }
}

function postRef(shared: SharedPicture, links: boolean): string {
  const site = SITES.find((s) => s.key === shared.site)
  const ref = `${site?.name ?? shared.site} ${shared.id}`

  if (!site || !links) {
    return ref
  }

  const mark = colorless() ? MARKS.link : `${slotFg(site.ansi)}${MARKS.link}${FG_RESET}`

  return `${mark} ${linked(ref, site.pageUrl(shared.id))}`
}

export async function bringPictures(
  configHome: string,
  entries: PaletteEntry[],
  terminals: readonly Wired[],
): Promise<void> {
  const due = entries.flatMap((entry) => missingPictures(configHome, entry).map((shared) => ({ entry, shared })))

  if (due.length === 0) {
    return
  }

  const aligns = alignsFor(terminals)
  const links = process.stdout.isTTY && linkable(process.env)
  const got = new Set<PaletteEntry>()
  const line = pending()

  for (const [at, { entry, shared }] of due.entries()) {
    const label = `${entry.name} · ${postRef(shared, links)}`
    const count = due.length > 1 ? ` · ${at + 1}/${due.length}` : ''

    const step = (stage: string, detail?: string): void =>
      line.set(`${stage} ${label}${detail ? ` · ${detail}` : ''}${count}`)

    try {
      await install(configHome, entry, shared, aligns, AbortSignal.timeout(TIMEOUT), step)
      line.say(`  ▣ ${label}`)
      got.add(entry)
    } catch (error) {
      line.say(`  ▢ ${label} — ${inert(error instanceof Error ? error.message : String(error))}`)
    }
  }

  line.done()

  for (const entry of got) {
    const held = new Set(rackOf(configHome, entry.name).map((picture) => picture.key))
    const first = (entry.pictures ?? []).find((shared) => held.has(imageKey(shared)))

    if (first) {
      showImage(configHome, entry.name, imageKey(first))
    }
  }

  if (got.size > 0) {
    refreshPictures(configHome)
  }
}

export async function followPictures(
  configHome: string,
  entries: PaletteEntry[],
  before: ReadonlyMap<string, readonly SharedPicture[] | undefined>,
  terminals: readonly Wired[],
): Promise<void> {
  const dir = backgroundsDir(configHome)
  const aligns = alignsFor(terminals)
  let moved = false

  for (const entry of entries) {
    const held = new Map(rackOf(configHome, entry.name).map((picture) => [picture.key, picture]))

    const untouched = (was: SharedPicture): boolean => {
      const picture = held.get(imageKey(was))

      return picture !== undefined && sameTune(tuneOf(dir, picture), framedBy(picture, was), picture.opacity)
    }

    const { drop, reframe } = followed(before.get(entry.name) ?? [], entry.pictures ?? [], untouched)

    for (const was of drop) {
      dropImage(configHome, entry.name, imageKey(was))
    }

    for (const next of reframe) {
      const picture = held.get(imageKey(next))

      try {
        if (picture) {
          writeTune(dir, picture, framedBy(picture, next), aligns, homedir())
        }
      } catch {}
    }

    moved ||= drop.length > 0 || reframe.length > 0
  }

  if (moved) {
    refreshPictures(configHome)
  }

  await bringPictures(
    configHome,
    entries.map((entry) => since(entry, before.get(entry.name))),
    terminals,
  )
}
