import { catalogsOf } from '@/lib/catalogs'
import { FACET_HEIGHT, FACET_LAMP, FACET_WIDTH, facetCorners, facetMesh, facetPoints, shade } from '@/lib/facets'
import { INIT } from '@/lib/gallery'
import { type Raster, raster } from '@/lib/raster'
import type { Marketplace, Theme } from '@/lib/themes'
import { INK, wordmarkSvg } from '@/lib/wordmark'
import { leadOf } from '@/lib/workspace'
import { GLYPH, glyphSvg, marksOf } from '../../src/core/mark.ts'
import { liftOk, mixOk } from '../../src/core/oklab.ts'

export const CARD_WIDTH = 1200
export const CARD_HEIGHT = 630

const MARGIN = 72
const MESH = facetMesh()

const HEADLINE = [
  { text: 'wear your', accent: false },
  { text: 'favorite', accent: false },
  { text: 'anime', accent: true },
  { text: 'character', accent: true },
]

const TAGLINE = 'in your terminal'

export interface Frame {
  width: number
  height: number
}

export type Card =
  | { kind: 'palette' | 'share'; theme: Theme }
  | { kind: 'marketplace'; marketplace: Marketplace | null; palettes: Theme[] }
  | { kind: 'bundle'; palettes: Theme[] }
  | { kind: 'site'; theme: Theme; palettes: number; catalogs: number }

type Part = [text: string, fill: string, options?: { bold?: boolean; background?: string }]

interface Tones {
  foreground: string
  accent: string
  muted: string
  soft: string
  hair: string
  stage: string
  marks: string[]
}

interface TextOptions {
  x: number
  y: number
  size: number
  fill: string
  family: string
  weight?: number
  anchor?: 'end' | 'middle'
  spacing?: number
}

function tones(theme: Theme): Tones {
  return {
    foreground: theme.foreground,
    accent: theme.cursor,
    muted: mixOk(theme.background, theme.foreground, 0.62),
    soft: mixOk(theme.background, theme.foreground, 0.82),
    hair: mixOk(theme.background, theme.foreground, 0.22),
    stage: mixOk(theme.background, theme.foreground, 0.08),
    marks: marksOf(theme.background, theme.foreground, theme.signature),
  }
}

function entities(content: string): string {
  return content.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function text(content: string, options: TextOptions): string {
  const { x, y, size, fill, family, weight = 500, anchor, spacing } = options
  const extra = `${anchor ? ` text-anchor="${anchor}"` : ''}${spacing ? ` letter-spacing="${spacing}"` : ''}`

  return `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}"${extra} xml:space="preserve">${entities(content)}</text>`
}

function rect(x: number, y: number, width: number, height: number, radius: number, fill: string, extra = ''): string {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}"${radius ? ` rx="${radius}"` : ''} fill="${fill}"${extra ? ` ${extra}` : ''}/>`
}

function circle(x: number, y: number, radius: number, fill: string): string {
  return `<circle cx="${x}" cy="${y}" r="${radius}" fill="${fill}"/>`
}

function clip(content: string, length: number): string {
  return content.length <= length ? content : `${content.slice(0, length - 1)}…`
}

function facets(signature: string[], base: string, { width, height }: Frame, strength: number): string {
  const scale = Math.max(width / FACET_WIDTH, height / FACET_HEIGHT)
  const reachX = width / scale
  const reachY = height / scale
  const polygons: string[] = []

  for (const facet of MESH.facets) {
    const corners = facetCorners(MESH.points, facet)
    const xs = corners.map((corner) => corner.x)
    const ys = corners.map((corner) => corner.y)

    if (Math.max(...xs) < 0 || Math.min(...xs) > reachX || Math.max(...ys) < 0 || Math.min(...ys) > reachY) continue
    const { tint, lift } = shade(facet.tint, corners, FACET_LAMP)
    const fill = liftOk(mixOk(base, signature[facet.tone] as string, tint * strength), lift * strength)
    polygons.push(`<polygon points="${facetPoints(corners)}" fill="${fill}" stroke="${fill}" stroke-width="0.6"/>`)
  }

  return `${rect(0, 0, width, height, 0, base)}<g transform="scale(${scale})">${polygons.join('')}</g>`
}

function display(kit: Raster, content: string, x: number, y: number, size: number, fill: string): string {
  const spacing = -0.02 * size
  const { x: bearing } = kit.ink(content, kit.family.display, size, 900, spacing)

  return text(content, { x: x - bearing, y, size, fill, family: kit.family.display, weight: 900, spacing })
}

function wordmark(kit: Raster, k: Tones, caption?: string): string {
  const height = 46 * 0.75
  const scale = height / GLYPH.height
  const top = 112 - 46 * 0.3 - height / 2
  const glyph = glyphSvg(k.marks, `translate(${MARGIN} ${top}) scale(${scale}) translate(${-GLYPH.x} ${-GLYPH.y})`)
  const start = MARGIN + GLYPH.width * scale + 46 * 0.3
  const mark = `${glyph}${wordmarkSvg(start, 112, 46, k.foreground)}`

  if (!caption) return mark

  return `${mark}${text(caption, { x: start + (INK.width * 46) / 1000 + 26, y: 112, size: 30, fill: k.muted, family: kit.family.ui })}`
}

function rowsOf(kit: Raster, content: string, width: number, max: number, min: number) {
  const family = kit.family.display
  const whole = kit.fit(content, family, 900, width, max, -0.02)

  if (whole >= min) return { size: whole, rows: [content] }
  const parts = content.split(/(?<=[-@])/)
  let best = { size: whole, rows: [content] }

  for (let cut = 1; cut < parts.length; cut++) {
    const rows = [parts.slice(0, cut).join(''), parts.slice(cut).join('')]
    const size = Math.min(...rows.map((row) => kit.fit(row, family, 900, width, max, -0.02)))

    if (size > best.size) best = { size, rows }
  }

  return best
}

function wrap(kit: Raster, content: string, size: number, width: number): string[] {
  const rows: string[] = []
  let row = ''

  for (const word of content.split(' ')) {
    const next = row ? `${row} ${word}` : word

    if (row && kit.ink(next, kit.family.ui, size, 500, 0).width > width) {
      rows.push(row)
      row = word
    } else row = next
  }

  return row ? [...rows, row] : rows
}

function balanced(kit: Raster, content: string, size: number, width: number): string[] {
  const count = wrap(kit, content, size, width).length
  let narrow = width * 0.4
  let wide = width

  for (let step = 0; step < 14; step++) {
    const middle = (narrow + wide) / 2

    if (wrap(kit, content, size, middle).length > count) narrow = middle
    else wide = middle
  }

  return wrap(kit, content, size, wide)
}

function fitted(kit: Raster, content: string, family: string, weight: number, width: number, max: number): number {
  return Math.max(20, kit.fit(content, family, weight, width, max))
}

function runs(parts: Part[], x: number, y: number, size: number, mono: string): string {
  const advance = size * 0.6
  let at = x
  const out: string[] = []

  for (const [content, fill, options] of parts) {
    if (options?.background)
      out.push(rect(at - 2, y - size * 0.82, content.length * advance + 4, size * 1.2, 4, options.background))
    out.push(text(content, { x: at, y, size, fill, family: mono, weight: options?.bold ? 700 : 400 }))
    at += content.length * advance
  }

  return out.join('')
}

function blocks(theme: Theme, x: number, y: number, width: number): string {
  const gap = 8
  const cell = (width - gap * 7) / 8

  return theme.ansi
    .map((color, at) => rect(x + (at % 8) * (cell + gap), y + Math.floor(at / 8) * (26 + gap), cell, 26, 6, color))
    .join('')
}

function dots(colors: string[], x: number, y: number, radius: number, gap: number): string {
  return colors.map((color, at) => circle(x + radius + at * (2 * radius + gap), y, radius, color)).join('')
}

function shell(kit: Raster, theme: Theme, k: Tones, use: string, x: number, y: number, width: number): string {
  const size = 22
  const step = 36
  const advance = size * 0.6
  const ansi = (n: number): string => theme.ansi[n] as string
  const prompt = (): Part => ['❯ ', ansi(5), { bold: true }]

  const lines: Part[][] = [
    [prompt(), ['ls -F', k.foreground]],
    [
      ['shell/ ', ansi(4), { bold: true }],
      ['themes/ ', ansi(4), { bold: true }],
      ['setup.sh* ', ansi(2), { bold: true }],
      ['todo.md', k.foreground],
    ],
  ]

  if (2 + 11 + use.length <= Math.floor(width / advance))
    lines.push([prompt(), ['ttheme use ', k.foreground], [use, ansi(3)]])
  else
    lines.push(
      [prompt(), ['ttheme use', k.foreground]],
      [
        ['  ', k.foreground],
        [use, ansi(3)],
      ],
    )
  lines.push(
    [['painted this tab', ansi(8)]],
    [prompt(), ['git diff --stat', k.foreground]],
    [
      [' src/colors.ts | 12 ', k.foreground],
      ['++++++++', ansi(2)],
      ['----', ansi(1)],
    ],
    [prompt(), ['git push', k.foreground, { background: theme.selectionBackground }]],
  )
  const caret = y + (lines.length - 1) * step

  return [
    ...lines.map((line, at) => runs(line, x, y + at * step, size, kit.family.mono)),
    rect(x + advance * 10, caret - size * 0.82, advance, size * 1.2, 0, theme.cursor),
    blocks(theme, x, y + lines.length * step - 6, width),
  ].join('')
}

function listing(
  kit: Raster,
  command: string,
  themes: Theme[],
  k: Tones,
  accent: string,
  at: { x: number; y: number; width: number },
): string {
  const size = 22
  const step = 40
  const [one = '', two = '', three = '', ...rest] = command.split(' ')
  const head = three ? [one, two, three].join(' ') : command
  const argument = rest.join(' ')

  const out = [
    runs(
      [
        ['❯ ', accent, { bold: true }],
        [head, k.foreground],
      ],
      at.x,
      at.y,
      size,
      kit.family.mono,
    ),
  ]

  let row = 1

  if (argument)
    out.push(
      runs(
        [
          ['  ', k.foreground],
          [argument, accent],
        ],
        at.x,
        at.y + row++ * step,
        size,
        kit.family.mono,
      ),
    )
  const room = Math.floor((at.width - 90) / (size * 0.6)) - 5

  for (const theme of themes) {
    const base = at.y + row++ * step + 10
    out.push(dots(theme.signature, at.x, base - size * 0.32, 8, 6))
    out.push(
      text(clip(theme.name, room), {
        x: at.x + 72,
        y: base,
        size,
        fill: k.foreground,
        family: kit.family.mono,
        weight: 400,
      }),
    )
  }

  return out.join('')
}

function listed(palettes: Theme[], count: number): Theme[] {
  const leads = catalogsOf(palettes).map(({ themes }) => leadOf(themes))

  return [...leads, ...palettes.filter((theme) => !leads.includes(theme))].slice(0, count)
}

function windowOf(kit: Raster, theme: Theme, k: Tones, title: string, { width, height }: Frame) {
  const x = 600
  const y = 84
  const w = width - x - MARGIN
  const h = height - y - 76
  const lights = [theme.ansi[1], theme.ansi[3], theme.ansi[2]] as string[]

  const shadow =
    '<filter id="shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="20" stdDeviation="24" flood-color="#000" flood-opacity="0.5"/></filter>'

  const drawn = [
    rect(x, y, w, h, 22, theme.background, `stroke="${k.hair}" stroke-width="2" filter="url(#shadow)"`),
    ...lights.map((color, at) => circle(x + 34 + at * 28, y + 32, 8.5, color)),
    text(title, {
      x: x + w / 2,
      y: y + 38,
      size: 21,
      fill: k.muted,
      family: kit.family.mono,
      weight: 400,
      anchor: 'middle',
    }),
  ].join('')

  return { shadow, drawn, body: { x: x + 32, y: y + 94, width: w - 64 }, left: x - 44 - MARGIN }
}

function windowTitle(theme: Theme): string {
  const full = [theme.catalog, theme.name].filter(Boolean).join(' · ')

  return full.length <= 26 ? full : clip(theme.name, 26)
}

function sheet(frame: Frame, theme: Theme, k: Tones, shadow: string, body: string): string {
  const ground = facets(theme.signature, k.stage, frame, 0.5)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${frame.width}" height="${frame.height}" viewBox="0 0 ${frame.width} ${frame.height}"><defs>${shadow}</defs>${ground}${body}</svg>`
}

function palette(kit: Raster, card: Extract<Card, { kind: 'palette' | 'share' }>, frame: Frame): string {
  const { theme } = card
  const k = tones(theme)
  const window = windowOf(kit, theme, k, windowTitle(theme), frame)
  const { size, rows } = rowsOf(kit, theme.name, window.left, 164, 60)

  const out = [
    wordmark(kit, k),
    ...rows.map((row, at) => display(kit, row, MARGIN, 300 + at * size * 0.92, size, k.accent)),
  ]

  const below = 300 + (rows.length - 1) * size * 0.92
  const label = card.kind === 'share' ? 'shared palette' : (theme.catalog ?? theme.marketplace ?? 'palette')
  const sub = card.kind === 'palette' && theme.catalog ? theme.marketplace : null
  const ui = kit.family.ui
  out.push(
    text(label, {
      x: MARGIN,
      y: below + 62,
      size: fitted(kit, label, ui, 500, window.left, 34),
      fill: k.soft,
      family: ui,
    }),
  )

  if (sub) {
    const mono = kit.family.mono
    const options = { x: MARGIN, y: below + 106, size: fitted(kit, sub, mono, 400, window.left, 26), fill: k.muted }
    out.push(text(sub, { ...options, family: mono, weight: 400 }))
  }

  out.push(dots(theme.signature, MARGIN, frame.height - MARGIN - 22, 22, 14))
  out.push(window.drawn)
  out.push(shell(kit, theme, k, theme.id, window.body.x, window.body.y, window.body.width))

  return sheet(frame, theme, k, window.shadow, out.join(''))
}

function marketplace(kit: Raster, card: Extract<Card, { kind: 'marketplace' }>, frame: Frame): string {
  const { marketplace: market, palettes } = card
  const theme = leadOf(catalogsOf(palettes)[0]?.themes ?? palettes)
  const k = tones(theme)
  const catalogs = catalogsOf(palettes).length

  const about = market
    ? market.about
    : `${palettes.length} palettes in ${catalogs} series, each measured from the character's official art`

  const command = market ? `ttheme marketplace add ${market.add}` : INIT
  const window = windowOf(kit, theme, k, 'ttheme marketplace', frame)
  const { size, rows } = rowsOf(kit, market?.id ?? 'official', window.left, 110, 56)
  const top = 250 + (rows.length - 1) * size * 0.92 + 58

  const out = [
    wordmark(kit, k, 'marketplace'),
    ...rows.map((row, at) => display(kit, row, MARGIN, 250 + at * size * 0.92, size, k.accent)),
    ...balanced(kit, clip(about, 240), 28, window.left)
      .slice(0, 3)
      .map((row, at) => text(row, { x: MARGIN, y: top + at * 38, size: 28, fill: k.muted, family: kit.family.ui })),
  ]

  const unit = market ? 'catalogs' : 'series'
  const facts = `${palettes.length} palettes · ${catalogs} ${unit}`
  out.push(text(facts, { x: MARGIN, y: frame.height - MARGIN, size: 28, fill: k.soft, family: kit.family.ui }))
  out.push(window.drawn)
  out.push(listing(kit, command, listed(palettes, 7), k, theme.ansi[3] as string, window.body))

  return sheet(frame, theme, k, window.shadow, out.join(''))
}

function bundle(kit: Raster, card: Extract<Card, { kind: 'bundle' }>, frame: Frame): string {
  const { palettes } = card
  const theme = palettes[0] as Theme
  const k = tones(theme)
  const window = windowOf(kit, theme, k, 'ttheme add', frame)
  const title = `${palettes.length} shared palettes`
  const { size, rows } = rowsOf(kit, title, window.left, 164, 60)

  const out = [
    wordmark(kit, k),
    ...rows.map((row, at) => display(kit, row, MARGIN, 300 + at * size * 0.92, size, k.accent)),
  ]

  const below = 300 + (rows.length - 1) * size * 0.92
  const ui = kit.family.ui
  const names = palettes.map((p) => p.name)
  const label = names.length <= 3 ? names.join(', ') : `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`
  out.push(
    text(label, {
      x: MARGIN,
      y: below + 62,
      size: fitted(kit, label, ui, 500, window.left, 34),
      fill: k.soft,
      family: ui,
    }),
  )
  out.push(window.drawn)
  out.push(listing(kit, 'ttheme add <link>', palettes.slice(0, 7), k, theme.ansi[3] as string, window.body))

  return sheet(frame, theme, k, window.shadow, out.join(''))
}

function site(kit: Raster, card: Extract<Card, { kind: 'site' }>, frame: Frame): string {
  const { theme } = card
  const k = tones(theme)
  const window = windowOf(kit, theme, k, windowTitle(theme), frame)
  const longest = HEADLINE.reduce((most, { text: row }) => (row.length > most.length ? row : most), '')
  const room = (frame.height - MARGIN - 10 - 38 - 62 - 150) / (HEADLINE.length - 0.25) / 0.94
  const size = Math.min(rowsOf(kit, longest, window.left, 96, 40).size, Math.floor(room))
  const first = 150 + size * 0.7

  const out = [
    wordmark(kit, k),
    ...HEADLINE.map((row, at) =>
      display(kit, row.text, MARGIN, first + at * size * 0.94, size, row.accent ? k.accent : k.foreground),
    ),
  ]

  const last = first + (HEADLINE.length - 1) * size * 0.94
  out.push(text(TAGLINE, { x: MARGIN, y: last + 52, size: 30, fill: k.soft, family: kit.family.ui }))
  const facts = `${card.palettes} palettes · ${card.catalogs} series`
  out.push(text(facts, { x: MARGIN, y: frame.height - MARGIN, size: 28, fill: k.muted, family: kit.family.ui }))
  out.push(window.drawn)
  out.push(shell(kit, theme, k, theme.name, window.body.x, window.body.y, window.body.width))

  return sheet(frame, theme, k, window.shadow, out.join(''))
}

export async function cardPng(card: Card, frame: Frame = { width: CARD_WIDTH, height: CARD_HEIGHT }): Promise<Buffer> {
  const kit = await raster()

  if (card.kind === 'marketplace') return kit.png(marketplace(kit, card, frame))

  if (card.kind === 'bundle') return kit.png(bundle(kit, card, frame))

  if (card.kind === 'site') return kit.png(site(kit, card, frame))

  return kit.png(palette(kit, card, frame))
}

export function cardAlt(card: Card): string {
  if (card.kind === 'site')
    return `ttheme: wear your favorite anime character in your terminal, beside a terminal window wearing ${card.theme.name}`

  if (card.kind === 'marketplace')
    return `${card.marketplace?.id ?? 'official'} marketplace: its name and description beside a terminal window listing its palettes`

  if (card.kind === 'bundle')
    return `${card.palettes.length} shared palettes: their count beside a terminal window listing them with their signature colors`
  const { name, catalog } = card.theme
  const whose = card.kind === 'share' ? `${name}, a shared palette` : `${name}${catalog ? `, ${catalog}` : ''}`

  return `${whose}: its name and three signature colors beside a terminal window wearing the palette`
}
