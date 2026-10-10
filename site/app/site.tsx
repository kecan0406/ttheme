import { Elysia, NotFound } from 'elysia'
import { Home } from '@/components/home'
import { MarketplacePage } from '@/components/marketplace-page'
import { MarketplaceStore, NoSuchMarketplace } from '@/components/marketplace-store'
import { Missing } from '@/components/missing'
import { NoSuchPalette, PalettePage } from '@/components/palette-page'
import { SharePage } from '@/components/share-page'
import { Sheets } from '@/components/sheets'
import { cardPng } from '@/lib/card'
import { catalogsOf } from '@/lib/catalogs'
import { creditsOf } from '@/lib/credits'
import { OFFICIAL, OFFICIAL_ABOUT } from '@/lib/gallery'
import { loadMarketplaces } from '@/lib/marketplaces'
import { gate, themes } from '@/lib/official'
import { builderOf, readShared, type Shared } from '@/lib/share'
import type { Marketplace, Theme } from '@/lib/themes'
import { page } from './document'

const CATALOG = 'public, max-age=0, s-maxage=31536000'
const MARKETPLACES = 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400'
const RETRY = 'public, max-age=0, s-maxage=60'
const CREDITS = 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800'

const STORE = 'One ttheme marketplace: its repository, its palettes and how they measure against the contrast gate'

function about(theme: Theme): string {
  return `${theme.name}${theme.catalog ? ` from ${theme.catalog}` : ''}, a ttheme palette — see it in a terminal, copy its colors and install it with one command`
}

function palettePage(theme: Theme, marketplace: Marketplace | null, palettes: Theme[], cache: string): Response {
  return page(
    { title: `ttheme — ${theme.name}`, description: about(theme), cache },
    <PalettePage theme={theme} marketplace={marketplace} palettes={palettes} gate={gate} />,
  )
}

function noMarketplace(id: string): Response {
  return page(
    { title: 'ttheme — no such marketplace', description: STORE, status: 404, cache: RETRY },
    <NoSuchMarketplace id={id} />,
  )
}

function noPalette(id: string, name: string): Response {
  return page(
    { title: 'ttheme — no such palette', description: STORE, status: 404, cache: RETRY },
    <NoSuchPalette id={id} name={name} />,
  )
}

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
          'Character color palettes for Ghostty, iTerm2, WezTerm, kitty, Alacritty, Windows Terminal, Warp, Konsole and Terminal.app',
        cache: CATALOG,
      },
      <Home themes={themes} catalogs={catalogsOf(themes).length} />,
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
  .get('/marketplace', async () => {
    const { marketplaces, fresh } = await loadMarketplaces()
    return page(
      {
        title: 'ttheme — marketplace',
        description: 'Every ttheme palette: the official catalogs and the marketplaces anyone publishes from GitHub',
        cache: fresh ? MARKETPLACES : RETRY,
      },
      <MarketplacePage themes={themes} marketplaces={marketplaces} gate={gate} />,
    )
  })
  .get('/marketplace/:id', async ({ params }) => {
    if (params.id === OFFICIAL)
      return page(
        { title: 'ttheme — official', description: OFFICIAL_ABOUT, cache: CATALOG },
        <MarketplaceStore marketplace={null} palettes={themes} gate={gate} />,
      )
    const { marketplaces, fresh } = await loadMarketplaces()
    const marketplace = marketplaces.find((entry) => entry.id === params.id)
    if (!marketplace) return noMarketplace(params.id)
    return page(
      { title: `ttheme — ${marketplace.id}`, description: STORE, cache: fresh ? MARKETPLACES : RETRY },
      <MarketplaceStore marketplace={marketplace} palettes={marketplace.palettes} gate={gate} />,
    )
  })
  .get('/marketplace/:id/:name', async ({ params }) => {
    if (params.id === OFFICIAL) {
      const theme = themes.find((entry) => entry.name === params.name)
      return theme ? palettePage(theme, null, themes, CATALOG) : noPalette(OFFICIAL, params.name)
    }
    const { marketplaces, fresh } = await loadMarketplaces()
    const marketplace = marketplaces.find((entry) => entry.id === params.id)
    if (!marketplace) return noMarketplace(params.id)
    const theme = marketplace.palettes.find((entry) => entry.name === params.name)
    return theme
      ? palettePage(theme, marketplace, marketplace.palettes, fresh ? MARKETPLACES : RETRY)
      : noPalette(marketplace.id, params.name)
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
    const png = cardPng(found.theme)
    return new Response(png, {
      headers: { 'content-type': 'image/png', 'content-length': String(png.length), 'cache-control': CATALOG },
    })
  })
  .get('/p/:code/credits.json', async ({ params }) => {
    const found = shared(params.code)
    if (found instanceof Error) return new Response(found.message, { status: 404, headers: { 'cache-control': RETRY } })
    const { pictures, complete } = await creditsOf(found)
    return new Response(JSON.stringify(pictures), {
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': complete ? CREDITS : RETRY },
    })
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
