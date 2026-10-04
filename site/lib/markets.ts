import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { type ManifestEntry, type Theme, toTheme } from '@/lib/themes'

interface Shown {
  id: string
  repo: string
  add: string
  about: string
  stars: number
  pushedAt: string
  license: string | null
  palettes: ManifestEntry[]
}

export interface Market extends Omit<Shown, 'palettes'> {
  palettes: Theme[]
}

const marketsPath = join(process.cwd(), '..', 'dist', 'markets.json')

export function loadMarkets(): Market[] {
  let markets: Shown[] = []
  try {
    markets = (JSON.parse(readFileSync(marketsPath, 'utf8')) as { markets: Shown[] }).markets
  } catch {
    markets = []
  }
  return markets.map((m) => ({ ...m, palettes: m.palettes.map((entry) => toTheme(entry, m.id)) }))
}
