import { type Theme, toTheme } from '@/lib/themes'
import published from '../../dist/manifest.json' with { type: 'json' }
import { parseManifest } from '../../src/available.ts'
import { listed } from '../../src/manifest.ts'

const manifest = parseManifest(JSON.stringify(published))

export const official = manifest.palettes
export const gate = manifest.gate
export const themes: Theme[] = listed(manifest.palettes).map((entry) => toTheme(entry))

export const fallback: Theme = themes.find((theme) => theme.lead) ?? (themes[0] as Theme)
