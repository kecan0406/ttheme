import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  backdropTone,
  backgroundsDir,
  type Colors,
  imageKey,
  installBackdrop,
  rackOf,
  readStore,
  showImage,
  tuneOf,
  writeTune,
} from './backdrop.ts'
import {
  blockSet,
  cacheDir,
  exposed,
  fetchBytes,
  fetchPost,
  MAX_PIXELS,
  rated,
  ratingSet,
  rendition,
  SITES,
} from './booru.ts'
import { canRemoveBackground, keepable, removeBackground } from './cutout.ts'
import type { PaletteEntry } from './emit/manifest.ts'
import { refreshProfiles } from './palettes.ts'
import { decodeImage, transparency } from './png.ts'
import type { SharedPicture } from './theme.ts'
import { unblocking } from './unblock.ts'

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

export function needsTunnel(pictures: SharedPicture[]): boolean {
  return unblocking() && pictures.some((p) => SITES.find((s) => s.key === p.site)?.tunneled)
}

function colorsOf(entry: PaletteEntry): Colors {
  return {
    name: entry.name,
    background: entry.background,
    foreground: entry.foreground,
    cursor: entry.cursor,
    selection: entry.selection,
    ansi: entry.ansi,
    ...(entry.waived ? { waived: entry.waived } : {}),
  }
}

async function install(
  configHome: string,
  entry: PaletteEntry,
  shared: SharedPicture,
  aligns: boolean,
  signal: AbortSignal,
): Promise<void> {
  const site = SITES.find((s) => s.key === shared.site)
  if (!site) {
    throw new Error(`no site called ${shared.site}`)
  }
  const post = await fetchPost(site, shared.id, signal)
  if (!post) {
    throw new Error('the post is gone')
  }
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
    bytes = await fetchBytes(site, version.file, signal)
    mkdirSync(dirname(orig), { recursive: true })
    writeFileSync(orig, bytes)
  }
  let image = decodeImage(bytes, MAX_PIXELS)
  if (transparency(image) === 0 && canRemoveBackground() && process.env.TTHEME_FIND_REMOVE_BG !== 'off') {
    const cut = join(cacheDir(site), 'cut', `${shared.id}.png`)
    try {
      if (!existsSync(cut)) {
        mkdirSync(dirname(cut), { recursive: true })
        await removeBackground(orig, cut, signal)
      }
      const figure = decodeImage(new Uint8Array(readFileSync(cut)), MAX_PIXELS)
      if (keepable(transparency(figure))) {
        image = figure
      }
    } catch {}
  }
  const colors = colorsOf(entry)
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
    },
    { width: 0, height: 0 },
  )
  const picture = rackOf(configHome, entry.name).find((p) => p.key === imageKey(shared))
  if (picture) {
    writeTune(backgroundsDir(configHome), picture, shared, aligns, homedir())
  }
}

export async function fetchPictures(
  configHome: string,
  entry: PaletteEntry,
  aligns: boolean,
  say: (line: string) => void,
): Promise<number> {
  let got = 0
  for (const shared of missingPictures(configHome, entry)) {
    const label = `${entry.name} · ${SITES.find((s) => s.key === shared.site)?.name ?? shared.site} ${shared.id}`
    try {
      await install(configHome, entry, shared, aligns, AbortSignal.timeout(TIMEOUT))
      say(`  ▣ ${label}`)
      got++
    } catch (error) {
      say(`  ▢ ${label} — ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  const [first] = entry.pictures ?? []
  if (got > 0 && first) {
    showImage(configHome, entry.name, imageKey(first))
  }
  return got
}

export async function bringPictures(
  configHome: string,
  entries: PaletteEntry[],
  terminals: readonly string[],
): Promise<void> {
  let got = 0
  for (const entry of entries) {
    got += await fetchPictures(configHome, entry, !terminals.includes('iterm2'), (line) => console.log(line))
  }
  if (got > 0) {
    refreshProfiles(configHome)
  }
}
