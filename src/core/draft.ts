import { SITES } from './booru.ts'
import { isHex } from './color.ts'
import { RULES } from './contrast.ts'
import type { PaletteEntry } from './manifest.ts'
import { modeOf, otherOf } from './mode.ts'
import type { Colors } from './seeds.ts'
import {
  type Catalog,
  marketplaceOf,
  nameProblem,
  PALETTE_SCHEMA_URL,
  type Place,
  POSITIONS,
  readTheme,
  type SharedPicture,
  slugOf,
  type Theme,
  toml,
} from './theme.ts'

export const CODE = 'tt4:'
export const SHARE_URL = 'https://ttheme.dev/builder/'
export const SUM = 4
export const UNPACKED = 64 * 1024

const SLOTS = ['background', 'foreground', 'cursor', 'selection', ...Array.from({ length: 16 }, (_, i) => `ansi${i}`)]

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

export interface Draft {
  name: string
  nativeNames?: string[]
  order?: number
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

export interface Shelf {
  catalog?: string
  catalogs?: readonly Catalog[]
}

export interface Sealed {
  packed: Uint8Array
  sum: Uint8Array
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
    ...(d.nativeNames ? [`native_names = [${d.nativeNames.map(q).join(', ')}]`] : []),
    ...(d.order === undefined ? [] : [`order = ${d.order}`]),
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

export function basesOf(entries: PaletteEntry[]): Map<string, { order: number }> {
  return new Map(
    entries.flatMap((e) => (e.default || marketplaceOf(e.name) ? [] : [[e.name, { order: e.order }] as const])),
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

export function paletteSlug(file: string, text: string): string {
  const meta = toml(file, text).meta
  const slug = meta && typeof meta === 'object' && 'name' in meta ? meta.name : undefined

  if (typeof slug !== 'string' || nameProblem(slug)) {
    throw new Error(`${file} names no palette — its [meta] needs name = "<palette>"`)
  }

  return slug
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

  body(): Uint8Array {
    return Uint8Array.from(this.bytes)
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

export function base64url(bytes: Uint8Array): string {
  let out = ''

  for (let at = 0; at < bytes.length; at += 3) {
    const a = bytes[at] as number
    const b = bytes[at + 1]
    const c = bytes[at + 2]
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0)
    out += BASE64[n >> 18] + (BASE64[(n >> 12) & 63] as string)

    if (b !== undefined) out += BASE64[(n >> 6) & 63]

    if (c !== undefined) out += BASE64[n & 63]
  }

  return out
}

export function fromBase64url(text: string): Uint8Array {
  const out: number[] = []

  for (let at = 0; at + 1 < text.length; at += 4) {
    const [a = 0, b = 0, c, d] = [...text.slice(at, at + 4)].map((ch) => BASE64.indexOf(ch))
    out.push(((a << 2) | (b >> 4)) & 255)

    if (c !== undefined) out.push(((b << 4) | (c >> 2)) & 255)

    if (d !== undefined && c !== undefined) out.push(((c << 6) | d) & 255)
  }

  return Uint8Array.from(out)
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

export function codeBody(drafts: readonly Draft[]): Uint8Array {
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

  return w.body()
}

export function smallest(packs: readonly Uint8Array[]): Uint8Array {
  const [packed] = packs
    .map((bytes, method) => {
      const out = new Uint8Array(bytes.length + 1)
      out[0] = method
      out.set(bytes, 1)

      return out
    })
    .sort((a, b) => a.length - b.length)

  return packed as Uint8Array
}

export function sealed(packed: Uint8Array, digest: Uint8Array): string {
  const out = new Uint8Array(packed.length + SUM)
  out.set(packed)
  out.set(digest.subarray(0, SUM), packed.length)

  return `${CODE}${base64url(out)}`
}

function isCode(text: string): boolean {
  return /^tt\d+:/.test(text)
}

function versionProblem(code: string): Error {
  return new Error(
    isCode(code)
      ? `this ttheme reads ${CODE} share codes, not ${code.slice(0, code.indexOf(':') + 1)}`
      : `a share code starts with ${CODE}`,
  )
}

export function opened(code: string): Sealed {
  if (!code.startsWith(CODE)) {
    throw versionProblem(code)
  }

  const body = code.slice(CODE.length)

  if (!/^[A-Za-z0-9_-]+$/.test(body)) {
    throw new Error('the share code holds characters it never uses — was it copied whole?')
  }

  const bytes = fromBase64url(body)

  if (bytes.length <= SUM) {
    throw new Error('the share code is cut short')
  }

  return { packed: bytes.subarray(0, -SUM), sum: bytes.subarray(-SUM) }
}

export function checked({ packed, sum }: Sealed, digest: Uint8Array): Uint8Array {
  if (!sum.every((byte, i) => byte === digest[i])) {
    throw new Error('the share code does not add up — was it copied whole?')
  }

  return packed
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

export function draftsOf(body: Uint8Array): Draft[] {
  const r = new Reader(body)

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

export function shareLink(code: string): string {
  return `${SHARE_URL}${code}`
}

export function codeOf(text: string): string | undefined {
  const given = text.trim()

  if (!/^https?:\/\//i.test(given)) {
    return isCode(given) ? given : undefined
  }

  const segment = URL.canParse(given) ? /^\/builder\/([^/]+)\/?$/.exec(new URL(given).pathname)?.[1] : undefined
  const code = segment?.replace(/%3a/gi, ':')

  return code && isCode(code) ? code : undefined
}
