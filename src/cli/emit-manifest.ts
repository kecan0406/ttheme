import pkg from '../../package.json' with { type: 'json' }
import type { Commons } from '../core/commons.ts'
import { GATE_RULES } from '../core/contrast.ts'
import { type Bundle, paletteEntry } from '../core/manifest.ts'
import type { Theme } from '../core/theme.ts'

export function bundleOf(themes: Theme[]): Bundle {
  if (themes.length === 0) {
    throw new Error('the built-in palettes need at least one palette')
  }

  return {
    version: pkg.version,
    gate: GATE_RULES,
    palettes: themes.map((t) => paletteEntry(t)),
  }
}

export function bundleJson(bundle: Bundle): string {
  return `${JSON.stringify(bundle, null, 2)}\n`
}

export function commonsJson(commons: Commons): string {
  return `${JSON.stringify(commons, null, 2)}\n`
}
