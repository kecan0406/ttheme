import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { backdropTone, type Colors, coloringOf, originalOpacity, type Picture } from './backdrop.ts'
import type { Hex } from './color.ts'
import { alphaOf, decodePng, encodeMask, retone } from './png.ts'

const HELD = 6

export class Tints {
  private dir: string | undefined
  private readonly made: string[] = []

  of(image: string, tone: Hex): string {
    this.dir ??= mkdtempSync(join(tmpdir(), 'ttheme-tint-'))
    const out = join(this.dir, `${basename(image, '.png')}.${tone.slice(1).toLowerCase()}.png`)
    if (!existsSync(out)) {
      const bytes = new Uint8Array(readFileSync(image))
      writeFileSync(out, retone(bytes, tone) ?? encodeMask(alphaOf(decodePng(bytes)), tone))
      this.made.push(out)
      while (this.made.length > HELD) {
        rmSync(this.made.shift() as string, { force: true })
      }
    }
    return out
  }

  clear(): void {
    if (this.dir) {
      rmSync(this.dir, { recursive: true, force: true })
    }
    this.dir = undefined
    this.made.length = 0
  }
}

export interface Draft {
  image: string
  opacity: number
}

export function drafted(
  picture: Picture,
  image: string,
  colors: Colors,
  signature: readonly string[],
  tints: Tints,
): Draft {
  if (coloringOf(picture) === 'original') {
    return { image, opacity: picture.peak ? originalOpacity(colors, picture.peak) : picture.opacity }
  }
  const tone = backdropTone(colors, [...signature])
  return { image: tone.color === picture.tone ? image : tints.of(image, tone.color), opacity: tone.opacity }
}

export function pictureOf(pictures: readonly Picture[], image: string): Picture | undefined {
  const file = basename(image)
  return pictures.find((picture) => file.startsWith(`${picture.stem}.`) || file.startsWith(`${picture.stem}@`))
}
