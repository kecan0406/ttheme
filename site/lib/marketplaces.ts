import { type Marketplace, toTheme } from '@/lib/themes'
import snapshot from '@/marketplaces.json' with { type: 'json' }
import type { Shown } from '../../src/store/marketplace-index.ts'

export const marketplaces: Marketplace[] = (snapshot as Shown[]).map((marketplace) => ({
  ...marketplace,
  palettes: marketplace.palettes.map((entry) => toTheme(entry, marketplace.id)),
}))
