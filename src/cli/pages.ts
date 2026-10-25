import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { type PaletteEntry, parseManifest } from '../core/manifest.ts'
import { ROOT } from '../root.ts'
import { reach } from '../store/available.ts'
import { INDEX_URL, parseIndex } from '../store/marketplace-index.ts'
import { schemaOne } from './emit-manifest.ts'
import { buildIndex, repoFacts } from './showcase.ts'

const REPO = 'kecan0406/ttheme'

const STARS_URL = new URL('stars.json', INDEX_URL).href

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

async function stars(): Promise<string | null> {
  try {
    const { stars } = await repoFacts(REPO, process.env.GITHUB_TOKEN)

    return `${JSON.stringify({ repo: REPO, stars })}\n`
  } catch (error) {
    process.stderr.write(`pages: stars.json keeps the published copy — ${(error as Error).message}\n`)
  }

  try {
    return await (await reach(STARS_URL)).text()
  } catch (error) {
    process.stderr.write(`pages: no stars.json — ${(error as Error).message}\n`)

    return null
  }
}

const out = process.argv[2] ?? 'pages'
const published = parseManifest(readFileSync(join(ROOT, 'dist', 'manifest.json'), 'utf8'))

mkdirSync(out, { recursive: true })

writeFileSync(join(out, 'manifest.json'), `${JSON.stringify(schemaOne(published), null, 2)}\n`)

writeFileSync(join(out, 'marketplaces.json'), await index(published.palettes))

const starred = await stars()

if (starred !== null) writeFileSync(join(out, 'stars.json'), starred)
