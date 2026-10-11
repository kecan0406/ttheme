import type { PropsWithChildren } from '@kitajs/html'
import assets from '@/assets.json' with { type: 'json' }
import { FacetGround } from '@/components/facet-ground'
import { CARD_HEIGHT, CARD_WIDTH } from '@/lib/card'
import { HANDOFF_SCRIPT } from '@/lib/handoff'
import { fallback } from '@/lib/official'
import { html } from '@/lib/render'
import { ROUTE_SCRIPT } from '@/lib/route-progress'
import { SPECULATION_RULES } from '@/lib/speculation'
import type { Theme } from '@/lib/themes'
import { rootStyle, type Vars, WEAR_SCRIPT, wearIcon } from '@/lib/wear'

const RELOAD = `let s=null,b=null;const c=()=>{s?.close();s=null},f=()=>{if(document.visibilityState==='hidden'&&!document.prerendering)c();else if(!s){s=new EventSource('${assets.reload}');s.onmessage=(e)=>{b??=e.data;if(e.data!==b)location.reload()}}};document.addEventListener('visibilitychange',f);addEventListener('pageshow',f);addEventListener('pagehide',c);f()`

const FONTS: string[] = assets.fonts

interface Page {
  title: string
  description: string
  image?: string
  status?: number
  cache: string
  wear?: Theme
  root?: Vars
  head?: string
}

function Document({
  title,
  description,
  image,
  wear,
  root = [],
  head,
  children,
}: PropsWithChildren<{
  title: string
  description: string
  image?: string
  wear?: Theme
  root?: Vars
  head?: string
}>) {
  return (
    <html lang="en" style={[rootStyle(wear ?? fallback), ...root.map(([name, value]) => `${name}:${value}`)].join(';')}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content={(wear ?? fallback).background} />
        <link rel="icon" type="image/svg+xml" href={wearIcon(wear ?? fallback)} />
        <title safe>{title}</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        {image ? (
          <>
            <meta property="og:image" content={image} />
            <meta property="og:image:width" content={String(CARD_WIDTH)} />
            <meta property="og:image:height" content={String(CARD_HEIGHT)} />
            <meta name="twitter:card" content="summary_large_image" />
          </>
        ) : null}
        {FONTS.map((font) => (
          <link rel="preload" href={font} as="font" type="font/woff2" crossorigin="" />
        ))}
        <link rel="stylesheet" href={assets.css} />
        <link rel="stylesheet" href={assets.cjk} media="print" onload="this.media='all'" />
        {wear ? null : <script>{WEAR_SCRIPT}</script>}
        {head ? <script>{head}</script> : null}
        <script>{HANDOFF_SCRIPT}</script>
        <script>{ROUTE_SCRIPT}</script>
        <script type="speculationrules">{SPECULATION_RULES}</script>
        <script type="module" src={assets.js} />
        {assets.reload ? <script type="module">{RELOAD}</script> : null}
      </head>
      <body>
        <route-progress role="progressbar" aria-label="loading" />
        <FacetGround />
        {children}
      </body>
    </html>
  )
}

export function page(
  { title, description, image, status = 200, cache, wear, root, head }: Page,
  body: JSX.Element,
): Response {
  const text = `<!doctype html>${html(
    <Document title={title} description={description} image={image} wear={wear} root={root} head={head}>
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
