import { Elysia, NotFound } from 'elysia'
import { Home } from '@/components/home'
import { MarketPage } from '@/components/market-page'
import { MarketStore, NoSuchMarket } from '@/components/market-store'
import { Missing } from '@/components/missing'
import { SharePage } from '@/components/share-page'
import { Sheets } from '@/components/sheets'
import { cardPng } from '@/lib/card'
import { gate, themes } from '@/lib/catalog'
import { loadMarkets } from '@/lib/markets'
import { builderOf, readShared, type Shared } from '@/lib/share'
import { seriesOf } from '@/lib/sheet'
import { page } from './document'

const CATALOG = 'public, max-age=0, s-maxage=31536000'
const MARKETS = 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400'
const RETRY = 'public, max-age=0, s-maxage=60'

const STORE = 'One ttheme market: its repository, its palettes and how they measure against the contrast gate'

function shared(code: string): Shared | Error {
  try {
    return readShared(code.replace(/%3a/gi, ':'))
  } catch (error) {
    return error as Error
  }
}

export const site = new Elysia({ name: 'site' })
  .get('/', () =>
    page(
      {
        title: 'ttheme — wear your favorite character',
        description:
          'Character color palettes for Ghostty, iTerm2, WezTerm, kitty, Alacritty, Windows Terminal, Warp and Konsole',
        cache: CATALOG,
      },
      <Home themes={themes} series={seriesOf(themes).length} />,
    ),
  )
  .get('/sheets', () =>
    page(
      {
        title: 'ttheme — sheets',
        description: 'Browse every ttheme palette in a terminal, with its slots and contrast readings',
        cache: CATALOG,
      },
      <Sheets themes={themes} gate={gate} />,
    ),
  )
  .get('/market', async () => {
    const { markets, fresh } = await loadMarkets()
    return page(
      {
        title: 'ttheme — market',
        description: 'Every ttheme palette: the official series and the markets anyone publishes from GitHub',
        cache: fresh ? MARKETS : RETRY,
      },
      <MarketPage themes={themes} markets={markets} gate={gate} />,
    )
  })
  .get('/market/:id', async ({ params }) => {
    const { markets, fresh } = await loadMarkets()
    const market = markets.find((entry) => entry.id === params.id)
    if (!market)
      return page(
        { title: 'ttheme — no such market', description: STORE, status: 404, cache: RETRY },
        <NoSuchMarket id={params.id} />,
      )
    return page(
      { title: `ttheme — ${market.id}`, description: STORE, cache: fresh ? MARKETS : RETRY },
      <MarketStore market={market} gate={gate} />,
    )
  })
  .get('/p/:code', ({ params, request }) => {
    const found = shared(params.code)
    if (found instanceof Error)
      return page(
        {
          title: 'ttheme — broken share link',
          description: 'This share link does not open a palette.',
          status: 404,
          cache: RETRY,
        },
        <Missing title="broken share link" text={`This link does not open a palette — ${found.message}`} />,
      )
    return page(
      {
        title: `ttheme — ${found.theme.name}`,
        description: `${found.theme.name}, a ttheme palette someone shared — see it in a terminal and install it with one command`,
        image: new URL(`${new URL(request.url).pathname}/card.png`, request.url).href,
        cache: CATALOG,
      },
      <SharePage shared={found} builder={builderOf(found, gate)} />,
    )
  })
  .get('/p/:code/card.png', ({ params }) => {
    const found = shared(params.code)
    if (found instanceof Error) return new Response(found.message, { status: 404, headers: { 'cache-control': RETRY } })
    return new Response(cardPng(found.theme), { headers: { 'content-type': 'image/png', 'cache-control': CATALOG } })
  })
  .error('global', NotFound, () =>
    page(
      { title: 'ttheme — no such page', description: 'Nothing lives at this address.', status: 404, cache: RETRY },
      <Missing title="no such page" text="Nothing lives at this address." />,
    ),
  )
  .error('global', ({ error }) => {
    process.stderr.write(`site: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`)
    return page(
      { title: 'ttheme — something went wrong', description: 'Try again in a moment.', status: 500, cache: 'no-store' },
      <Missing title="something went wrong" text="Try again in a moment." />,
    )
  })
