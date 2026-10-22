import type { PropsWithChildren } from '@kitajs/html'
import assets from '@/assets.json' with { type: 'json' }
import { FacetGround } from '@/components/facet-ground'
import { CARD_HEIGHT, CARD_WIDTH } from '@/lib/card'
import { HANDOFF_SCRIPT } from '@/lib/handoff'
import { KEYS_SCRIPT } from '@/lib/keys'
import { fallback } from '@/lib/official'
import { html, json } from '@/lib/render'
import { ROUTE_SCRIPT } from '@/lib/route-progress'
import { CARD_REV, ORIGIN } from '@/lib/seo'
import { SPECULATION_RULES } from '@/lib/speculation'
import { rootStyle, themeIcon, type Vars, wearScript } from '@/lib/wear'

const RELOAD = `let s=null,b=null;const c=()=>{s?.close();s=null},f=()=>{if(document.visibilityState==='hidden'&&!document.prerendering)c();else if(!s){s=new EventSource('${assets.reload}');s.onmessage=(e)=>{b??=e.data;if(e.data!==b)location.reload()}}};document.addEventListener('visibilitychange',f);addEventListener('pageshow',f);addEventListener('pagehide',c);f()`

const FONTS: string[] = assets.fonts

const WEAR_SCRIPT = wearScript(fallback)

const INSIGHTS = ['/_vercel/insights/script.js', '/_vercel/speed-insights/script.js']

const INDEXABLE = 'max-image-preview:large'

interface Page {
  title: string
  description: string
  path?: string
  image?: string
  imageAlt?: string
  robots?: string
  ld?: object[]
  status?: number
  cache: string
  root?: Vars
  head?: string
  module?: string
}

function Document({
  title,
  description,
  path,
  image,
  imageAlt,
  robots = INDEXABLE,
  ld = [],
  root = [],
  head,
  module,
  children,
}: PropsWithChildren<{
  title: string
  description: string
  path?: string
  image?: string
  imageAlt?: string
  robots?: string
  ld?: object[]
  root?: Vars
  head?: string
  module?: string
}>) {
  return (
    <html
      lang="en"
      data-mode="dark"
      data-setting="dark"
      style={[rootStyle(fallback), ...root.map(([name, value]) => `${name}:${value}`)].join(';')}
    >
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content={fallback.background} />
        <link rel="icon" type="image/svg+xml" href={themeIcon(fallback)} />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <title safe>{title}</title>
        <meta name="description" content={description} />
        <meta name="robots" content={robots} />
        {path === undefined ? null : (
          <>
            <link rel="canonical" href={`${ORIGIN}${path}`} />
            <meta property="og:url" content={`${ORIGIN}${path}`} />
          </>
        )}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="ttheme" />
        <meta property="og:locale" content="en_US" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        {image ? (
          <>
            <meta property="og:image" content={`${ORIGIN}${image}?v=${CARD_REV}`} />
            <meta property="og:image:type" content="image/png" />
            <meta property="og:image:width" content={String(CARD_WIDTH)} />
            <meta property="og:image:height" content={String(CARD_HEIGHT)} />
            {imageAlt ? (
              <>
                <meta property="og:image:alt" content={imageAlt} />
                <meta name="twitter:image:alt" content={imageAlt} />
              </>
            ) : null}
            <meta name="twitter:card" content="summary_large_image" />
          </>
        ) : (
          <meta name="twitter:card" content="summary" />
        )}
        <link rel="stylesheet" href={assets.css} />
        {FONTS.map((font) => (
          <link rel="preload" href={font} as="font" type="font/woff2" crossorigin="" />
        ))}
        <script>{KEYS_SCRIPT}</script>
        <script>{WEAR_SCRIPT}</script>
        <script type="application/json" data-fallback>
          {json(fallback)}
        </script>
        {head ? <script>{head}</script> : null}
        <script>{HANDOFF_SCRIPT}</script>
        <script>{ROUTE_SCRIPT}</script>
        <script type="speculationrules">{SPECULATION_RULES}</script>
        {ld.map((graph) => (
          <script type="application/ld+json">{json(graph)}</script>
        ))}
        <script type="module" src={assets.js} />
        {module ? <script type="module" src={module} /> : null}
        {assets.reload ? <script type="module">{RELOAD}</script> : INSIGHTS.map((src) => <script defer src={src} />)}
      </head>
      <body>
        <a
          href="#content"
          class="fixed top-3 left-3 z-60 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg not-focus:sr-only"
        >
          skip to content
        </a>
        <route-progress role="progressbar" aria-label="loading" />
        <FacetGround />
        {children}
        <p data-announce role="status" class="sr-only" />
      </body>
    </html>
  )
}

export function page(
  { title, description, path, image, imageAlt, robots, ld, status = 200, cache, root, head, module }: Page,
  body: JSX.Element,
): Response {
  const text = `<!doctype html>${html(
    <Document
      title={title}
      description={description}
      path={path}
      image={image}
      imageAlt={imageAlt}
      robots={robots}
      ld={ld}
      root={root}
      head={head}
      module={module}
    >
      {body}
    </Document>,
  )}`

  return new Response(text, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': cache,
      etag: `"${Bun.hash(text).toString(36)}"`,
    },
  })
}
