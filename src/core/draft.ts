import { SITES } from './booru.ts'
import { isHex } from './color.ts'
import type { PaletteEntry, UpstreamEntry } from './manifest.ts'
import { modeOf, otherOf } from './mode.ts'
import type { Colors } from './seeds.ts'
import { POSITIONS, readTheme, type SharedPicture, slugOf, type Theme } from './theme.ts'

export const CODE = 'tt8:'
export const SHARE_URL = 'https://ttheme.dev/builder/'
export const SUM = 4
export const UNPACKED = 64 * 1024

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

export interface Draft {
  name: string
  subject?: string
  upstream?: UpstreamEntry
  background: string
  foreground: string
  cursor: string
  selection: string
  ansi: string[]
  other?: Colors
  pictures?: SharedPicture[]
}

export interface Sealed {
  packed: Uint8Array
  sum: Uint8Array
}

const q = (value: string) => JSON.stringify(value)

const UPSTREAM_TABLE = /^\[upstream\.colors[\].]/m

function pictureToml(p: SharedPicture): string[] {
  return [
    '[[picture]]',
    `site = ${q(p.site)}`,
    `id = ${p.id}`,
    ...(p.size === undefined ? [] : [`size = ${typeof p.size === 'number' ? p.size : q(p.size)}`]),
    ...(p.position === undefined ? [] : [`position = ${q(p.position)}`]),
    ...(p.strength === undefined ? [] : [`strength = ${p.strength}`]),
  ]
}

export function withPictures(text: string, pictures: readonly SharedPicture[]): string {
  if (pictures.length === 0) {
    return text
  }

  const added = pictures.map((p) => `\n${pictureToml(p).join('\n')}\n`).join('')
  const at = text.search(UPSTREAM_TABLE)

  return at < 0
    ? `${text.replace(/\n*$/, '\n')}${added}`
    : `${text.slice(0, at).replace(/\n*$/, '\n')}${added}\n${text.slice(at)}`
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
  const head = [
    ...(d.subject ? [`subject = ${q(d.subject)}`] : []),
    ...(d.upstream ? [`upstream.palette = ${q(d.upstream.palette)}`] : []),
  ]

  const lines = [
    ...(head.length > 0 ? [...head, ''] : []),
    ...colorsToml(d, 'colors'),
    ...(d.other ? ['', ...colorsToml(d.other, `colors.${otherOf(modeOf(d))}`)] : []),
    ...(d.pictures ?? []).flatMap((p) => ['', ...pictureToml(p)]),
    ...(d.upstream?.colors ? ['', ...colorsToml(d.upstream.colors, 'upstream.colors')] : []),
    ...(d.upstream?.colors && d.upstream.other
      ? ['', ...colorsToml(d.upstream.other, `upstream.colors.${otherOf(modeOf(d.upstream.colors))}`)]
      : []),
  ]

  return `${lines.join('\n')}\n`
}

export function draftOf(entry: PaletteEntry, name = entry.name): Draft {
  return {
    name,
    ...(entry.subject ? { subject: entry.subject } : {}),
    ...(entry.upstream ? { upstream: entry.upstream } : {}),
    background: entry.background,
    foreground: entry.foreground,
    cursor: entry.cursor,
    selection: entry.selection,
    ansi: entry.ansi,
    ...(entry.other ? { other: entry.other } : {}),
    ...(entry.pictures ? { pictures: entry.pictures } : {}),
  }
}

export function readOwnText(name: string, source: string, foreign = false): Theme {
  return readTheme(slugOf(name), source, { name, ...(foreign ? { foreign: true as const } : {}) })
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

  w.str(d.subject)
  w.str(d.upstream?.palette)
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
    w.u16(p.strength === undefined ? 0 : Math.round(p.strength * 100) + 1)
  }

  w.u8(d.other ? 1 : 0)

  for (const c of d.other ? colorList(d.other) : []) {
    w.color(c)
  }

  const made = colorList(d)
  const bases = d.upstream?.colors ? [d.upstream.colors, ...(d.upstream.other ? [d.upstream.other] : [])] : []
  w.u8(bases.length)

  for (const [at, base] of bases.entries()) {
    const against = at === 1 && d.other ? colorList(d.other) : made
    const moved = colorList(base).flatMap((c, slot) => (c.toLowerCase() === against[slot]?.toLowerCase() ? [] : [slot]))
    w.u8(moved.length)

    for (const slot of moved) {
      w.u8(slot)
      w.color(colorList(base)[slot] as string)
    }
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

function colorsFromList([background, foreground, cursor, selection, ...ansi]: string[]): Colors {
  return {
    background: background as string,
    foreground: foreground as string,
    cursor: cursor as string,
    selection: selection as string,
    ansi,
  }
}

function readDraft(r: Reader): Draft {
  const name = r.str()
  const { background, foreground, cursor, selection, ansi } = readColors(r)
  const subject = r.str()
  const upstream = r.str()

  const pictures = Array.from({ length: r.u8() }, (): SharedPicture => {
    const site = SITES[r.u8()]?.key ?? 'unknown'
    const id = r.u32()
    const size = r.u16()
    const position = r.u8()
    const strength = r.u16()

    return {
      site,
      id,
      ...(size === 1 ? { size: 'fill' as const } : size > 1 ? { size } : {}),
      ...(position > 0 ? { position: POSITIONS[position - 1] ?? 'unknown' } : {}),
      ...(strength > 0 ? { strength: (strength - 1) / 100 } : {}),
    }
  })

  const carries = r.u8()

  if (carries > 1) {
    throw new Error('the share code holds a palette it cannot read — was it copied whole?')
  }

  const other = carries === 1 ? readColors(r) : undefined
  const made = [background, foreground, cursor, selection, ...ansi]

  const bases = Array.from({ length: r.u8() }, (_, at) => {
    const list = [...(at === 1 && other ? colorList(other) : made)]

    for (let left = r.u8(); left > 0; left--) {
      const slot = r.u8()
      const color = r.color()

      if (slot >= list.length || !isHex(color)) {
        throw new Error('the share code holds an upstream color it cannot place')
      }

      list[slot] = color
    }

    return colorsFromList(list)
  })

  if (bases.length > 2 || (bases.length > 0 && !upstream)) {
    throw new Error('the share code holds a palette it cannot read — was it copied whole?')
  }

  const [base, baseOther] = bases

  return {
    name,
    ...(subject ? { subject } : {}),
    ...(upstream
      ? {
          upstream: {
            palette: upstream,
            ...(base ? { colors: base } : {}),
            ...(baseOther ? { other: baseOther } : {}),
          },
        }
      : {}),
    background,
    foreground,
    cursor,
    selection,
    ansi,
    ...(other ? { other } : {}),
    ...(pictures.length > 0 ? { pictures } : {}),
  }
}

export function draftsOf(body: Uint8Array): Draft[] {
  const r = new Reader(body)
  const drafts = Array.from({ length: r.u8() }, () => readDraft(r))

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
