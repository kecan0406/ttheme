import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { SITES } from './booru.ts'
import { isHex } from './color.ts'
import { GATE_RULES, measure, RULES } from './contrast.ts'
import { type PaletteEntry, paletteEntry, toTheme } from './emit/manifest.ts'
import { isLocal, localOwner, marketSources } from './sources.ts'
import {
  type Group,
  ORIGINAL,
  ownerOf,
  type Place,
  POSITIONS,
  readTheme,
  type SharedPicture,
  slugOf,
  type Theme,
} from './theme.ts'

export const CODE = 'tt1:'
const SLOTS = ['background', 'foreground', 'cursor', 'selection', ...Array.from({ length: 16 }, (_, i) => `ansi${i}`)]

export interface Draft {
  name: string
  base?: string
  group?: string
  ansiSource?: string
  booru?: string
  booruSites?: Record<string, string[]>
  signature: string[]
  background: string
  foreground: string
  cursor: string
  selection: string
  ansi: string[]
  waive?: string[]
  reason?: string
  pictures?: SharedPicture[]
}

export interface LocalMarket {
  dir: string
  owner: string
}

export function localMarkets(configHome: string, warn = true): LocalMarket[] {
  return marketSources(configHome)
    .filter(isLocal)
    .flatMap((dir) => {
      try {
        return [{ dir, owner: localOwner(dir) }]
      } catch (error) {
        if (warn) {
          process.stderr.write(`ttheme: skipping the market at ${dir} — ${(error as Error).message}\n`)
        }
        return []
      }
    })
}

export function palettesDir(dir: string): string {
  return join(dir, 'palettes')
}

export function ownPath(configHome: string, name: string): string {
  const owner = ownerOf(name)
  if (!owner) {
    throw new Error(`${name} is an official palette — yours are named <palette>@<you>`)
  }
  const market = localMarkets(configHome, false).find((m) => m.owner === owner)
  if (!market) {
    throw new Error(`${name} is not in a local market — \`ttheme market add <dir>\` adds the folder that holds it`)
  }
  return join(palettesDir(market.dir), `${slugOf(name)}.toml`)
}

export function placeFor(name: string, entries: PaletteEntry[]): Place {
  const groups = new Map<string, Group>()
  for (const e of entries) {
    if (e.group !== ORIGINAL && !groups.has(e.group)) {
      const lead = entries.find((x) => x.group === e.group && x.lead)?.name ?? ''
      groups.set(e.group, { name: e.group, ...(e.native ? { native: e.native } : {}), lead })
    }
  }
  const bases = new Map(
    entries.filter((e) => !e.default && !ownerOf(e.name)).map((e) => [e.name, { group: e.group, order: e.order }]),
  )
  return { name, groups, bases, open: true }
}

export function readOwnText(name: string, source: string, entries: PaletteEntry[]): Theme {
  const slug = slugOf(name)
  return { ...readTheme(`${slug}.toml`, source, placeFor(slug, entries)), name }
}

export function readMarketDir(dir: string, owner: string, entries: PaletteEntry[], warn = true): PaletteEntry[] {
  const folder = palettesDir(dir)
  return (existsSync(folder) ? readdirSync(folder).sort() : [])
    .filter((file) => file.endsWith('.toml'))
    .flatMap((file) => {
      try {
        const text = readFileSync(join(folder, file), 'utf8')
        return [paletteEntry(readOwnText(`${basename(file, '.toml')}@${owner}`, text, entries))]
      } catch (error) {
        if (warn) {
          process.stderr.write(`ttheme: skipping ${join(folder, file)} — ${(error as Error).message}\n`)
        }
        return []
      }
    })
}

export function readLocal(configHome: string, entries: PaletteEntry[], warn = true): PaletteEntry[] {
  return localMarkets(configHome, warn).flatMap(({ dir, owner }) => readMarketDir(dir, owner, entries, warn))
}

export function draftOf(entry: PaletteEntry, name = entry.name, reason?: string): Draft {
  return {
    name,
    ...(entry.base ? { base: entry.base } : {}),
    ...(entry.group !== ORIGINAL ? { group: entry.group } : {}),
    ansiSource: entry.ansiSource,
    ...(entry.booru ? { booru: entry.booru } : {}),
    ...(entry.booruSites ? { booruSites: entry.booruSites } : {}),
    signature: entry.signatureSlots,
    background: entry.background,
    foreground: entry.foreground,
    cursor: entry.cursor,
    selection: entry.selection,
    ansi: entry.ansi,
    ...(entry.waived && entry.waived.length > 0
      ? { waive: entry.waived, reason: reason ?? 'kept from the palette' }
      : {}),
    ...(entry.pictures ? { pictures: entry.pictures } : {}),
  }
}

const q = (value: string) => JSON.stringify(value)

export function paletteToml(d: Draft): string {
  const lines = [
    '[meta]',
    `name = ${q(slugOf(d.name))}`,
    ...(d.base ? [`base = ${q(d.base)}`] : []),
    ...(d.group ? [`group = ${q(d.group)}`] : []),
    ...(d.ansiSource ? [`ansi_source = ${q(d.ansiSource)}`] : []),
    ...(d.booru ? [`booru = ${q(d.booru)}`] : []),
    `signature = [${d.signature.map(q).join(', ')}]`,
    ...(d.booruSites
      ? [
          '',
          '[meta.booru_sites]',
          ...Object.entries(d.booruSites).map(([site, tags]) => `${site} = [${tags.map(q).join(', ')}]`),
        ]
      : []),
    '',
    '[colors]',
    `background = ${q(d.background)}`,
    `foreground = ${q(d.foreground)}`,
    `cursor = ${q(d.cursor)}`,
    `selection_background = ${q(d.selection)}`,
    'ansi = [',
    ...d.ansi.slice(0, 8).map((c) => `  ${q(c)},`),
    '',
    ...d.ansi.slice(8).map((c) => `  ${q(c)},`),
    ']',
  ]
  if (d.waive && d.waive.length > 0) {
    lines.push('', '[contrast]', `waive = [${d.waive.map(q).join(', ')}]`, `reason = ${q(d.reason ?? '')}`)
  }
  for (const p of d.pictures ?? []) {
    lines.push('', '[[picture]]', `site = ${q(p.site)}`, `id = ${p.id}`)
    if (p.size !== undefined) {
      lines.push(`size = ${typeof p.size === 'number' ? p.size : q(p.size)}`)
    }
    if (p.position !== undefined) {
      lines.push(`position = ${q(p.position)}`)
    }
    if (p.opacity !== undefined) {
      lines.push(`opacity = ${p.opacity}`)
    }
  }
  return `${lines.join('\n')}\n`
}

class Writer {
  private readonly bytes: number[] = []

  u8(n: number): void {
    this.bytes.push(n & 255)
  }

  u16(n: number): void {
    this.u8(n >> 8)
    this.u8(n)
  }

  u32(n: number): void {
    this.u16(Math.floor(n / 65536))
    this.u16(n % 65536)
  }

  str(s = ''): void {
    const utf8 = new TextEncoder().encode(s)
    if (utf8.length > 255) {
      throw new Error(`"${s}" is too long to share`)
    }
    this.u8(utf8.length)
    this.bytes.push(...utf8)
  }

  color(hex: string): void {
    const n = Number.parseInt(hex.slice(1), 16)
    this.u8(n >> 16)
    this.u8(n >> 8)
    this.u8(n)
  }

  done(): string {
    return Buffer.from(this.bytes).toString('base64url')
  }
}

class Reader {
  private at = 0
  private readonly bytes: Uint8Array

  constructor(bytes: Uint8Array) {
    this.bytes = bytes
  }

  u8(): number {
    const n = this.bytes[this.at++]
    if (n === undefined) {
      throw new Error('the share code is cut short')
    }
    return n
  }

  u16(): number {
    return this.u8() * 256 + this.u8()
  }

  u32(): number {
    return this.u16() * 65536 + this.u16()
  }

  str(): string {
    const n = this.u8()
    const slice = this.bytes.subarray(this.at, this.at + n)
    if (slice.length !== n) {
      throw new Error('the share code is cut short')
    }
    this.at += n
    return new TextDecoder('utf-8', { fatal: true }).decode(slice)
  }

  color(): string {
    return `#${[this.u8(), this.u8(), this.u8()].map((b) => b.toString(16).padStart(2, '0')).join('')}`
  }

  end(): void {
    if (this.at !== this.bytes.length) {
      throw new Error('the share code has bytes left over')
    }
  }
}

export function shareCode(d: Draft): string {
  const w = new Writer()
  w.str(d.name)
  for (const c of [d.background, d.foreground, d.cursor, d.selection, ...d.ansi]) {
    w.color(c)
  }
  for (const slot of d.signature) {
    w.u8(SLOTS.indexOf(slot))
  }
  w.str(d.base)
  w.str(d.group)
  w.str(d.ansiSource)
  w.str(d.booru)
  w.u16((d.waive ?? []).reduce((mask, rule) => mask | (1 << RULES.indexOf(rule)), 0))
  w.str(d.waive && d.waive.length > 0 ? d.reason : '')
  const pictures = d.pictures ?? []
  w.u8(pictures.length)
  for (const p of pictures) {
    w.u8(SITES.findIndex((s) => s.key === p.site))
    w.u32(p.id)
    w.u16(p.size === undefined ? 0 : p.size === 'fill' ? 1 : p.size)
    w.u8(p.position === undefined ? 0 : (POSITIONS as readonly string[]).indexOf(p.position) + 1)
    w.u16(p.opacity === undefined ? 0 : Math.round(p.opacity * 1000) + 1)
  }
  return `${CODE}${w.done()}`
}

export function fromCode(code: string): Draft {
  if (!code.startsWith(CODE)) {
    throw new Error(`a share code starts with ${CODE}`)
  }
  const body = code.slice(CODE.length)
  if (!/^[A-Za-z0-9_-]+$/.test(body)) {
    throw new Error('the share code holds characters it never uses — was it copied whole?')
  }
  const r = new Reader(new Uint8Array(Buffer.from(body, 'base64url')))
  const name = r.str()
  const [background, foreground, cursor, selection, ...ansi] = Array.from({ length: 20 }, () => r.color()) as [
    string,
    string,
    string,
    string,
    ...string[],
  ]
  const signature = [r.u8(), r.u8(), r.u8()].map((i) => SLOTS[i] ?? `slot${i}`)
  const base = r.str()
  const group = r.str()
  const ansiSource = r.str()
  const booru = r.str()
  const mask = r.u16()
  const reason = r.str()
  const waive = RULES.filter((_, i) => mask & (1 << i))
  const pictures = Array.from({ length: r.u8() }, (): SharedPicture => {
    const site = SITES[r.u8()]?.key ?? 'unknown'
    const id = r.u32()
    const size = r.u16()
    const position = r.u8()
    const opacity = r.u16()
    return {
      site,
      id,
      ...(size === 1 ? { size: 'fill' as const } : size > 1 ? { size } : {}),
      ...(position > 0 ? { position: POSITIONS[position - 1] ?? 'unknown' } : {}),
      ...(opacity > 0 ? { opacity: (opacity - 1) / 1000 } : {}),
    }
  })
  r.end()
  if (![background, foreground, cursor, selection, ...ansi].every(isHex)) {
    throw new Error('the share code holds a color that is not one')
  }
  return {
    name,
    ...(base ? { base } : {}),
    ...(group ? { group } : {}),
    ...(ansiSource ? { ansiSource } : {}),
    ...(booru ? { booru } : {}),
    signature,
    background,
    foreground,
    cursor,
    selection,
    ansi,
    ...(waive.length > 0 ? { waive, reason } : {}),
    ...(pictures.length > 0 ? { pictures } : {}),
  }
}

export function recolor(text: string, colors: Pick<Theme, 'foreground' | 'selectionBackground' | 'ansi'>): string {
  const start = text.indexOf('ansi = [')
  const end = text.indexOf(']', start)
  if (start < 0 || end < 0) {
    throw new Error('no ansi = [...] list to rewrite')
  }
  let index = 0
  const block = text.slice(start, end).replace(/"#[0-9a-fA-F]{6}"/g, () => q(colors.ansi[index++] as string))
  return (text.slice(0, start) + block + text.slice(end))
    .replace(/^(foreground\s*=\s*)"#[0-9a-fA-F]{6}"/m, (_, key) => `${key}${q(colors.foreground)}`)
    .replace(/^(selection_background\s*=\s*)"#[0-9a-fA-F]{6}"/m, (_, key) => `${key}${q(colors.selectionBackground)}`)
}

export function gateLines(entry: PaletteEntry): string[] {
  const values = measure(toTheme(entry))
  const waived = new Set(entry.waived ?? [])
  const pad = Math.max(...GATE_RULES.map((r) => r.label.length))
  return GATE_RULES.map((rule, i) => {
    const value = values[i] as number
    const ok =
      waived.has(rule.rule) ||
      Number.isNaN(value) ||
      ((rule.min === undefined || value >= rule.min) && (rule.max === undefined || value <= rule.max))
    const bound = rule.min !== undefined ? `≥ ${rule.min}` : rule.max !== undefined ? `≤ ${rule.max}` : ''
    const shown = Number.isNaN(value) ? '—' : Number.isInteger(value) ? String(value) : value.toFixed(2)
    return `  ${ok ? '✓' : '✗'} ${rule.label.padEnd(pad)}  ${shown.padStart(6)} ${bound}${waived.has(rule.rule) ? '  waived' : ''}`
  })
}
