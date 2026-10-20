import { createHash } from 'node:crypto'
import { basename } from 'node:path'
import { brotliCompressSync, brotliDecompressSync, deflateRawSync, inflateRawSync } from 'node:zlib'
import { SITES } from './booru.ts'
import { isHex } from './color.ts'
import { GATE_RULES, measure, RULES } from './contrast.ts'
import { type PaletteEntry, paletteEntry, toTheme } from './manifest.ts'
import { memo } from './memo.ts'
import { modeOf, otherOf } from './mode.ts'
import type { Colors } from './seeds.ts'
import { escaped, quoted } from './text.ts'
import {
  type Catalog,
  catalogProblem,
  marketplaceOf,
  PALETTE_SCHEMA_URL,
  type Place,
  POSITIONS,
  readTheme,
  type SharedPicture,
  slugOf,
  type Theme,
  textProblem,
} from './theme.ts'

const CODE = 'tt4:'
export const SHARE_URL = 'https://ttheme.dev/p/'
const SUM = 4
const UNPACKED = 64 * 1024

const PACKS: ((bytes: Buffer) => Buffer)[] = [
  (bytes) => bytes,
  (bytes) => deflateRawSync(bytes, { level: 9 }),
  (bytes) => brotliCompressSync(bytes),
]

const UNPACKS: ((bytes: Buffer) => Buffer)[] = [
  (bytes) => bytes,
  (bytes) => inflateRawSync(bytes, { maxOutputLength: UNPACKED }),
  (bytes) => brotliDecompressSync(bytes, { maxOutputLength: UNPACKED }),
]

const SLOTS = ['background', 'foreground', 'cursor', 'selection', ...Array.from({ length: 16 }, (_, i) => `ansi${i}`)]

export interface Draft {
  name: string
  base?: string
  from?: string
  catalog?: string
  ansiSource?: string
  booru?: string
  booruSites?: Record<string, string[]>
  signature: string[]
  background: string
  foreground: string
  cursor: string
  selection: string
  ansi: string[]
  other?: Colors
  waive?: string[]
  reason?: string
  pictures?: SharedPicture[]
}

export interface MarketplaceFile {
  path: string
  slug: string
  catalog?: string
}

function byName(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export function marketplaceLayout(
  paths: Iterable<string>,
  at: (path: string) => string,
  catalogs: readonly Catalog[] = [],
): MarketplaceFile[] {
  const shelved: { file: MarketplaceFile; name: string }[] = []
  const loose: { file: MarketplaceFile; name: string }[] = []

  for (const path of paths) {
    const [top, first, second, ...deeper] = path.split('/')

    if (top !== 'palettes' || !first || first.startsWith('.') || deeper.length > 0) {
      continue
    }

    if (second === undefined) {
      if (first.endsWith('.toml')) {
        loose.push({ file: { path: at(path), slug: basename(first, '.toml') }, name: first })
      }
    } else if (second.endsWith('.toml')) {
      shelved.push({ file: { path: at(path), slug: basename(second, '.toml'), catalog: first }, name: second })
    }
  }

  const listed = (catalog = '') => {
    const at = catalogs.findIndex((c) => c.name === catalog)

    return at < 0 ? catalogs.length : at
  }

  shelved.sort(
    (a, b) =>
      listed(a.file.catalog) - listed(b.file.catalog) ||
      byName(a.file.catalog ?? '', b.file.catalog ?? '') ||
      byName(a.name, b.name),
  )
  loose.sort((a, b) => byName(a.name, b.name))

  return [...shelved, ...loose].map(({ file }) => file)
}

function marketplaceFileProblem(file: MarketplaceFile, seen: ReadonlyMap<string, MarketplaceFile>): string | undefined {
  const twin = seen.get(file.slug)

  if (twin) {
    return `${escaped(file.slug)} is also ${twin.catalog ? `in ${escaped(twin.catalog)}` : 'outside a catalog'} — a palette name is used once in a marketplace`
  }

  if (file.catalog === undefined) {
    return undefined
  }

  const problem = textProblem(file.catalog)

  return problem ? `the catalog folder ${quoted(file.catalog)} ${problem}` : undefined
}

interface Shelf {
  catalog?: string
  catalogs?: readonly Catalog[]
}

function basesOf(entries: PaletteEntry[]): Map<string, { order: number }> {
  return new Map(
    entries
      .values()
      .filter((e) => !e.default && !marketplaceOf(e.name))
      .map((e) => [e.name, { order: e.order }]),
  )
}

function placeFor(name: string, entries: PaletteEntry[], foreign: boolean, shelf: Shelf): Place {
  return {
    name,
    ...(shelf.catalog === undefined ? {} : { catalog: shelf.catalog }),
    catalogs: new Map((shelf.catalogs ?? []).map((c) => [c.name, c])),
    bases: basesOf(entries),
    open: true,
    ...(foreign ? { foreign: true as const } : {}),
  }
}

export function readOwnText(
  name: string,
  source: string,
  entries: PaletteEntry[],
  foreign = false,
  shelf: Shelf = {},
): Theme {
  const slug = slugOf(name)

  return { ...readTheme(`${slug}.toml`, source, placeFor(slug, entries, foreign, shelf)), name }
}

export type Report = (where: string, message: string) => void

export function readMarketplaceFiles(
  files: MarketplaceFile[],
  read: (file: MarketplaceFile) => string,
  id: string,
  entries: PaletteEntry[],
  report: Report,
  foreign = false,
  catalogs: readonly Catalog[] = [],
): PaletteEntry[] {
  const seen = new Map<string, MarketplaceFile>()
  const place = JSON.stringify([foreign, catalogs, [...basesOf(entries)]])

  return files.flatMap((file) => {
    try {
      const problem = marketplaceFileProblem(file, seen)

      if (problem) {
        throw new Error(problem)
      }

      seen.set(file.slug, file)
      const shelf = { ...(file.catalog === undefined ? {} : { catalog: file.catalog }), catalogs }
      const name = `${id}/${file.slug}`
      const text = read(file)

      return [
        memo('entry', `${place}${JSON.stringify([name, file.catalog ?? null, text])}`, () =>
          paletteEntry(readOwnText(name, text, entries, foreign, shelf)),
        ),
      ]
    } catch (error) {
      report(file.path, (error as Error).message)

      return []
    }
  })
}

export function draftOf(entry: PaletteEntry, name = entry.name, reason?: string): Draft {
  return {
    name,
    ...(entry.base ? { base: entry.base } : {}),
    ...(entry.from ? { from: entry.from } : {}),
    ...(entry.catalog ? { catalog: entry.catalog } : {}),
    ansiSource: entry.ansiSource,
    ...(entry.booru ? { booru: entry.booru } : {}),
    ...(entry.booruSites ? { booruSites: entry.booruSites } : {}),
    signature: entry.signatureSlots,
    background: entry.background,
    foreground: entry.foreground,
    cursor: entry.cursor,
    selection: entry.selection,
    ansi: entry.ansi,
    ...(entry.other ? { other: entry.other } : {}),
    ...(entry.waived && entry.waived.length > 0
      ? { waive: entry.waived, reason: reason ?? 'kept from the palette' }
      : {}),
    ...(entry.pictures ? { pictures: entry.pictures } : {}),
  }
}

const q = (value: string) => JSON.stringify(value)

function pictureToml(p: SharedPicture): string[] {
  return [
    '[[picture]]',
    `site = ${q(p.site)}`,
    `id = ${p.id}`,
    ...(p.size === undefined ? [] : [`size = ${typeof p.size === 'number' ? p.size : q(p.size)}`]),
    ...(p.position === undefined ? [] : [`position = ${q(p.position)}`]),
    ...(p.opacity === undefined ? [] : [`opacity = ${p.opacity}`]),
  ]
}

export function withPictures(text: string, pictures: readonly SharedPicture[]): string {
  return pictures.length === 0
    ? text
    : `${text.replace(/\n*$/, '\n')}${pictures.map((p) => `\n${pictureToml(p).join('\n')}\n`).join('')}`
}

export function colorsToml(c: Colors, table: string): string[] {
  return [
    `[${table}]`,
    `background = ${q(c.background)}`,
    `foreground = ${q(c.foreground)}`,
    `cursor = ${q(c.cursor)}`,
    `selection_background = ${q(c.selection)}`,
    'ansi = [',
    ...c.ansi.slice(0, 8).map((color) => `  ${q(color)},`),
    '',
    ...c.ansi.slice(8).map((color) => `  ${q(color)},`),
    ']',
  ]
}

export function paletteToml(d: Draft): string {
  const lines = [
    `"$schema" = ${q(PALETTE_SCHEMA_URL)}`,
    '',
    '[meta]',
    `name = ${q(slugOf(d.name))}`,
    ...(d.base ? [`base = ${q(d.base)}`] : []),
    ...(d.from ? [`from = ${q(d.from)}`] : []),
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
    ...colorsToml(d, 'colors'),
    ...(d.other ? ['', ...colorsToml(d.other, `colors.${otherOf(modeOf(d))}`)] : []),
    ...(d.waive && d.waive.length > 0
      ? ['', '[contrast]', `waive = [${d.waive.map(q).join(', ')}]`, `reason = ${q(d.reason ?? '')}`]
      : []),
    ...(d.pictures ?? []).flatMap((p) => ['', ...pictureToml(p)]),
  ]

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

  body(): Buffer {
    return Buffer.from(this.bytes)
  }

  done(): string {
    return signed(this.body())
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

    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(slice)
    } catch {
      throw new Error('the share code holds text it cannot read — was it copied whole?')
    }
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

function checksum(bytes: Uint8Array): Buffer {
  return createHash('sha256').update(bytes).digest().subarray(0, SUM)
}

function signed(body: Buffer): string {
  return Buffer.concat([body, checksum(body)]).toString('base64url')
}

function payloadOf(code: string, prefix: string): Buffer {
  const body = code.slice(prefix.length)

  if (!/^[A-Za-z0-9_-]+$/.test(body)) {
    throw new Error('the share code holds characters it never uses — was it copied whole?')
  }

  const bytes = Buffer.from(body, 'base64url')

  if (bytes.length <= SUM) {
    throw new Error('the share code is cut short')
  }

  const payload = bytes.subarray(0, -SUM)

  if (!checksum(payload).equals(bytes.subarray(-SUM))) {
    throw new Error('the share code does not add up — was it copied whole?')
  }

  return payload
}

function isCode(text: string): boolean {
  return /^tt\d+:/.test(text)
}

export function shareLink(code: string): string {
  return `${SHARE_URL}${code}`
}

export function codeOf(text: string): string | undefined {
  const given = text.trim()

  if (!/^https?:\/\//i.test(given)) {
    return isCode(given) ? given : undefined
  }

  const segment = URL.canParse(given) ? /^\/p\/([^/]+)\/?$/.exec(new URL(given).pathname)?.[1] : undefined
  const code = segment?.replace(/%3a/gi, ':')

  return code && isCode(code) ? code : undefined
}

export function readCodes(code: string, entries: PaletteEntry[]): PaletteEntry[] {
  return fromCode(code).map((draft) => {
    const entry = paletteEntry(readOwnText(draft.name, paletteToml(draft), entries, true))

    if (!draft.catalog) {
      return entry
    }

    const problem = catalogProblem(draft.catalog)

    if (problem) {
      throw new Error(`the share code's catalog ${quoted(draft.catalog)} ${problem}`)
    }

    return { ...entry, catalog: draft.catalog }
  })
}

export function shareCode(drafts: readonly Draft[]): string {
  if (drafts.length === 0 || drafts.length > 255) {
    throw new Error(`a share link carries 1 to 255 palettes, not ${drafts.length}`)
  }

  const w = new Writer()
  w.u8(drafts.length)

  for (const d of drafts) {
    writeDraft(w, d)
    w.u8(d.other ? 1 : 0)

    for (const c of d.other ? colorList(d.other) : []) {
      w.color(c)
    }

    w.str(d.from)
  }

  const body = w.body()

  const [packed] = PACKS.map((pack, method) => Buffer.concat([Buffer.from([method]), pack(body)])).sort(
    (a, b) => a.length - b.length,
  )

  return `${CODE}${signed(packed as Buffer)}`
}

const colorList = (c: Colors) => [c.background, c.foreground, c.cursor, c.selection, ...c.ansi]

function writeDraft(w: Writer, d: Draft): void {
  w.str(d.name)

  for (const c of colorList(d)) {
    w.color(c)
  }

  for (const slot of d.signature) {
    w.u8(SLOTS.indexOf(slot))
  }

  w.str(d.base)
  w.str(d.catalog)
  w.str(d.ansiSource)
  w.str(d.booru)
  w.u16((d.waive ?? []).reduce((mask, rule) => mask | (1 << RULES.indexOf(rule)), 0))
  w.str(d.waive && d.waive.length > 0 ? d.reason : '')
  const pictures = d.pictures ?? []

  if (pictures.length > 255) {
    throw new Error(`a share code carries at most 255 pictures, and ${d.name} holds ${pictures.length}`)
  }

  w.u8(pictures.length)

  for (const p of pictures) {
    w.u8(SITES.findIndex((s) => s.key === p.site))
    w.u32(p.id)
    w.u16(p.size === undefined ? 0 : p.size === 'fill' ? 1 : p.size)
    w.u8(p.position === undefined ? 0 : (POSITIONS as readonly string[]).indexOf(p.position) + 1)
    w.u16(p.opacity === undefined ? 0 : Math.round(p.opacity * 1000) + 1)
  }
}

function versionProblem(code: string): Error {
  return new Error(
    isCode(code)
      ? `this ttheme reads ${CODE} share codes, not ${code.slice(0, code.indexOf(':') + 1)}`
      : `a share code starts with ${CODE}`,
  )
}

function readColors(r: Reader): Colors {
  const [background, foreground, cursor, selection, ...ansi] = Array.from({ length: 20 }, () => r.color()) as [
    string,
    string,
    string,
    string,
    ...string[],
  ]

  if (![background, foreground, cursor, selection, ...ansi].every(isHex)) {
    throw new Error('the share code holds a color that is not one')
  }

  return { background, foreground, cursor, selection, ansi }
}

export function fromCode(code: string): Draft[] {
  if (!code.startsWith(CODE)) {
    throw versionProblem(code)
  }

  const payload = payloadOf(code, CODE)
  const unpack = UNPACKS[payload[0] as number]

  if (!unpack) {
    throw new Error('the share code is packed in a way this ttheme does not read')
  }

  let body: Buffer

  try {
    body = unpack(payload.subarray(1))
  } catch {
    throw new Error('the share code does not unpack — was it copied whole?')
  }

  const r = new Reader(new Uint8Array(body))

  const drafts = Array.from({ length: r.u8() }, (): Draft => {
    const draft = readDraft(r)
    const carries = r.u8()

    if (carries > 1) {
      throw new Error('the share code holds a palette it cannot read — was it copied whole?')
    }

    const other = carries === 1 ? readColors(r) : undefined
    const from = r.str()

    return { ...draft, ...(other ? { other } : {}), ...(from ? { from } : {}) }
  })

  r.end()

  if (drafts.length === 0) {
    throw new Error('the share code holds no palette')
  }

  const twice = drafts.find((d, i) => drafts.findIndex((e) => e.name === d.name) !== i)

  if (twice) {
    throw new Error(`the share code holds ${twice.name} twice`)
  }

  return drafts
}

function readDraft(r: Reader): Draft {
  const name = r.str()
  const { background, foreground, cursor, selection, ansi } = readColors(r)

  const signature = [r.u8(), r.u8(), r.u8()].map((i) => SLOTS[i] ?? `slot${i}`)
  const base = r.str()
  const catalog = r.str()
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

  return {
    name,
    ...(base ? { base } : {}),
    ...(catalog ? { catalog } : {}),
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

function sectionOf(text: string, table: string): [number, number] | undefined {
  const head = new RegExp(`^\\[${table.replaceAll('.', '\\.')}\\][ \\t]*$`, 'm').exec(text)

  if (!head) {
    return undefined
  }

  const body = head.index + head[0].length
  const next = /^\[/m.exec(text.slice(body))

  return [head.index, next ? body + next.index : text.length]
}

const joined = (...parts: (string | undefined)[]) =>
  `${parts
    .map((part) => part?.trimEnd())
    .filter((part) => part)
    .join('\n\n')}\n`

export function withTable(text: string, table: string, block: string | undefined, after: string): string {
  const at = sectionOf(text, table)

  if (at) {
    return joined(text.slice(0, at[0]), block, text.slice(at[1]))
  }

  if (block === undefined) {
    return text
  }

  const anchor = sectionOf(text, after)

  if (!anchor) {
    throw new Error(`no [${after}] table to put [${table}] after`)
  }

  return joined(text.slice(0, anchor[1]), block, text.slice(anchor[1]))
}

export function recolor(text: string, colors: Colors, table = 'colors'): string {
  const at = sectionOf(text, table)

  if (!at) {
    throw new Error(`no [${table}] table to rewrite`)
  }

  const section = text.slice(at[0], at[1])
  const start = section.indexOf('ansi = [')
  const end = section.indexOf(']', start)

  if (start < 0 || end < 0) {
    throw new Error(`no ansi = [...] list in [${table}] to rewrite`)
  }

  let index = 0
  const block = section.slice(start, end).replace(/"#[0-9a-fA-F]{6}"/g, () => q(colors.ansi[index++] as string))

  const keys: [string, string][] = [
    ['background', colors.background],
    ['foreground', colors.foreground],
    ['cursor', colors.cursor],
    ['selection_background', colors.selection],
  ]

  const rewritten = keys.reduce(
    (out, [key, color]) =>
      out.replace(new RegExp(`^(${key}\\s*=\\s*)"#[0-9a-fA-F]{6}"`, 'm'), (_, head) => `${head}${q(color)}`),
    section.slice(0, start) + block + section.slice(end),
  )

  return text.slice(0, at[0]) + rewritten + text.slice(at[1])
}

export function withShade(text: string, colors: Colors, table: string): string {
  return sectionOf(text, table)
    ? recolor(text, colors, table)
    : withTable(text, table, colorsToml(colors, table).join('\n'), 'colors')
}

export function resign(text: string, signature: string[]): string {
  return text.replace(/^(signature\s*=\s*)\[[^\]]*\]/m, (_, head) => `${head}[${signature.map(q).join(', ')}]`)
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
