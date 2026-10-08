import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, rmSync, statSync, utimesSync } from 'node:fs'
import { join } from 'node:path'
import { cacheRoot } from './booru.ts'
import type { Hex } from './color.ts'
import { writeAtomic } from './edits.ts'

const KEPT = 12
const NAME = /^[0-9a-f]{40}$/

interface Held {
  stem: string
  fill: string
  peak?: Hex
  figure: Buffer
  picture: Buffer
}

interface Head {
  stem: string
  fill: string
  peak?: Hex
  figure: number
  picture: number
}

function dir(): string {
  return join(cacheRoot(), 'drawn')
}

export function keyOf(parts: (string | number)[]): string {
  return createHash('sha1').update(JSON.stringify(parts)).digest('hex')
}

export function known(key: string): boolean {
  return existsSync(join(dir(), key))
}

export function recall(key: string): Held | undefined {
  const path = join(dir(), key)
  try {
    const bytes = readFileSync(path)
    const size = bytes.readUInt32BE(0)
    const head = JSON.parse(bytes.toString('utf8', 4, 4 + size)) as Head
    const figure = bytes.subarray(4 + size, 4 + size + head.figure)
    const picture = bytes.subarray(4 + size + head.figure, 4 + size + head.figure + head.picture)
    if (figure.length !== head.figure || picture.length !== head.picture) {
      return undefined
    }
    const now = new Date()
    utimesSync(path, now, now)
    return { stem: head.stem, fill: head.fill, ...(head.peak ? { peak: head.peak } : {}), figure, picture }
  } catch {
    return undefined
  }
}

export function remember(key: string, held: Held): void {
  const head = Buffer.from(
    JSON.stringify({
      stem: held.stem,
      fill: held.fill,
      ...(held.peak ? { peak: held.peak } : {}),
      figure: held.figure.length,
      picture: held.picture.length,
    } satisfies Head),
  )
  const size = Buffer.alloc(4)
  size.writeUInt32BE(head.length)
  writeAtomic(join(dir(), key), Buffer.concat([size, head, held.figure, held.picture]))
  prune()
}

function prune(): void {
  const found = readdirSync(dir())
    .filter((name) => NAME.test(name))
    .flatMap((name) => {
      try {
        return [{ name, at: statSync(join(dir(), name)).mtimeMs }]
      } catch {
        return []
      }
    })
    .sort((a, b) => b.at - a.at)
  for (const { name } of found.slice(KEPT)) {
    rmSync(join(dir(), name), { force: true })
  }
}
