import type { PropsWithChildren } from '@kitajs/html'
import assets from '@/assets.json' with { type: 'json' }
import { CARD_HEIGHT, CARD_WIDTH } from '@/lib/card'
import { html } from '@/lib/render'
import { THEME_SCRIPT } from '@/lib/theme-mode'

const RELOAD = `const s=new EventSource('${assets.reload}');let lost=false;s.onmessage=()=>location.reload();s.onerror=()=>{lost=true};s.onopen=()=>{if(lost)location.reload()}`

const FONTS: string[] = assets.fonts

interface Page {
  title: string
  description: string
  image?: string
  status?: number
  cache: string
}

function Document({
  title,
  description,
  image,
  children,
}: PropsWithChildren<{ title: string; description: string; image?: string }>) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
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
        <script>{THEME_SCRIPT}</script>
        <script type="module" src={assets.js} />
        {assets.reload ? <script type="module">{RELOAD}</script> : null}
      </head>
      <body>{children}</body>
    </html>
  )
}

export function page({ title, description, image, status = 200, cache }: Page, body: JSX.Element): Response {
  return new Response(
    `<!doctype html>${html(
      <Document title={title} description={description} image={image}>
        {body}
      </Document>,
    )}`,
    { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': cache } },
  )
}
