import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { deflateRawSync } from 'node:zlib'

export function embedded(specifier: string): string {
  const file = createRequire(import.meta.url).resolve(specifier)
  return deflateRawSync(readFileSync(file), { level: 9 }).toString('base64')
}
