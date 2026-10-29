import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fallback, themes } from '@/lib/builtin'
import { type Raster, raster } from '@/lib/raster'
import { inMode, type Theme } from '@/lib/themes'
import { INK, wordmarkSvg } from '@/lib/wordmark'
import { leadsOf } from '@/lib/works'
import { GLYPH, glyphSvg, marksOf, tileBody } from '../src/core/mark.ts'
import { mixOk } from '../src/core/oklab.ts'

const xml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const TAGLINE = 'Character terminal palettes — readable by rule, switched live, one tab at a time.'

function lockup(theme: Theme, size: number, middle: number, baseline: number) {
  const height = size * 0.75
  const scale = height / GLYPH.height
  const gap = size * 0.3
  const width = (INK.width * size) / 1000
  const left = middle - (GLYPH.width * scale + gap + width) / 2
  const top = baseline - size * 0.3 - height / 2
  const inks = marksOf(theme.background, theme.foreground, theme.cursor, theme.selectionBackground)
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
    const inks = marksOf(lead.background, lead.foreground, lead.cursor, lead.selectionBackground)
    const hair = mixOk(lead.background, lead.foreground, 0.22)

    return `<g transform="translate(${640 - row / 2 + index * 80} 436)">${tileBody(lead.background, hair, inks, 1)}</g>`
  })

  return kit.png(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="640" viewBox="0 0 1280 640">${cells(theme, 1280, 640, 32, 0)}${lockup(theme, 128, 640, 250 + 128 * 0.3)}<text x="640" y="362" text-anchor="middle" font-family="${kit.family.ui}" font-size="26" font-weight="500" fill="${mixOk(theme.background, theme.foreground, 0.82)}">${xml(TAGLINE)}</text>${tiles.join('')}</svg>`,
  )
}

const out = join(process.argv[2] ?? '.', 'readme')

mkdirSync(out, { recursive: true })

const kit = await raster()

writeFileSync(join(out, 'banner-dark.png'), banner(kit, inMode(fallback, 'dark')))

writeFileSync(join(out, 'banner-light.png'), banner(kit, inMode(fallback, 'light')))

writeFileSync(
  join(out, 'social.png'),
  social(
    kit,
    inMode(fallback, 'dark'),
    leadsOf(themes)
      .slice(0, 9)
      .map((theme) => inMode(theme, 'dark')),
  ),
)
