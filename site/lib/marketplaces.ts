import { official } from '@/lib/official'
import { type Marketplace, toTheme } from '@/lib/themes'
import { showcase } from '../../src/showcase.ts'

const FRESH_MS = 10 * 60 * 1000
const RETRY_MS = 60 * 1000

let held: Marketplace[] | undefined
let due = 0
let failed = false
let pending: Promise<Marketplace[]> | undefined

async function fetchMarketplaces(): Promise<Marketplace[]> {
  const shown = await showcase(official, process.env.GITHUB_TOKEN)
  return shown.map((marketplace) => ({
    ...marketplace,
    palettes: marketplace.palettes.map((entry) => toTheme(entry, marketplace.id)),
  }))
}

function refresh(): Promise<Marketplace[]> {
  due = Date.now() + RETRY_MS
  pending ??= fetchMarketplaces()
    .then(
      (marketplaces) => {
        held = marketplaces
        due = Date.now() + FRESH_MS
        failed = false
        return marketplaces
      },
      (error: Error) => {
        failed = true
        process.stderr.write(`site: no marketplaces — ${error.message}\n`)
        throw error
      },
    )
    .finally(() => {
      pending = undefined
    })
  return pending
}

export async function loadMarketplaces(): Promise<{ marketplaces: Marketplace[]; fresh: boolean }> {
  if (held) {
    if (Date.now() >= due) refresh().catch(() => {})
    return { marketplaces: held, fresh: !failed }
  }
  try {
    return { marketplaces: await refresh(), fresh: true }
  } catch {
    return { marketplaces: [], fresh: false }
  }
}
