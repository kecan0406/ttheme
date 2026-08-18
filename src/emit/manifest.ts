import pkg from '../../package.json' with { type: 'json' }
import type { Theme } from '../theme.ts'
import type { Emitter, Output } from './index.ts'

export interface PaletteEntry {
  name: string
  group: string
  native?: string
  lead?: boolean
  ansiSource: string
  default?: boolean
  background: string
  foreground: string
  cursor: string
  selection: string
  signature: string[]
  ansi: string[]
}

export interface Manifest {
  version: string
  palettes: PaletteEntry[]
}

export function manifest(themes: Theme[]): Manifest {
  return {
    version: pkg.version,
    palettes: themes.map((t) => ({
      name: t.name,
      group: t.group,
      ...(t.native ? { native: t.native } : {}),
      ...(t.lead ? { lead: true } : {}),
      ansiSource: t.ansiSource,
      ...(t.role === 'default' ? { default: true } : {}),
      background: t.background,
      foreground: t.foreground,
      cursor: t.cursor,
      selection: t.selectionBackground,
      signature: t.signature,
      ansi: t.ansi,
    })),
  }
}

export const meta: Emitter = {
  id: 'meta',

  emitShared(themes: Theme[]): Output[] {
    return [{ path: 'manifest.json', content: `${JSON.stringify(manifest(themes), null, 2)}\n` }]
  },
}
