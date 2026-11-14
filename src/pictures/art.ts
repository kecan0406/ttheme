import { createHash } from 'node:crypto'
import { lstatSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AGENT } from '../core/booru.ts'
import { bodyWithin, reach } from '../store/available.ts'
import { writeAtomic } from '../store/edits.ts'

const MOST = 32 * 1024 * 1024
const TIMEOUT = 30_000
const WIKIA = 'static.wikia.nocookie.net'

const SIGNATURES: [number[], string][] = [
  [[0x89, 0x50, 0x4e, 0x47], 'png'],
  [[0xff, 0xd8, 0xff], 'jpeg'],
  [[0x52, 0x49, 0x46, 0x46], 'webp'],
  [[0x47, 0x49, 0x46, 0x38], 'gif'],
]

export function artDir(): string {
  const dir = join(tmpdir(), 'ttheme-measure')
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  const held = lstatSync(dir)

  if (
    !held.isDirectory() ||
    (held.mode & 0o022) !== 0 ||
    (process.getuid !== undefined && held.uid !== process.getuid())
  ) {
    throw new Error(`${dir} is not a folder only you can write to — remove it and measure again`)
  }

  return dir
}

export function artKey(ref: string): string {
  return createHash('sha256').update(ref).digest('hex').slice(0, 16)
}

function refererOf(url: URL): string {
  const wiki = url.host === WIKIA ? url.pathname.split('/')[1] : undefined

  return wiki ? `https://${wiki}.fandom.com/` : `${url.origin}/`
}

function isPicture(bytes: Uint8Array): boolean {
  const boxed = String.fromCharCode(...bytes.subarray(4, 12))

  return (
    SIGNATURES.some(([head]) => head.every((b, i) => bytes[i] === b)) ||
    boxed.startsWith('ftypavif') ||
    boxed.startsWith('ftypheic')
  )
}

export async function fetchArt(ref: string): Promise<{ bytes: Uint8Array; path: string }> {
  const path = join(artDir(), artKey(ref))
  const url = new URL(ref)

  if (url.host === WIKIA) url.searchParams.set('format', 'original')

  const response = await reach(url.href, TIMEOUT, undefined, {
    'user-agent': AGENT,
    accept: 'image/png,image/jpeg,image/*;q=0.8',
    referer: refererOf(url),
  })

  const bytes = await bodyWithin(response, MOST, `${url.host} sent a picture over ${MOST / 1024 / 1024} MB`)

  if (!isPicture(bytes)) {
    throw new Error(
      `${url.host} sent a web page, not a picture (a challenge page?) — use the picture's own address, or save it and pass the file`,
    )
  }

  writeAtomic(path, bytes)

  return { bytes, path }
}
