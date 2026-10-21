import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fallback, themes } from '@/lib/official'
import { type Raster, raster } from '@/lib/raster'
import { inMode, type Theme } from '@/lib/themes'
import { INK, wordmarkSvg } from '@/lib/wordmark'
import { GLYPH, glyphSvg, marksOf, tileBody } from '../src/core/mark.ts'
import { mixOk } from '../src/core/oklab.ts'

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

function catalogs(themes: Theme[]) {
  const leads = themes.filter((theme) => theme.lead)

  return svg(
    rows(leads.length),
    grid(
      leads.map((theme) => [theme, theme.catalog ?? '', theme.native ?? '']),
      0,
    ),
  )
}

function palettes(themes: Theme[]) {
  const shelves = Map.groupBy(themes, (theme) => theme.catalog ?? '')
  const body: string[] = []
  let top = 0

  for (const [catalog, members] of shelves) {
    const native = members[0]?.native
    body.push(
      `<text x="0" y="${top + 20}" fill="${MUTED}" font-size="14" font-weight="700">${xml(catalog)}${native ? ` <tspan font-weight="400">${xml(native)}</tspan>` : ''}</text>`,
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

const TAGLINE = 'Character terminal palettes — readable by rule, switched live, one tab at a time.'

function lockup(theme: Theme, size: number, middle: number, baseline: number) {
  const height = size * 0.75
  const scale = height / GLYPH.height
  const gap = size * 0.3
  const width = (INK.width * size) / 1000
  const left = middle - (GLYPH.width * scale + gap + width) / 2
  const top = baseline - size * 0.3 - height / 2
  const inks = marksOf(theme.background, theme.foreground, theme.signature)
  const glyph = glyphSvg(inks, `translate(${left} ${top}) scale(${scale}) translate(${-GLYPH.x} ${-GLYPH.y})`)

  return `${glyph}${wordmarkSvg(left + GLYPH.width * scale + gap, baseline, size, theme.foreground)}`
}

function cells(theme: Theme, width: number, height: number, cell: number, radius: number) {
  const line = mixOk(theme.background, theme.foreground, 0.07)

  return `<defs><pattern id="cells" width="${cell}" height="${cell * 2}" patternUnits="userSpaceOnUse"><path d="M${cell} 0V${cell * 2}M0 ${cell * 2}H${cell}" fill="none" stroke="${line}" stroke-width="1"/></pattern></defs><rect width="${width}" height="${height}" rx="${radius}" fill="${theme.background}"/><rect width="${width}" height="${height}" rx="${radius}" fill="url(#cells)"/>`
}

function banner(kit: Raster, theme: Theme) {
  return kit.png(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="320" viewBox="0 0 1280 320">${cells(theme, 1280, 320, 26, 22)}${lockup(theme, 104, 640, 160 + 104 * 0.3)}</svg>`,
  )
}

function social(kit: Raster, theme: Theme, leads: Theme[]) {
  const row = leads.length * 64 + (leads.length - 1) * 16

  const tiles = leads.map((lead, index) => {
    const inks = marksOf(lead.background, lead.foreground, lead.signature)
    const hair = mixOk(lead.background, lead.foreground, 0.22)

    return `<g transform="translate(${640 - row / 2 + index * 80} 436)">${tileBody(lead.background, hair, inks, 1)}</g>`
  })

  return kit.png(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="640" viewBox="0 0 1280 640">${cells(theme, 1280, 640, 32, 0)}${lockup(theme, 128, 640, 250 + 128 * 0.3)}<text x="640" y="362" text-anchor="middle" font-family="${kit.family.ui}" font-size="26" font-weight="500" fill="${mixOk(theme.background, theme.foreground, 0.82)}">${xml(TAGLINE)}</text>${tiles.join('')}</svg>`,
  )
}

const out = join(process.argv[2] ?? '.', 'readme')

mkdirSync(out, { recursive: true })

writeFileSync(join(out, 'catalogs.svg'), catalogs(themes))

writeFileSync(join(out, 'palettes.svg'), palettes(themes))

const kit = await raster()

writeFileSync(join(out, 'banner-dark.png'), banner(kit, inMode(fallback, 'dark')))

writeFileSync(join(out, 'banner-light.png'), banner(kit, inMode(fallback, 'light')))

writeFileSync(
  join(out, 'social.png'),
  social(
    kit,
    inMode(fallback, 'dark'),
    themes
      .filter((theme) => theme.lead)
      .slice(0, 9)
      .map((theme) => inMode(theme, 'dark')),
  ),
)
