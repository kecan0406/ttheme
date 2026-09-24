import { notFound } from 'next/navigation'
import { loadManifest, type Theme } from '@/lib/themes'

export const dynamic = 'force-static'
export const dynamicParams = false

const COLS = 3
const CARD_W = 280
const CARD_H = 76
const GAP = 8
const HEAD = 34
const WIDTH = COLS * CARD_W + (COLS - 1) * GAP
const FONT = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
const MUTED = '#8b949e'

const xml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function card(theme: Theme, x: number, y: number, title: string, subtitle: string) {
  const swatches = theme.ansi.map((color, i) => {
    const sx = x + 12 + (i % 8) * 32
    const sy = y + CARD_H - 30 + Math.floor(i / 8) * 10
    return `<rect x="${sx}" y="${sy}" width="32" height="10" fill="${color}"/>`
  })
  const dots = theme.signature.map(
    (color, i) => `<circle cx="${x + CARD_W - 16 - i * 14}" cy="${y + 18}" r="5" fill="${color}"/>`,
  )
  return [
    `<rect x="${x}" y="${y}" width="${CARD_W}" height="${CARD_H}" rx="8" fill="${theme.background}" stroke="${theme.selectionBackground}"/>`,
    `<text x="${x + 12}" y="${y + 23}" fill="${theme.foreground}" font-size="13" font-weight="700">${xml(title)}</text>`,
    subtitle ? `<text x="${x + 12}" y="${y + 38}" fill="${theme.ansi[8]}" font-size="10">${xml(subtitle)}</text>` : '',
    ...dots,
    ...swatches,
  ].join('')
}

function grid(cards: [Theme, string, string][], top: number) {
  return cards.map(([theme, title, subtitle], i) =>
    card(theme, (i % COLS) * (CARD_W + GAP), top + Math.floor(i / COLS) * (CARD_H + GAP), title, subtitle),
  )
}

const rows = (count: number) => Math.ceil(count / COLS) * (CARD_H + GAP) - GAP

function svg(height: number, body: string[]) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}" font-family="${FONT}">${body.join('')}</svg>`
}

function series(themes: Theme[]) {
  const leads = themes.filter((theme) => theme.lead)
  return svg(
    rows(leads.length),
    grid(
      leads.map((theme) => [theme, theme.group, theme.native ?? '']),
      0,
    ),
  )
}

function palettes(themes: Theme[]) {
  const groups = Map.groupBy(themes, (theme) => theme.group)
  const body: string[] = []
  let top = 0
  for (const [group, members] of groups) {
    const native = members[0]?.native
    body.push(
      `<text x="0" y="${top + 20}" fill="${MUTED}" font-size="14" font-weight="700">${xml(group)}${native ? ` <tspan font-weight="400">${xml(native)}</tspan>` : ''}</text>`,
    )
    top += HEAD
    body.push(
      ...grid(
        members.map((theme) => [theme, theme.name, theme.ansiSource]),
        top,
      ),
    )
    top += rows(members.length) + 20
  }
  return svg(top - 20, body)
}

const FILES: Record<string, (themes: Theme[]) => string> = {
  'series.svg': series,
  'palettes.svg': palettes,
}

export function generateStaticParams() {
  return Object.keys(FILES).map((file) => ({ file }))
}

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params
  const render = FILES[file]
  if (!render) notFound()
  return new Response(render(loadManifest().themes), { headers: { 'Content-Type': 'image/svg+xml' } })
}
