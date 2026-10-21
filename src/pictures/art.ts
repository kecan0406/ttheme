import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { reach } from '../store/available.ts'
import { writeAtomic } from '../store/edits.ts'
import { cacheRoot } from '../store/paths.ts'

const BROWSER =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'

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
  return join(cacheRoot(), 'art')
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

  if (existsSync(path)) return { bytes: new Uint8Array(readFileSync(path)), path }

  const url = new URL(ref)

  if (url.host === WIKIA) url.searchParams.set('format', 'original')

  const response = await reach(url.href, TIMEOUT, undefined, {
    'user-agent': BROWSER,
    accept: 'image/png,image/jpeg,image/*;q=0.8',
    referer: refererOf(url),
    'sec-fetch-dest': 'image',
    'sec-fetch-mode': 'no-cors',
    'sec-fetch-site': 'cross-site',
  })

  if (Number(response.headers.get('content-length') ?? 0) > MOST) {
    throw new Error(`${url.host} sent a picture over ${MOST / 1024 / 1024} MB`)
  }

  const bytes = new Uint8Array(await response.arrayBuffer())

  if (bytes.length > MOST) throw new Error(`${url.host} sent a picture over ${MOST / 1024 / 1024} MB`)

  if (!isPicture(bytes)) {
    throw new Error(
      `${url.host} sent a web page, not a picture (a challenge page?) — use the image's own address, or save it and pass the file`,
    )
  }

  writeAtomic(path, bytes)

  return { bytes, path }
}
