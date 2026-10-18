import { createHash } from 'node:crypto'
import { existsSync, readFileSync, rmSync, statSync, utimesSync } from 'node:fs'
import { join } from 'node:path'
import type { Hex } from '../core/color.ts'
import { listing, writeAtomic } from '../store/edits.ts'
import { cacheRoot } from '../store/paths.ts'

const LIMIT = 512 * 1024 * 1024
const PRUNED_EVERY = 16
const UNFINISHED = 60 * 60 * 1000
const NAME = /^[0-9a-f]{40}$/

export interface Held {
  stem: string
  fill: string
  peak?: Hex
  tone?: Hex
  figure: Buffer
  picture: Buffer
}

interface Head {
  stem: string
  fill: string
  peak?: Hex
  tone?: Hex
  figure: number
  picture: number
}

let written = 0

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

    return {
      stem: head.stem,
      fill: head.fill,
      ...(head.peak ? { peak: head.peak } : {}),
      ...(head.tone ? { tone: head.tone } : {}),
      figure,
      picture,
    }
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
      ...(held.tone ? { tone: held.tone } : {}),
      figure: held.figure.length,
      picture: held.picture.length,
    } satisfies Head),
  )

  const size = Buffer.alloc(4)
  size.writeUInt32BE(head.length)
  writeAtomic(join(dir(), key), Buffer.concat([size, head, held.figure, held.picture]))

  if (++written % PRUNED_EVERY === 0) {
    prune()
  }
}

export function prune(limit = LIMIT): void {
  const now = Date.now()

  const found = listing(dir()).flatMap((name) => {
    try {
      const { size, mtimeMs } = statSync(join(dir(), name))

      return [{ name, size, at: mtimeMs }]
    } catch {
      return []
    }
  })

  let total = 0

  for (const { name, size, at } of found.sort((a, b) => b.at - a.at)) {
    if (NAME.test(name)) {
      total += size

      if (total > limit) {
        rmSync(join(dir(), name), { force: true })
      }
    } else if (name.includes('.ttheme-') && now - at > UNFINISHED) {
      rmSync(join(dir(), name), { force: true })
    }
  }
}
