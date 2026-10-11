import { Elysia, NotFound } from 'elysia'
import { Home } from '@/components/home'
import { NoSuchMarketplace, NoSuchPalette } from '@/components/marketplace-frame'
import { MarketplacePage } from '@/components/marketplace-page'
import { Missing } from '@/components/missing'
import { SharePage } from '@/components/share-page'
import { Sheets } from '@/components/sheets'
import { MarketplaceWorkspace } from '@/components/workspace'
import { cardPng, touchIconPng } from '@/lib/card'
import { catalogsOf } from '@/lib/catalogs'
import { creditsOf } from '@/lib/credits'
import type { Facts } from '@/lib/facts'
import { marketplacePath, OFFICIAL, OFFICIAL_ABOUT, palettePath } from '@/lib/gallery'
import { marketplaces } from '@/lib/marketplaces'
import { fallback, gate, themes } from '@/lib/official'
import { builderOf, readShared, type Shared } from '@/lib/share'
import { sheetNumber, sheetVars } from '@/lib/sheet'
import { sheetScript } from '@/lib/sheet-script'
import type { Marketplace, Theme } from '@/lib/themes'
import { leadOf } from '@/lib/workspace'
import pkg from '../../package.json' with { type: 'json' }
import { page } from './document'

const facts: Facts = { palettes: themes.length, catalogs: catalogsOf(themes).length, version: pkg.version }

const CATALOG = 'public, max-age=0, s-maxage=31536000'
const RETRY = 'public, max-age=0, s-maxage=60'
const CREDITS = 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800'

const STORE = 'One ttheme marketplace: its repository, its palettes and how they measure against the contrast gate'

function cardOf(theme: Theme): { image: string; imageAlt: string } {
  return { image: `${palettePath(theme)}/card.png`, imageAlt: `${theme.name}'s signature and sixteen ANSI colors` }
}

const CARD = { image: '/card.png', imageAlt: `${fallback.name}'s signature and sixteen ANSI colors` }

function png(bytes: Buffer): Response {
  return new Response(bytes, {
    headers: { 'content-type': 'image/png', 'content-length': String(bytes.length), 'cache-control': CATALOG },
  })
}

function about(theme: Theme): string {
  return `${theme.name}${theme.catalog ? ` from ${theme.catalog}` : ''}, a ttheme palette — see it in a terminal, copy its colors and install it with one command`
}

export const PRERENDERED: string[] = [
  '/',
  '/sheets',
  '/marketplace',
  marketplacePath(null),
  ...themes.map(palettePath),
  ...marketplaces.flatMap((marketplace) => [marketplacePath(marketplace.id), ...marketplace.palettes.map(palettePath)]),
]

function workspace(marketplace: Marketplace | null, palettes: Theme[], theme: Theme | null): Response {
  const shown = theme ?? leadOf(catalogsOf(palettes)[0]?.themes ?? palettes)
  const head = theme
    ? { title: `ttheme — ${theme.name}`, description: about(theme), path: palettePath(theme), ...cardOf(theme) }
    : {
        title: `ttheme — ${marketplace?.id ?? OFFICIAL}`,
        description: marketplace ? STORE : OFFICIAL_ABOUT,
        path: marketplacePath(marketplace?.id ?? null),
        ...CARD,
      }
  return page(
    { ...head, cache: CATALOG },
    <MarketplaceWorkspace marketplace={marketplace} palettes={palettes} theme={shown} gate={gate} facts={facts} />,
  )
}

function noMarketplace(id: string): Response {
  return page(
    { title: 'ttheme — no such marketplace', description: STORE, status: 404, cache: RETRY },
    <NoSuchMarketplace id={id} facts={facts} />,
  )
}

function noPalette(id: string, name: string): Response {
  return page(
    { title: 'ttheme — no such palette', description: STORE, status: 404, cache: RETRY },
    <NoSuchPalette id={id} name={name} facts={facts} />,
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
        path: '/',
        ...CARD,
        cache: CATALOG,
      },
      <Home themes={themes} facts={facts} />,
    ),
  )
  .get('/sheets', () =>
    page(
      {
        title: 'ttheme — sheets',
        description: 'Browse every ttheme palette in a terminal, with its slots and contrast readings',
        path: '/sheets',
        ...CARD,
        cache: CATALOG,
        root: sheetVars(themes[0] as Theme, sheetNumber(themes, themes[0] as Theme), gate),
        head: sheetScript(themes, gate),
      },
      <Sheets themes={themes} gate={gate} facts={facts} />,
    ),
  )
  .get('/marketplace', () =>
    page(
      {
        title: 'ttheme — marketplace',
        description: 'Every ttheme palette: the official catalogs and the marketplaces anyone publishes from GitHub',
        path: '/marketplace',
        ...CARD,
        cache: CATALOG,
      },
      <MarketplacePage themes={themes} marketplaces={marketplaces} facts={facts} />,
    ),
  )
  .get('/marketplace/:id', ({ params }) => {
    if (params.id === OFFICIAL) return workspace(null, themes, null)
    const marketplace = marketplaces.find((entry) => entry.id === params.id)
    if (!marketplace) return noMarketplace(params.id)
    return workspace(marketplace, marketplace.palettes, null)
  })
  .get('/marketplace/:id/:name', ({ params }) => {
    if (params.id === OFFICIAL) {
      const theme = themes.find((entry) => entry.name === params.name)
      return theme ? workspace(null, themes, theme) : noPalette(OFFICIAL, params.name)
    }
    const marketplace = marketplaces.find((entry) => entry.id === params.id)
    if (!marketplace) return noMarketplace(params.id)
    const theme = marketplace.palettes.find((entry) => entry.name === params.name)
    return theme ? workspace(marketplace, marketplace.palettes, theme) : noPalette(marketplace.id, params.name)
  })
  .get('/marketplace/:id/:name/card.png', ({ params }) => {
    const palettes = params.id === OFFICIAL ? themes : marketplaces.find((entry) => entry.id === params.id)?.palettes
    const theme = palettes?.find((entry) => entry.name === params.name)
    if (!theme) return new Response('no such palette', { status: 404, headers: { 'cache-control': RETRY } })
    return png(cardPng(theme))
  })
  .get('/card.png', () => png(cardPng(fallback)))
  .get('/apple-touch-icon.png', () => png(touchIconPng(fallback)))
  .get(
    '/palettes.json',
    () =>
      new Response(JSON.stringify(themes), {
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': CATALOG },
      }),
  )
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
        <Missing
          title="broken share link"
          text={`This link does not open a palette — ${found.message}`}
          facts={facts}
        />,
      )
    return page(
      {
        title: `ttheme — ${found.theme.name}`,
        description: `${found.theme.name}, a ttheme palette someone shared — see it in a terminal and install it with one command`,
        path: new URL(request.url).pathname,
        image: `${new URL(request.url).pathname}/card.png`,
        imageAlt: `${found.theme.name}'s signature and sixteen ANSI colors`,
        cache: CATALOG,
      },
      <SharePage shared={found} builder={builderOf(found, gate)} />,
    )
  })
  .get('/p/:code/card.png', ({ params }) => {
    const found = shared(params.code)
    if (found instanceof Error) return new Response(found.message, { status: 404, headers: { 'cache-control': RETRY } })
    return png(cardPng(found.theme))
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
      <Missing title="no such page" text="Nothing lives at this address." facts={facts} />,
    ),
  )
  .error('global', ({ error }) => {
    process.stderr.write(`site: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`)
    return page(
      { title: 'ttheme — something went wrong', description: 'Try again in a moment.', status: 500, cache: 'no-store' },
      <Missing title="something went wrong" text="Try again in a moment." facts={facts} />,
    )
  })
