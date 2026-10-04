import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { backdropTone, type Colors, coloringOf, type Picture } from './backdrop.ts'
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

export function drafted(
  picture: Picture,
  image: string,
  colors: Colors,
  signature: readonly string[],
  tints: Tints,
): string {
  if (coloringOf(picture) === 'original') {
    return image
  }
  const tone = backdropTone(colors, [...signature])
  return tone.color === picture.tone ? image : tints.of(image, tone.color)
}

export function pictureOf(pictures: readonly Picture[], image: string): Picture | undefined {
  const file = basename(image)
  return pictures.find((picture) => file.startsWith(`${picture.stem}.`) || file.startsWith(`${picture.stem}@`))
}
