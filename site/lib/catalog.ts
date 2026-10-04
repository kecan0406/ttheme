import { type Theme, toTheme } from '@/lib/themes'
import manifest from '../../dist/manifest.json' with { type: 'json' }
import { parseCatalog } from '../../src/catalog.ts'
import { listed } from '../../src/manifest.ts'

const catalog = parseCatalog(JSON.stringify(manifest))

export const official = catalog.palettes
export const gate = catalog.gate
export const themes: Theme[] = listed(catalog.palettes).map((entry) => toTheme(entry))
