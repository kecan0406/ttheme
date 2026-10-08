import { official } from '@/lib/catalog'
import type { Picture, ShareView, SlotView } from '@/lib/share-view'
import { passes } from '@/lib/sheet'
import { type GateRule, type Theme, toTheme } from '@/lib/themes'
import { SITES } from '../../src/booru.ts'
import { footerRows, lights, type Part, paneLines, paneTiles, slotsOfRole } from '../../src/builder-layout.ts'
import { mix } from '../../src/color.ts'
import { lchTight } from '../../src/editor-paint.ts'
import { inGamut } from '../../src/fix.ts'
import type { PaletteEntry } from '../../src/manifest.ts'
import { readCode, shareLink } from '../../src/own.ts'
import {
  colorText,
  lchIn,
  listOf,
  misses,
  ruleSlots,
  SLOT_NAMES,
  slotChecks,
  slotLabel,
  slotUse,
} from '../../src/palette-editor.ts'
import { PLANE_BOTTOM, PLANE_TOP, RAINBOW_C, RAINBOW_L, reach, shareOf } from '../../src/picker-art.ts'
import { marketOf, type SharedPicture, slugOf } from '../../src/theme.ts'

export const GRID = { cols: 120, rows: 34 }

const PLANE_ROWS = 40
const HUE_STOPS = 24
const FAINT = 0.45

export interface Shared {
  code: string
  link: string
  entry: PaletteEntry
  theme: Theme
  pictures: Picture[]
}

export interface Run {
  text: string
  t: number
  g: number
  bold: boolean
  faint: boolean
  cursor: boolean
}

export interface Pane {
  name: string
  body: Run[][]
  footer: Run[][]
}

export interface GateLine {
  rule: GateRule
  value: number
  ok: boolean | null
  slots: number[]
}

export interface Builder {
  panes: Pane[]
  gate: GateLine[]
  view: ShareView
}

function framing({ size, position, opacity }: SharedPicture): string {
  return [
    size === undefined ? null : size === 'fill' ? 'fill' : `${size}%`,
    position ?? null,
    opacity === undefined ? null : `${Math.round(opacity * 100)}% opacity`,
  ]
    .filter((part) => part !== null)
    .join(' · ')
}

function picture(shared: SharedPicture): Picture {
  const site = SITES.find((s) => s.key === shared.site)
  return {
    post: `${site?.name ?? shared.site} #${shared.id}`,
    href: site ? site.pageUrl(shared.id) : null,
    framing: framing(shared),
    credit: null,
  }
}

export function readShared(code: string): Shared {
  const entry = readCode(code, official)
  const market = marketOf(entry.name) ?? null
  return {
    code,
    link: shareLink(code),
    entry,
    theme: toTheme({ ...entry, name: market ? slugOf(entry.name) : entry.name }, market),
    pictures: (entry.pictures ?? []).map(picture),
  }
}

const round = (value: number, digits: number) => Number(value.toFixed(digits))

function runOf(part: Part): Run {
  const { text, ground } = slotsOfRole(part.role)
  return {
    text: part.text,
    t: text,
    g: ground,
    bold: part.role === 'b' || /^B\d+$/.test(part.role),
    faint: part.role === 'd',
    cursor: part.role === 'c',
  }
}

function hueTrack(): string {
  const stops = Array.from({ length: HUE_STOPS + 1 }, (_, i) => {
    const along = i / HUE_STOPS
    return `${inGamut(RAINBOW_L, RAINBOW_C, along * 360)} ${round(along * 100, 2)}%`
  })
  return `linear-gradient(90deg, ${stops.join(', ')})`
}

export function builderOf(shared: Shared, rules: GateRule[]): Builder {
  const { entry } = shared
  const list = listOf({
    background: entry.background,
    foreground: entry.foreground,
    cursor: entry.cursor,
    selection: entry.selection,
    ansi: entry.ansi,
  })
  const signature = entry.signatureSlots
  const waive = entry.waived ?? []
  const missed = misses(list, signature, waive)
  const tiles = paneTiles(GRID.cols, GRID.rows)
  const lines = tiles.map((tile) => paneLines(tile))
  const panes = tiles.map((tile, i): Pane => {
    const runs = (lines[i] ?? []).map((line) => line.map(runOf))
    const footer = footerRows(tile)
    return { name: tile.name, body: runs.slice(0, runs.length - footer), footer: runs.slice(runs.length - footer) }
  })
  const levels = Array.from(
    { length: PLANE_ROWS },
    (_, row) => PLANE_TOP - (row / (PLANE_ROWS - 1)) * (PLANE_TOP - PLANE_BOTTOM),
  )
  const slots = list.map((hex, slot): SlotView => {
    const at = lchIn(list, hex)
    const key = SLOT_NAMES[slot] as string
    const [l = '', c = '', h = ''] = lchTight(at).trim().split(/\s+/)
    return {
      key,
      name: slotLabel(slot).name,
      hex,
      formats: { hex, rgb: colorText('rgb', hex, at), oklch: colorText('oklch', hex, at) },
      lch: [l, c, h],
      hue: round(at.h, 1),
      edges: levels.map((level) => round(reach(level, at.h), 4)),
      x: round(shareOf(at.l, at.c, at.h), 4),
      y: round(Math.min(1, Math.max(0, (PLANE_TOP - at.l) / (PLANE_TOP - PLANE_BOTTOM))), 4),
      along: round(at.h / 360, 4),
      checks: slotChecks(list, signature, waive, slot).map((check) => ({ ok: check.ok ?? null, text: check.text })),
      use: slotUse(slot),
      uses: lines.map((pane) => pane.flat().filter((part) => lights(part.role, slot)).length),
      signature: signature.includes(key),
      miss: missed.has(slot),
    }
  })
  const gate = rules.map((rule, i): GateLine => {
    const value = entry.gate[i] ?? Number.NaN
    const ok = waive.includes(rule.rule) ? null : passes({ value, min: rule.min, max: rule.max })
    return { rule, value, ok, slots: ok === false ? ruleSlots(list, signature, waive, rule.rule) : [] }
  })
  return {
    panes,
    gate,
    view: {
      panes: tiles.map((tile) => tile.name),
      top: PLANE_TOP,
      bottom: PLANE_BOTTOM,
      track: hueTrack(),
      faint: mix(entry.foreground, entry.background, FAINT),
      slots,
    },
  }
}
