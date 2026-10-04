import type { PropsWithChildren } from '@kitajs/html'
import assets from '@/assets.json' with { type: 'json' }
import { html } from '@/lib/render'
import { THEME_SCRIPT } from '@/lib/theme-mode'

const RELOAD = `const s=new EventSource('${assets.reload}');let lost=false;s.onmessage=()=>location.reload();s.onerror=()=>{lost=true};s.onopen=()=>{if(lost)location.reload()}`

const FONTS: string[] = assets.fonts

interface Page {
  title: string
  description: string
  status?: number
  cache: string
}

function Document({ title, description, children }: PropsWithChildren<{ title: string; description: string }>) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title safe>{title}</title>
        <meta name="description" content={description} />
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

export function page({ title, description, status = 200, cache }: Page, body: JSX.Element): Response {
  return new Response(
    `<!doctype html>${html(
      <Document title={title} description={description}>
        {body}
      </Document>,
    )}`,
    { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': cache } },
  )
}
