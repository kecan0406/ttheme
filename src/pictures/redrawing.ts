import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Coloring } from '../core/backdrop-tone.ts'
import { MAX_PIXELS } from '../core/booru.ts'
import { decodeImage, decodePng, type Rgba, transparency } from '../core/png.ts'
import { backgroundsDir, type Paint, type Picture, rackIn, readStore, redrawn, standingOf } from './backdrop.ts'
import { canRemoveBackground, removeBackground } from './cutout.ts'

export const TIMEOUT = 90_000

async function cutOut(source: string): Promise<Rgba | undefined> {
  if (!canRemoveBackground()) {
    return undefined
  }

  const dir = mkdtempSync(join(tmpdir(), 'ttheme-cut-'))

  try {
    const path = join(dir, 'cut.png')
    await removeBackground(source, path, AbortSignal.timeout(TIMEOUT))

    return decodeImage(new Uint8Array(readFileSync(path)), MAX_PIXELS)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
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
  sticker = false,
): Promise<Picture | null> {
  const dir = backgroundsDir(configHome)
  const picture = rackIn(readStore(dir), name)?.pictures.find((held) => held.key === key)

  if (!picture?.original) {
    return null
  }

  const again = (load: () => Rgba | null, cut: boolean) =>
    redrawn(configHome, name, picture, load, paint, blurring, aligns, home, cut, coloring, sticker)

  if (picture.cut) {
    return again(cutOf(dir, picture), false)
  }

  if (standingOf(picture).drawn === 'never') {
    const image = originalOf(dir, picture)()

    if (transparency(image) === 0 && wasCut(dir, picture)) {
      const cut = await cutOut(join(dir, picture.original))

      if (!cut || !cutAlpha(image, cut, 3)) {
        return null
      }

      return again(() => image, true)
    }

    return again(() => image, false)
  }

  return again(originalOf(dir, picture), false)
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
