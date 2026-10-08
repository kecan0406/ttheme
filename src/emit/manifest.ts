import { emptyManifest, type Manifest, type PaletteEntry, paletteEntry } from '../manifest.ts'
import type { Theme } from '../theme.ts'
import type { Emitter, Output } from './types.ts'

export function manifest(themes: Theme[]): Manifest {
  const [first] = themes
  if (!first) {
    throw new Error('manifest needs at least one theme')
  }
  return { ...emptyManifest(), palettes: themes.map(paletteEntry) }
}

export interface SchemaOneEntry extends Omit<PaletteEntry, 'catalog'> {
  group: string
}

export function schemaOne(published: Manifest): Omit<Manifest, 'palettes'> & { palettes: SchemaOneEntry[] } {
  return { ...published, palettes: published.palettes.map(({ catalog, ...e }) => ({ ...e, group: catalog ?? '' })) }
}

export const meta: Emitter = {
  id: 'meta',

  emitShared(themes: Theme[]): Output[] {
    return [{ path: 'manifest.json', content: `${JSON.stringify(manifest(themes), null, 2)}\n` }]
  },
}
