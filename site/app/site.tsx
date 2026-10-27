import { Elysia, NotFound } from 'elysia'
import assets from '@/assets.json' with { type: 'json' }
import { BuilderPage } from '@/components/builder-page'
import { DocsIndex, DocsPage } from '@/components/docs'
import { Home } from '@/components/home'
import { NoSuchMarketplace, NoSuchPalette } from '@/components/marketplace-frame'
import { MarketplacePage } from '@/components/marketplace-page'
import { Missing } from '@/components/missing'
import { MarketplaceWorkspace } from '@/components/workspace'
import { RESTORE_SCRIPT } from '@/lib/builder'
import { builderData, starts } from '@/lib/builder-page'
import { fallback, gate, themes } from '@/lib/builtin'
import { type Card, cardAlt, cardPng } from '@/lib/card'
import { creditsOf } from '@/lib/credits'
import { DOC_PAGES, DOCS_PATH, docAt } from '@/lib/docs'
import type { Facts, Repo } from '@/lib/facts'
import { marketplacePath, palettePath, palettesPath } from '@/lib/gallery'
import { marketplaces } from '@/lib/marketplaces'
import { crumbs, ROBOTS, siteGraph, sitemapXml } from '@/lib/seo'
import { readShared, type Shared } from '@/lib/share'
import { faviconIco, touchIconPng } from '@/lib/tab-icon'
import { BUILTIN, type Marketplace, type Theme } from '@/lib/themes'
import {
  builderMeta,
  docMeta,
  docsMeta,
  marketplaceMeta,
  marketplacesMeta,
  paletteMeta,
  sharedMeta,
  siteMeta,
} from '@/lib/titles'
import { leadsOf } from '@/lib/works'
import repo from '@/repo.json' with { type: 'json' }
import pkg from '../../package.json' with { type: 'json' }
import { type Page, page } from './document'

const facts: Facts = {
  version: pkg.version,
  repo: repo as Repo | null,
}

const FIXED = 'public, max-age=0, s-maxage=31536000'
const RETRY = 'public, max-age=0, s-maxage=60'
const CREDITS = 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800'

const STORE = 'One ttheme marketplace: its repository, its palettes and how they do on the contrast checks'

const SITE_CARD: Card = { kind: 'site', theme: fallback }

const CARD = { image: '/card.png', imageAlt: cardAlt(SITE_CARD) }

const DOCS_TRAIL = [
  { name: 'ttheme', path: '/' },
  { name: 'docs', path: DOCS_PATH },
]

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
  if (id === BUILTIN) return { marketplace: null, palettes: themes }
  const marketplace = marketplaces.find((entry) => entry.id === id)

  return marketplace && { marketplace, palettes: marketplace.palettes }
}

export const PRERENDERED: string[] = [
  '/',
  '/marketplace',
  '/builder',
  DOCS_PATH,
  ...DOC_PAGES.map((doc) => doc.path),
  marketplacePath(BUILTIN),
  ...themes.map(palettePath),
  ...marketplaces.flatMap((marketplace) => [marketplacePath(marketplace.id), ...marketplace.palettes.map(palettePath)]),
]

export const DATA: string[] = [
  palettesPath(BUILTIN),
  '/builder/palettes.json',
  ...marketplaces.map((marketplace) => palettesPath(marketplace.id)),
]

function workspace(marketplace: Marketplace | null, palettes: Theme[], theme: Theme | null): Response {
  const shown = theme ?? (leadsOf(palettes)[0] as Theme)
  const id = marketplace?.id ?? BUILTIN

  const trail = [
    { name: 'ttheme', path: '/' },
    { name: 'marketplace', path: '/marketplace' },
    { name: id, path: marketplacePath(id) },
  ]

  const head = theme
    ? {
        ...paletteMeta(theme),
        path: palettePath(theme),
        ...cardOf(theme),
        ld: [crumbs([...trail, { name: theme.name, path: palettePath(theme) }])],
      }
    : {
        ...marketplaceMeta(marketplace),
        path: marketplacePath(id),
        image: `${marketplacePath(id)}/card.png`,
        imageAlt: cardAlt(marketplaceCard(marketplace, palettes)),
        ld: [crumbs(trail)],
      }

  return page(
    { ...head, cache: FIXED },
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

function builder(found: Shared | null, head: Page): Response {
  const { data, panes } = builderData(found)

  return page(
    { ...head, module: assets.builder },
    <BuilderPage data={data} panes={panes} facts={facts} shared={found} />,
  )
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
    fixed: {
      afterHandle({ set }) {
        set.headers['cache-control'] = FIXED
      },
    },
  })
  .get('/', () =>
    page(
      {
        ...siteMeta(),
        path: '/',
        ...CARD,
        ld: [siteGraph(facts)],
        cache: FIXED,
      },
      <Home themes={themes} facts={facts} />,
    ),
  )
  .get('/marketplace', () =>
    page(
      {
        ...marketplacesMeta(),
        path: '/marketplace',
        ...CARD,
        ld: [
          crumbs([
            { name: 'ttheme', path: '/' },
            { name: 'marketplace', path: '/marketplace' },
          ]),
        ],
        cache: FIXED,
      },
      <MarketplacePage themes={themes} marketplaces={marketplaces} facts={facts} />,
    ),
  )
  .get('/builder', () =>
    builder(null, {
      ...builderMeta(),
      path: '/builder',
      ...CARD,
      ld: [
        crumbs([
          { name: 'ttheme', path: '/' },
          { name: 'builder', path: '/builder' },
        ]),
      ],
      cache: FIXED,
      head: RESTORE_SCRIPT,
    }),
  )
  .get(DOCS_PATH, () =>
    page(
      {
        ...docsMeta(),
        path: DOCS_PATH,
        ...CARD,
        ld: [crumbs(DOCS_TRAIL)],
        cache: FIXED,
      },
      <DocsIndex facts={facts} about={docsMeta().description} />,
    ),
  )
  .get(`${DOCS_PATH}/:group/:slug`, ({ params }) => {
    const doc = docAt(params.group, params.slug)

    if (!doc) throw new NotFound()

    return page(
      {
        ...docMeta(doc.title, doc.group.title, doc.description),
        path: doc.path,
        ...CARD,
        ld: [crumbs([...DOCS_TRAIL, { name: doc.title, path: doc.path }])],
        cache: FIXED,
      },
      <DocsPage page={doc} facts={facts} />,
    )
  })
  .get(
    '/builder/palettes.json',
    { fixed: true },
    () => new Response(JSON.stringify(starts()), { headers: { 'content-type': 'application/json; charset=utf-8' } }),
  )
  .get('/builder/:code', ({ params, query, request }) => {
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

    const path = new URL(request.url).pathname

    return builder(found, {
      ...sharedMeta(found.palettes),
      path,
      image: `${path}/card.png`,
      imageAlt: cardAlt(sharedCard(found)),
      robots: 'noindex',
      cache: FIXED,
    })
  })
  .group('/builder/:code', (scope) =>
    scope
      .derive(({ params, query, status }) => {
        const found = shared(params.code, query.i)

        return found instanceof Error ? status(404, gone(found.message)) : { found }
      })
      .get('/card.png', { fixed: true }, async ({ found }) => png(await cardPng(sharedCard(found))))
      .get('/credits.json', async ({ found }) => {
        const { pictures, complete } = await creditsOf(found)

        return new Response(JSON.stringify(pictures), {
          headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': complete ? CREDITS : RETRY },
        })
      }),
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
      .get('/card.png', { fixed: true }, async ({ marketplace, palettes }) =>
        png(await cardPng(marketplaceCard(marketplace, palettes))),
      )
      .get('/palettes.json', { fixed: true }, ({ palettes }) => text(JSON.stringify(palettes), 'application/json'))
      .get('/:name/card.png', { fixed: true }, async ({ palettes, params }) => {
        const theme = palettes.find((entry) => entry.name === params.name)

        return theme ? png(await cardPng({ kind: 'palette', theme })) : gone('no such palette')
      }),
  )
  .get('/card.png', { fixed: true }, async () => png(await cardPng(SITE_CARD)))
  .get('/apple-touch-icon.png', { fixed: true }, () => png(touchIconPng(fallback)))
  .get('/favicon.ico', { fixed: true }, () => image(faviconIco(fallback), 'image/x-icon'))
  .get('/robots.txt', { fixed: true }, () => text(ROBOTS, 'text/plain'))
  .get('/sitemap.xml', { fixed: true }, () => text(sitemapXml(PRERENDERED), 'application/xml'))
