import { official } from '@/lib/official'
import { type Marketplace, toTheme } from '@/lib/themes'
import { showcase } from '../../src/showcase.ts'

const FRESH_MS = 10 * 60 * 1000

let held: { at: number; marketplaces: Marketplace[] } | undefined
let pending: Promise<Marketplace[]> | undefined

async function fetchMarketplaces(): Promise<Marketplace[]> {
  const shown = await showcase(official, process.env.GITHUB_TOKEN)
  return shown.map((marketplace) => ({
    ...marketplace,
    palettes: marketplace.palettes.map((entry) => toTheme(entry, marketplace.id)),
  }))
}

export async function loadMarketplaces(): Promise<{ marketplaces: Marketplace[]; fresh: boolean }> {
  if (held && Date.now() - held.at < FRESH_MS) return { marketplaces: held.marketplaces, fresh: true }
  pending ??= fetchMarketplaces().finally(() => {
    pending = undefined
  })
  try {
    const marketplaces = await pending
    held = { at: Date.now(), marketplaces }
    return { marketplaces, fresh: true }
  } catch (error) {
    process.stderr.write(`site: no marketplaces — ${(error as Error).message}\n`)
    return { marketplaces: held?.marketplaces ?? [], fresh: false }
  }
}
