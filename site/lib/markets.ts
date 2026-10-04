import { official } from '@/lib/catalog'
import { type Market, toTheme } from '@/lib/themes'
import { showcase } from '../../src/showcase.ts'

const FRESH_MS = 10 * 60 * 1000

let held: { at: number; markets: Market[] } | undefined
let pending: Promise<Market[]> | undefined

async function fetchMarkets(): Promise<Market[]> {
  const shown = await showcase(official, process.env.GITHUB_TOKEN)
  return shown.map((market) => ({
    ...market,
    palettes: market.palettes.map((entry) => toTheme(entry, market.id)),
  }))
}

export async function loadMarkets(): Promise<{ markets: Market[]; fresh: boolean }> {
  if (held && Date.now() - held.at < FRESH_MS) return { markets: held.markets, fresh: true }
  pending ??= fetchMarkets().finally(() => {
    pending = undefined
  })
  try {
    const markets = await pending
    held = { at: Date.now(), markets }
    return { markets, fresh: true }
  } catch (error) {
    process.stderr.write(`site: no markets — ${(error as Error).message}\n`)
    return { markets: held?.markets ?? [], fresh: false }
  }
}
