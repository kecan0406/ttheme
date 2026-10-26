import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { reach } from '../store/available.ts'
import { INDEX_URL, parseIndex } from '../store/marketplace-index.ts'
import { buildIndex, repoFacts } from './showcase.ts'

const REPO = 'kecan0406/ttheme'

const STARS_URL = new URL('stars.json', INDEX_URL).href

async function index(): Promise<string> {
  try {
    return await buildIndex(process.env.GITHUB_TOKEN)
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

mkdirSync(out, { recursive: true })

writeFileSync(join(out, 'marketplaces.json'), await index())

const starred = await stars()

if (starred !== null) writeFileSync(join(out, 'stars.json'), starred)
