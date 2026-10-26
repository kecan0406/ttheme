import { existsSync, readFileSync } from 'node:fs'
import { isHex } from '../core/color.ts'
import {
  alphaOf,
  type Canvas,
  decodePng,
  encodeMask,
  encodeRgb,
  encodeRgba,
  flatten,
  lay,
  layMask,
  type Rgba,
  toneOf,
} from '../core/png.ts'
import { dropImage, showImage } from '../pictures/backdrop.ts'
import { find, readAvailable } from '../store/available.ts'
import { rewrite, writeAtomic } from '../store/edits.ts'
import { readInstalled } from '../store/installed.ts'
import { configHome } from '../store/paths.ts'
import { prepareColoring, redrawColoring } from './redraw.ts'
import { refreshPictures } from './sync.ts'

export async function runImage(asked: string, action: string, key?: string): Promise<number> {
  const home = configHome()
  const { name } = find(readAvailable(home).palettes, asked, readInstalled(home).palettes)

  if (action === 'show') {
    if (!key) {
      throw new Error('image show needs the picture to show')
    }

    const { at, of } = showImage(home, name, key)
    refreshPictures(home)
    process.stderr.write(`Background · ${name} ${at}/${of} ${key}\n`)

    return 0
  }

  if (action === 'drop') {
    const { key: gone, left } = dropImage(home, name, key)
    refreshPictures(home)
    process.stderr.write(`Background · ${name} removed ${gone} · ${left} left\n`)

    return 0
  }

  if (action === 'tone' || action === 'original') {
    const drawn = await redrawColoring(home, name, action, key)
    process.stderr.write(`Background · ${name} ${drawn.key} ${action === 'tone' ? 'tinted' : 'in its own colors'}\n`)

    return 0
  }

  if (action === 'prepare') {
    const { key: ready, coloring } = prepareColoring(home, name, key)
    process.stderr.write(
      `Background · ${name} ${ready} ready in ${coloring === 'tone' ? 'its tone' : 'its own colors'}\n`,
    )

    return 0
  }

  if (action === 'tuned') {
    refreshPictures(home)

    return 0
  }

  throw new Error(`unknown image action ${action} — show, drop, original, tone, prepare or tuned`)
}

function geometry(canvas: string, place: string): Canvas {
  const size = /^(\d+)x(\d+)$/.exec(canvas)
  const at = /^(\d+)x(\d+)([+-]\d+)([+-]\d+)$/.exec(place)

  if (!size || !at) {
    throw new Error('a canvas is <width>x<height> and a place <width>x<height>+<x>+<y>')
  }

  const [width, height] = size.slice(1).map(Number) as [number, number]
  const [w, h, x, y] = at.slice(1).map(Number) as [number, number, number, number]

  return { width, height, at: { x, y, w, h } }
}

export function canvasOf(image: Rgba, canvas: string, place: string): Canvas {
  const frame = geometry(canvas, place)
  const k = Math.min(1, image.width / frame.at.w)

  if (k === 1) {
    return frame
  }

  return {
    width: Math.max(1, Math.round(frame.width * k)),
    height: Math.max(1, Math.round(frame.height * k)),
    at: { x: Math.round(frame.at.x * k), y: Math.round(frame.at.y * k), w: image.width, h: image.height },
  }
}

export function runBake(source: string, out: string, canvas: string, place: string): number {
  const bytes = new Uint8Array(readFileSync(source))
  const frame = geometry(canvas, place)
  const image = decodePng(bytes)
  const tone = toneOf(bytes)
  writeAtomic(out, tone ? encodeMask(layMask(alphaOf(image), frame), tone) : encodeRgba(lay(image, frame)))

  return 0
}

export function runFlatten(
  source: string,
  out: string,
  background: string,
  opacity: string,
  canvas?: string,
  place?: string,
  into?: string,
): number {
  const level = Number(opacity)

  if (!isHex(background) || !Number.isFinite(level)) {
    throw new Error('flatten needs a #rrggbb background and an opacity from 0 to 1')
  }

  const image = decodePng(new Uint8Array(readFileSync(source)))
  const frame = canvas ? canvasOf(image, canvas, place ?? '') : undefined
  const bytes = encodeRgb(flatten(image, background, Math.max(0, Math.min(1, level)), frame))

  if (into && existsSync(into)) {
    rewrite(into, out, bytes)
  } else {
    writeAtomic(out, bytes)
  }

  return 0
}
