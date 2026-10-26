import { type Shelves, toTheme } from '@/lib/theme-entry'
import type { Theme } from '@/lib/themes'
import { leadsOf } from '@/lib/works'
import bundled from '../../dist/builtin.json' with { type: 'json' }
import published from '../../dist/commons.json' with { type: 'json' }
import { parseCommons, worldOrder } from '../../src/core/commons.ts'
import { listed, parseBuiltin } from '../../src/core/manifest.ts'

const bundle = parseBuiltin(JSON.stringify(bundled))

export const commons = parseCommons(JSON.stringify(published))

export const shelves: Shelves = { works: commons.works, commons: new Set(commons.works.map((work) => work.id)) }

export const gate = bundle.gate

export const entries = worldOrder(listed(bundle.palettes), commons.works)

export const themes: Theme[] = entries.map((entry) => toTheme(entry, shelves))

export const fallback = leadsOf(themes)[0] as Theme
