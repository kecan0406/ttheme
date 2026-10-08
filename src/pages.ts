import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseCatalog } from './catalog.ts'
import { schemaOne } from './emit/manifest.ts'

const out = process.argv[2] ?? 'pages'
const published = parseCatalog(readFileSync(join(import.meta.dirname, '..', 'dist', 'manifest.json'), 'utf8'))
mkdirSync(out, { recursive: true })
writeFileSync(join(out, 'manifest.json'), `${JSON.stringify(schemaOne(published), null, 2)}\n`)
