import { Elysia, NotFound } from 'elysia'
import { Home } from '@/components/home'
import { NoSuchMarketplace, NoSuchPalette } from '@/components/marketplace-frame'
import { MarketplacePage } from '@/components/marketplace-page'
import { Missing } from '@/components/missing'
import { SharePage } from '@/components/share-page'
import { Sheets } from '@/components/sheets'
import { MarketplaceWorkspace } from '@/components/workspace'
import { type Card, cardAlt, cardPng } from '@/lib/card'
import { catalogsOf } from '@/lib/catalogs'
import { creditsOf } from '@/lib/credits'
import type { Facts } from '@/lib/facts'
import { marketplacePath, OFFICIAL, palettePath } from '@/lib/gallery'
import { marketplaces } from '@/lib/marketplaces'
import { fallback, gate, themes } from '@/lib/official'
import { crumbs, ROBOTS, siteGraph, sitemapXml } from '@/lib/seo'
import { builderOf, readShared, type Shared } from '@/lib/share'
import { sheetNumber, sheetVars } from '@/lib/sheet'
import { sheetScript } from '@/lib/sheet-script'
import { faviconIco, touchIconPng } from '@/lib/tab-icon'
import { inMode, type Marketplace, type Theme } from '@/lib/themes'
import { marketplaceMeta, marketplacesMeta, paletteMeta, sharedMeta, sheetsMeta, siteMeta } from '@/lib/titles'
import { leadOf } from '@/lib/workspace'
import pkg from '../../package.json' with { type: 'json' }
import { page } from './document'

const facts: Facts = { palettes: themes.length, catalogs: catalogsOf(themes).length, version: pkg.version }

const CATALOG = 'public, max-age=0, s-maxage=31536000'
const RETRY = 'public, max-age=0, s-maxage=60'
const CREDITS = 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800'

const STORE = 'One ttheme marketplace: its repository, its palettes and how they measure against the contrast gate'

const SITE_CARD: Card = { kind: 'site', theme: fallback, palettes: facts.palettes, catalogs: facts.catalogs }

const CARD = { image: '/card.png', imageAlt: cardAlt(SITE_CARD) }

function cardOf(theme: Theme) {
  return { image: `${palettePath(theme)}/card.png`, imageAlt: cardAlt({ kind: 'palette', theme }) }
}

function marketplaceCard(marketplace: Marketplace | null, palettes: Theme[]): Card {
  return { kind: 'marketplace', marketplace, palettes }
}

function image(bytes: Buffer, type: string): Response {
  return new Response(bytes, { headers: { 'content-type': type, 'content-length': String(bytes.length) } })
}

function png(bytes: Buffer): Response {
  return image(bytes, 'image/png')
}

function text(body: string, type: string): Response {
  return new Response(body, { headers: { 'content-type': `${type}; charset=utf-8` } })
}

function gone(reason: string): Response {
  return new Response(reason, { status: 404, headers: { 'cache-control': RETRY } })
}

type Stock = {
  marketplace: Marketplace | null
  palettes: Theme[]
}

function stockOf(id: string): Stock | undefined {
  if (id === OFFICIAL) return { marketplace: null, palettes: themes }
  const marketplace = marketplaces.find((entry) => entry.id === id)

  return marketplace && { marketplace, palettes: marketplace.palettes }
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
  const id = marketplace?.id ?? OFFICIAL

  const trail = [
    { name: 'ttheme', path: '/' },
    { name: 'marketplace', path: '/marketplace' },
    { name: id, path: marketplacePath(marketplace?.id ?? null) },
  ]

  const head = theme
    ? {
        ...paletteMeta(theme),
        path: palettePath(theme),
        ...cardOf(theme),
        ld: [crumbs([...trail, { name: theme.name, path: palettePath(theme) }])],
      }
    : {
        ...marketplaceMeta(marketplace, palettes.length, catalogsOf(palettes).length),
        path: marketplacePath(marketplace?.id ?? null),
        image: `${marketplacePath(marketplace?.id ?? null)}/card.png`,
        imageAlt: cardAlt(marketplaceCard(marketplace, palettes)),
        ld: [crumbs(trail)],
      }

  return page(
    { ...head, cache: CATALOG },
    <MarketplaceWorkspace
      marketplace={marketplace}
      palettes={palettes}
      theme={shown}
      gate={gate}
      facts={facts}
      heading={theme ? undefined : `${id} marketplace`}
    />,
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

function shared(code: string, at?: string): Shared | Error {
  try {
    return readShared(code.replace(/%3a/gi, ':'), Number(at ?? 0))
  } catch (error) {
    return error as Error
  }
}

function sharedCard(found: Shared): Card {
  return found.palettes.length > 1
    ? { kind: 'bundle', palettes: found.palettes }
    : { kind: 'share', theme: found.theme }
}

export const site = new Elysia({ name: 'site' })
  .onError('global', NotFound, () =>
    page(
      { title: 'ttheme — no such page', description: 'Nothing lives at this address.', status: 404, cache: RETRY },
      <Missing title="no such page" text="Nothing lives at this address." facts={facts} />,
    ),
  )
  .onError('global', ({ error }) => {
    process.stderr.write(`site: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`)

    return page(
      { title: 'ttheme — something went wrong', description: 'Try again in a moment.', status: 500, cache: 'no-store' },
      <Missing title="something went wrong" text="Try again in a moment." facts={facts} />,
    )
  })
  .macro({
    catalog: {
      afterHandle({ set }) {
        set.headers['cache-control'] = CATALOG
      },
    },
  })
  .get('/', () =>
    page(
      {
        ...siteMeta(facts.palettes),
        path: '/',
        ...CARD,
        ld: [siteGraph(facts)],
        cache: CATALOG,
      },
      <Home themes={themes} facts={facts} />,
    ),
  )
  .get('/sheets', () =>
    page(
      {
        ...sheetsMeta(facts.palettes),
        path: '/sheets',
        ...CARD,
        cache: CATALOG,
        root: sheetVars(inMode(themes[0] as Theme, 'dark'), sheetNumber(themes, themes[0] as Theme), gate),
        head: sheetScript(themes, gate),
      },
      <Sheets themes={themes} gate={gate} facts={facts} />,
    ),
  )
  .get('/marketplace', () =>
    page(
      {
        ...marketplacesMeta(facts.palettes),
        path: '/marketplace',
        ...CARD,
        ld: [
          crumbs([
            { name: 'ttheme', path: '/' },
            { name: 'marketplace', path: '/marketplace' },
          ]),
        ],
        cache: CATALOG,
      },
      <MarketplacePage themes={themes} marketplaces={marketplaces} facts={facts} />,
    ),
  )
  .group('/marketplace/:id', (scope) =>
    scope
      .derive(({ params, status }) => stockOf(params.id) ?? status(404, noMarketplace(params.id)))
      .get('', ({ marketplace, palettes }) => workspace(marketplace, palettes, null))
      .get('/:name', ({ marketplace, palettes, params }) => {
        const theme = palettes.find((entry) => entry.name === params.name)

        return theme ? workspace(marketplace, palettes, theme) : noPalette(params.id, params.name)
      }),
  )
  .group('/marketplace/:id', (scope) =>
    scope
      .derive(({ params, status }) => stockOf(params.id) ?? status(404, gone('no such marketplace')))
      .get('/card.png', { catalog: true }, async ({ marketplace, palettes }) =>
        png(await cardPng(marketplaceCard(marketplace, palettes))),
      )
      .get('/:name/card.png', { catalog: true }, async ({ palettes, params }) => {
        const theme = palettes.find((entry) => entry.name === params.name)

        return theme ? png(await cardPng({ kind: 'palette', theme })) : gone('no such palette')
      }),
  )
  .get('/card.png', { catalog: true }, async () => png(await cardPng(SITE_CARD)))
  .get('/apple-touch-icon.png', { catalog: true }, () => png(touchIconPng(fallback)))
  .get('/favicon.ico', { catalog: true }, () => image(faviconIco(fallback), 'image/x-icon'))
  .get('/robots.txt', { catalog: true }, () => text(ROBOTS, 'text/plain'))
  .get('/sitemap.xml', { catalog: true }, () => text(sitemapXml(PRERENDERED), 'application/xml'))
  .get(
    '/palettes.json',
    { catalog: true },
    () => new Response(JSON.stringify(themes), { headers: { 'content-type': 'application/json; charset=utf-8' } }),
  )
  .get('/p/:code', ({ params, query, request }) => {
    const found = shared(params.code, query.i)

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
        ...sharedMeta(found.palettes),
        path: new URL(request.url).pathname,
        image: `${new URL(request.url).pathname}/card.png`,
        imageAlt: cardAlt(sharedCard(found)),
        robots: 'noindex',
        cache: CATALOG,
      },
      <SharePage shared={found} builder={builderOf(found, gate)} />,
    )
  })
  .group('/p/:code', (scope) =>
    scope
      .derive(({ params, query, status }) => {
        const found = shared(params.code, query.i)

        return found instanceof Error ? status(404, gone(found.message)) : { found }
      })
      .get('/card.png', { catalog: true }, async ({ found }) => png(await cardPng(sharedCard(found))))
      .get('/credits.json', async ({ found }) => {
        const { pictures, complete } = await creditsOf(found)

        return new Response(JSON.stringify(pictures), {
          headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': complete ? CREDITS : RETRY },
        })
      }),
  )
