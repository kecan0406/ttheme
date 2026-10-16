import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { Coloring } from '../core/backdrop-tone.ts'
import { MAX_PIXELS } from '../core/booru.ts'
import { decodeImage, decodePng, type Rgba, transparency } from '../core/png.ts'
import { cacheRoot } from '../store/paths.ts'
import { backgroundsDir, type Paint, type Picture, prepared, readStore, redrawn, undrawn } from './backdrop.ts'
import { canRemoveBackground, removeBackground } from './cutout.ts'

export const TIMEOUT = 90_000

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

function cutAlpha(image: Rgba, cut: Rgba, channel: number): boolean {
  if (cut.width !== image.width || cut.height !== image.height) {
    return false
  }

  for (let i = 0; i < image.width * image.height; i++) {
    image.data[i * 4 + 3] = cut.data[i * 4 + channel] ?? 0
  }

  return true
}
