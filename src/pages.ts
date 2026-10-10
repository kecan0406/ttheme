import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseManifest, reach } from './available.ts'
import { schemaOne } from './emit/manifest.ts'
import type { PaletteEntry } from './manifest.ts'
import { buildIndex, INDEX_URL, parseIndex } from './marketplace-index.ts'

async function index(official: PaletteEntry[]): Promise<string> {
  try {
    return await buildIndex(official, process.env.GITHUB_TOKEN)
  } catch (error) {
    process.stderr.write(`pages: the marketplace index keeps the published copy — ${(error as Error).message}\n`)
    const text = await (await reach(INDEX_URL)).text()
    parseIndex(text)
    return text
  }
}

const out = process.argv[2] ?? 'pages'
const published = parseManifest(readFileSync(join(import.meta.dirname, '..', 'dist', 'manifest.json'), 'utf8'))
mkdirSync(out, { recursive: true })
writeFileSync(join(out, 'manifest.json'), `${JSON.stringify(schemaOne(published), null, 2)}\n`)
writeFileSync(join(out, 'marketplaces.json'), await index(published.palettes))
