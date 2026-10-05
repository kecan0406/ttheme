import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { linked } from './ansi.ts'
import {
  backdropTone,
  backgroundsDir,
  type Coloring,
  colorsOf,
  imageKey,
  installBackdrop,
  type Paint,
  type Picture,
  prepared,
  rackOf,
  readStore,
  redrawn,
  showImage,
  tuneOf,
  undrawn,
  writeTune,
} from './backdrop.ts'
import {
  blockSet,
  cacheDir,
  cacheRoot,
  credit,
  exposed,
  fetchBytes,
  fetchCredits,
  fetchLent,
  fetchPost,
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
} from './booru.ts'
import { canRemoveBackground, keepable, removeBackground } from './cutout.ts'
import { writeAtomic } from './edits.ts'
import type { PaletteEntry } from './manifest.ts'
import { colorless } from './osc.ts'
import { aligns as alignsFor, refreshPictures } from './palettes.ts'
import { pending, progress } from './pending.ts'
import { decodeImage, decodePng, type Rgba, transparency } from './png.ts'
import { linkable } from './terminal.ts'
import type { Wired } from './terminals/types.ts'
import type { SharedPicture } from './theme.ts'
import { FG_RESET, MARKS, slotFg } from './tui/style.ts'
import { blurOf, coloringFor } from './wiring.ts'

const TIMEOUT = 90_000

export function heldPictures(configHome: string, name: string): SharedPicture[] | undefined {
  const dir = backgroundsDir(configHome)
  const held = rackOf(configHome, name).flatMap((picture) => {
    const [, site, id] = /^([a-z.]+)_(\d+)$/.exec(picture.key) ?? []
    return site && id && SITES.some((s) => s.key === site) ? [{ site, id: Number(id), ...tuneOf(dir, picture) }] : []
  })
  return held.length > 0 ? held : undefined
}

export function missingPictures(configHome: string, entry: PaletteEntry): SharedPicture[] {
  const have = new Set(readStore(backgroundsDir(configHome)).palettes[entry.name]?.pictures.map((p) => p.key))
  return (entry.pictures ?? []).filter((p) => !have.has(imageKey(p)))
}

export function since(entry: PaletteEntry, before: readonly SharedPicture[] | undefined): PaletteEntry {
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
  const credited = uncredited(site, post)
    ? fetchCredits(site, post.id, signal).then(
        (found) => {
          if (found) {
            credit(post, found)
          }
        },
        () => {},
      )
    : undefined
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
    backdropTone(colors, entry.signatureSlots),
    image,
    {
      site: site.key,
      id: shared.id,
      ext: version.ext,
      bytes,
      from: `${site.name} ${shared.id} ${site.pageUrl(shared.id)}`,
      artist: post.named.artist,
      source: sourcePage(post.source),
      cut,
    },
    { width: 0, height: 0 },
    blurOf(configHome),
    coloringFor(configHome),
  )
  const picture = rackOf(configHome, entry.name).find((p) => p.key === imageKey(shared))
  if (picture) {
    writeTune(backgroundsDir(configHome), picture, shared, aligns, homedir())
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
      line.say(`  ▢ ${label} — ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  line.done()
  for (const entry of got) {
    const first = (entry.pictures ?? []).find((shared) =>
      rackOf(configHome, entry.name).some((picture) => picture.key === imageKey(shared)),
    )
    if (first) {
      showImage(configHome, entry.name, imageKey(first))
    }
  }
  if (got.size > 0) {
    refreshPictures(configHome)
  }
}

function cutAlpha(image: Rgba, cut: Rgba, channel: number): boolean {
  if (cut.width !== image.width || cut.height !== image.height) {
    return false
  }
  for (let i = 0; i < image.width * image.height; i++) {
    image.data[i * 4 + 3] = cut.data[i * 4 + channel] ?? 0
  }
  return true
}

async function cutOut(key: string, source: string): Promise<Rgba | undefined> {
  const [, site, id] = /^(.+)_(\d+)$/.exec(key) ?? []
  const path = join(cacheRoot(), site ?? 'local', 'cut', `${id ?? key}.png`)
  if (!existsSync(path)) {
    if (!canRemoveBackground()) {
      return undefined
    }
    mkdirSync(dirname(path), { recursive: true })
    await removeBackground(source, path, AbortSignal.timeout(TIMEOUT))
  }
  return decodeImage(new Uint8Array(readFileSync(path)), MAX_PIXELS)
}

function wasCut(dir: string, picture: Picture): boolean {
  try {
    return transparency(decodePng(new Uint8Array(readFileSync(join(dir, `${picture.stem}.png`))))) > 0
  } catch {
    return false
  }
}

function originalOf(dir: string, picture: Picture): () => Rgba {
  return () => decodeImage(new Uint8Array(readFileSync(join(dir, picture.original as string))), MAX_PIXELS)
}

function cutOf(dir: string, picture: Picture): () => Rgba | null {
  const decoded = originalOf(dir, picture)
  return () => {
    const image = decoded()
    const cut = decodePng(new Uint8Array(readFileSync(join(dir, picture.cut as string))))
    return cutAlpha(image, cut, 0) ? image : null
  }
}

export async function redrawOne(
  configHome: string,
  name: string,
  key: string,
  paint: Paint,
  blurring: number,
  aligns: boolean,
  home: string,
  coloring?: Coloring,
): Promise<Picture | null> {
  const dir = backgroundsDir(configHome)
  const picture = readStore(dir).palettes[name]?.pictures.find((held) => held.key === key)
  if (!picture?.original) {
    return null
  }
  if (picture.cut) {
    return redrawn(configHome, name, picture, cutOf(dir, picture), paint, blurring, aligns, home, false, coloring)
  }
  if (undrawn(picture)) {
    const image = originalOf(dir, picture)()
    if (transparency(image) === 0 && wasCut(dir, picture)) {
      const cut = await cutOut(key, join(dir, picture.original))
      if (!cut || !cutAlpha(image, cut, 3)) {
        return null
      }
      return redrawn(configHome, name, picture, () => image, paint, blurring, aligns, home, true, coloring)
    }
    return redrawn(configHome, name, picture, () => image, paint, blurring, aligns, home, false, coloring)
  }
  return redrawn(configHome, name, picture, originalOf(dir, picture), paint, blurring, aligns, home, false, coloring)
}

export function prepareOne(
  configHome: string,
  name: string,
  key: string,
  paint: Paint,
  blurring: number,
  coloring: Coloring,
): boolean {
  const dir = backgroundsDir(configHome)
  const picture = readStore(dir).palettes[name]?.pictures.find((held) => held.key === key)
  if (!picture?.original || undrawn(picture)) {
    return false
  }
  const load = picture.cut ? cutOf(dir, picture) : originalOf(dir, picture)
  return prepared(configHome, name, picture, load, paint, blurring, coloring)
}
