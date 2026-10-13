import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { deflateRawSync } from 'node:zlib'
import subsetFont from 'subset-font'

const require = createRequire(import.meta.url)

const LATIN = Array.from({ length: 0x5f }, (_, at) => String.fromCharCode(0x20 + at)).join('')

const LATIN_ONE = Array.from({ length: 0x60 }, (_, at) => String.fromCharCode(0xa0 + at)).join('')

const CHARACTERS = `${LATIN}${LATIN_ONE}–—•…→❯✓✗`

function pack(bytes: Uint8Array): string {
  return deflateRawSync(bytes, { level: 9 }).toString('base64')
}

export function revision(...files: string[]): string {
  const hash = createHash('sha1')
  for (const file of files) hash.update(readFileSync(new URL(file, import.meta.url)))
  return hash.digest('hex').slice(0, 8)
}

export function wasm(specifier: string): string {
  return pack(readFileSync(require.resolve(specifier)))
}

export async function face(css: string, file: string, wght?: number): Promise<string> {
  const font = readFileSync(join(dirname(require.resolve(css)), 'files', file))
  const axes = wght === undefined ? {} : { variationAxes: { wght } }
  return pack(await subsetFont(font, CHARACTERS, { targetFormat: 'sfnt', ...axes }))
}

export async function local(file: string): Promise<string> {
  const font = readFileSync(new URL(`../app/fonts/${file}`, import.meta.url))
  return pack(await subsetFont(font, CHARACTERS, { targetFormat: 'sfnt' }))
}

function chunkOf(sheet: string, point: number): string {
  for (const [, block] of sheet.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const file = /url\(\.\/files\/([^)]+\.woff2)\)/.exec(block as string)?.[1]
    const ranges = /unicode-range:\s*([^;]+);/.exec(block as string)?.[1]
    for (const range of ranges?.split(',') ?? []) {
      const [from = '', to = from] = range.trim().slice(2).split('-')
      if (file && Number.parseInt(from, 16) <= point && point <= Number.parseInt(to, 16)) return file
    }
  }
  throw new Error(`no chunk of the font holds U+${point.toString(16)}`)
}

export async function symbols(css: string, text: string): Promise<string> {
  const sheet = readFileSync(require.resolve(css), 'utf8')
  const files = new Set([...text].map((char) => chunkOf(sheet, char.codePointAt(0) as number)))
  const [file] = files
  if (files.size !== 1 || !file) throw new Error(`${text} spans ${files.size} chunks of ${css}`)
  const font = readFileSync(join(dirname(require.resolve(css)), 'files', file))
  return pack(await subsetFont(font, text, { targetFormat: 'sfnt' }))
}
