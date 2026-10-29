import { parse } from 'smol-toml'
import { SITES } from './booru.ts'
import { type Hex, isHex } from './color.ts'
import { MODES, modeOf, otherOf } from './mode.ts'
import { escaped, quoted } from './text.ts'

export const POSITIONS = [
  'top-left',
  'top-center',
  'top-right',
  'center-left',
  'center',
  'center-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
] as const

export interface SharedPicture {
  site: string
  id: number
  size?: 'fill' | number
  position?: string
  strength?: number
}

export interface Upstream {
  palette: string
  colors?: Shade
  other?: Shade
}

export interface Theme {
  name: string
  subject?: string
  upstream?: Upstream
  background: Hex
  foreground: Hex
  cursor: Hex
  selectionBackground: Hex
  ansi: Hex[]
  other?: Shade
  pictures?: SharedPicture[]
}

export type Shade = Pick<Theme, 'background' | 'foreground' | 'cursor' | 'selectionBackground' | 'ansi'>

export interface Place {
  name: string
  builtin?: true
  foreign?: true
}

export const BUILTIN = 'ttheme'
export const MARKETPLACE_FILE = 'ttheme-marketplace.toml'
const MAX_PICTURES = 255
export const MAX_STRENGTH = 100
const SLUG = '[a-z0-9]+(?:-[a-z0-9]+)*'
const SLUG_ONLY = new RegExp(`^${SLUG}$`)
const NAME = new RegExp(`^(?:${BUILTIN}|(${SLUG})@(${SLUG}))/(${SLUG})$`)
const SUBJECT = new RegExp(`^(${SLUG})(?:/(${SLUG}))?$`)

export function fail(file: string, message: string): never {
  throw new Error(`${escaped(file)}: ${message}`)
}

export function echo(value: unknown): string {
  return escaped(JSON.stringify(value) ?? String(value))
}

function hex(file: string, field: string, value: unknown): Hex {
  if (typeof value !== 'string' || !isHex(value)) {
    fail(file, `${field} must be "#rrggbb" (lowercase), got ${echo(value)}`)
  }

  return value
}

export function str(file: string, field: string, value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    fail(file, `${field} must be a non-empty string`)
  }

  return value
}

export const STEM_RULES = [
  ['@', '--'],
  ['/', '--'],
] as const

export function stem(name: string): string {
  return STEM_RULES.reduce((value, [from, to]) => value.replace(from, to), name)
}

export function owned(name: string): string {
  return `ttheme-${stem(name)}`
}

export interface Identity {
  owner: string
  name: string
}

export function marketplaceId({ owner, name }: Identity): string {
  return `${owner}@${name}`
}

export function publisherOf(name: string): string {
  const at = name.indexOf('/')

  return at < 0 ? '' : name.slice(0, at)
}

export function slugOf(name: string): string {
  return name.slice(name.indexOf('/') + 1)
}

export function isBuiltin(name: string): boolean {
  return publisherOf(name) === BUILTIN
}

export function nameProblem(name: string): string | undefined {
  const m = NAME.exec(name)

  if (!m) {
    return `takes lowercase letters, digits and single hyphens, as ${BUILTIN}/<palette> or <owner>@<marketplace>/<palette>`
  }

  if ((m[1]?.length ?? 0) > 39) {
    return 'has an owner longer than a GitHub handle can be'
  }

  return (m[2]?.length ?? 0) > 40 || (m[3]?.length ?? 0) > 40 ? 'is longer than 40 characters' : undefined
}

export function slugProblem(slug: string): string | undefined {
  if (!SLUG_ONLY.test(slug)) {
    return 'takes lowercase letters, digits and single hyphens'
  }

  return slug.length > 40 ? 'is longer than 40 characters' : undefined
}

export function subjectProblem(subject: string): string | undefined {
  const m = SUBJECT.exec(subject)

  if (!m) {
    return 'names a work or a work and its character, as <work> or <work>/<character>, in lowercase letters, digits and single hyphens'
  }

  if (m[1] === BUILTIN) {
    return `cannot be ${BUILTIN}, the built-in marketplace's name`
  }

  return (m[1]?.length ?? 0) > 40 || (m[2]?.length ?? 0) > 40 ? 'is longer than 40 characters' : undefined
}

export function workIdOf(subject: string): string {
  const at = subject.indexOf('/')

  return at < 0 ? subject : subject.slice(0, at)
}

export function characterIdOf(subject: string): string | undefined {
  const at = subject.indexOf('/')

  return at < 0 ? undefined : subject.slice(at + 1)
}

export function textProblem(value: string): string | undefined {
  if (/[\p{Cc}\p{Bidi_Control}"$`\\]/u.test(value)) {
    return 'holds a control character, a direction mark, a quote, $, ` or \\'
  }

  return value.length > 80 ? 'is longer than 80 characters' : undefined
}

export function text(file: string, field: string, value: unknown): string {
  const s = str(file, field, value)
  const problem = textProblem(s)

  if (problem) {
    fail(file, `${field} ${quoted(s)} ${problem}`)
  }

  return s
}

function paletteName(file: string, field: string, value: unknown): string {
  const name = str(file, field, value)
  const problem = nameProblem(name)

  if (problem) {
    fail(file, `${field} ${quoted(name)} ${problem}`)
  }

  return name
}

function subjectOf(file: string, value: unknown): string | undefined {
  if (value === undefined) {
    return undefined
  }

  const subject = str(file, 'subject', value)
  const problem = subjectProblem(subject)

  if (problem) {
    fail(file, `subject ${quoted(subject)} ${problem}`)
  }

  return subject
}

export function table(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function readPictures(file: string, raw: unknown, foreign: boolean): SharedPicture[] | undefined {
  if (raw === undefined) {
    return undefined
  }

  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_PICTURES) {
    fail(file, `[[picture]] holds 1 to ${MAX_PICTURES} pictures`)
  }

  const pictures = raw.flatMap((entry, i): SharedPicture[] => {
    const t = table(entry)
    const field = `picture[${i}]`
    const site = SITES.find((s) => s.key === t.site)

    if (!site) {
      if (foreign) {
        return []
      }

      fail(file, `${field}.site must be one of ${SITES.map((s) => s.key).join(', ')}`)
    }

    if (typeof t.id !== 'number' || !Number.isSafeInteger(t.id) || t.id <= 0) {
      fail(file, `${field}.id must be the post's number on ${site.name}`)
    }

    const { size, position, strength } = t

    if (
      size !== undefined &&
      size !== 'fill' &&
      !(Number.isInteger(size) && Number(size) >= 20 && Number(size) <= 999)
    ) {
      fail(file, `${field}.size must be "fill" or a percentage from 20 to 999`)
    }

    const known = position === undefined || (POSITIONS as readonly unknown[]).includes(position)

    if (!known && !foreign) {
      fail(file, `${field}.position must be one of ${POSITIONS.join(', ')}`)
    }

    if (strength !== undefined && !(typeof strength === 'number' && strength >= 0 && strength <= MAX_STRENGTH)) {
      fail(file, `${field}.strength must be a number from 0 to ${MAX_STRENGTH}`)
    }

    return [
      {
        site: site.key,
        id: t.id,
        ...(size !== undefined ? { size: size as 'fill' | number } : {}),
        ...(position !== undefined && known ? { position: position as string } : {}),
        ...(strength !== undefined ? { strength: strength as number } : {}),
      },
    ]
  })

  return pictures.length > 0 ? pictures : undefined
}

export function toml(file: string, source: string): Record<string, unknown> {
  try {
    return parse(source) as Record<string, unknown>
  } catch (error) {
    fail(file, `is not valid TOML — ${(error instanceof Error ? error.message : String(error)).split('\n')[0]}`)
  }
}

export const PALETTE_KEYS = new Map([
  ['', ['slug', 'subject', 'upstream', 'colors', 'picture']],
  ['colors', ['background', 'foreground', 'cursor', 'selection_background', 'ansi', ...MODES]],
  ...MODES.map((mode): [string, string[]] => [
    `colors.${mode}`,
    ['background', 'foreground', 'cursor', 'selection_background', 'ansi'],
  ]),
  ['picture', ['site', 'id', 'size', 'position', 'strength']],
  ['upstream', ['palette', 'colors']],
  ['upstream.colors', ['background', 'foreground', 'cursor', 'selection_background', 'ansi', ...MODES]],
  ...MODES.map((mode): [string, string[]] => [
    `upstream.colors.${mode}`,
    ['background', 'foreground', 'cursor', 'selection_background', 'ansi'],
  ]),
])

export function oddKeys(path: string, value: unknown, known: readonly string[] = []): string[] {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? Object.keys(value)
        .filter((key) => !known.includes(key))
        .map((key) => (path ? `${path}.${key}` : key))
    : []
}

export function paletteOddKeys(doc: Record<string, unknown>): string[] {
  return [
    ...oddKeys('', doc, PALETTE_KEYS.get('')),
    ...oddKeys('colors', doc.colors, PALETTE_KEYS.get('colors')),
    ...MODES.flatMap((mode) => oddKeys(`colors.${mode}`, table(doc.colors)[mode], PALETTE_KEYS.get(`colors.${mode}`))),
    ...(Array.isArray(doc.picture) ? doc.picture : []).flatMap((p, i) =>
      oddKeys(`picture[${i}]`, p, PALETTE_KEYS.get('picture')),
    ),
    ...oddKeys('upstream', doc.upstream, PALETTE_KEYS.get('upstream')),
    ...oddKeys('upstream.colors', table(doc.upstream).colors, PALETTE_KEYS.get('upstream.colors')),
    ...MODES.flatMap((mode) =>
      oddKeys(
        `upstream.colors.${mode}`,
        table(table(doc.upstream).colors)[mode],
        PALETTE_KEYS.get(`upstream.colors.${mode}`),
      ),
    ),
  ]
}

function readShade(file: string, path: string, raw: Record<string, unknown>): Shade {
  const ansi = raw.ansi

  if (!Array.isArray(ansi) || ansi.length !== 16) {
    fail(file, `${path}.ansi must hold exactly 16 colors, got ${Array.isArray(ansi) ? ansi.length : typeof ansi}`)
  }

  return {
    background: hex(file, `${path}.background`, raw.background),
    foreground: hex(file, `${path}.foreground`, raw.foreground),
    cursor: hex(file, `${path}.cursor`, raw.cursor),
    selectionBackground: hex(file, `${path}.selection_background`, raw.selection_background),
    ansi: ansi.map((c, i) => hex(file, `${path}.ansi[${i}]`, c)),
  }
}

function readOther(file: string, colors: Record<string, unknown>, own: Shade): Shade | undefined {
  const mode = modeOf(own)
  const want = otherOf(mode)

  if (colors[mode] !== undefined) {
    fail(file, `[palette.colors] is already ${mode} — the palette's other mode goes in [palette.colors.${want}]`)
  }

  if (colors[want] === undefined) {
    return undefined
  }

  const other = readShade(file, `colors.${want}`, table(colors[want]))

  if (modeOf(other) !== want) {
    fail(
      file,
      `[palette.colors.${want}] must be ${want}: its background is ${modeOf(other) === 'light' ? 'lighter' : 'darker'} than its foreground`,
    )
  }

  return other
}

function readUpstream(file: string, raw: unknown, name: string): Upstream | undefined {
  if (raw === undefined) {
    return undefined
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    fail(file, 'upstream is a table — upstream.palette = "<marketplace>/<palette>"')
  }

  const up = raw as Record<string, unknown>
  const palette = paletteName(file, 'upstream.palette', up.palette)

  if (palette === name) {
    fail(file, `upstream.palette names ${name} itself`)
  }

  if (up.colors === undefined) {
    return { palette }
  }

  const colors = table(up.colors)
  const base = readShade(file, 'upstream.colors', colors)
  const mode = modeOf(base)
  const want = otherOf(mode)

  if (colors[mode] !== undefined) {
    fail(
      file,
      `[palette.upstream.colors] is already ${mode} — its other mode goes in [palette.upstream.colors.${want}]`,
    )
  }

  if (colors[want] === undefined) {
    return { palette, colors: base }
  }

  const other = readShade(file, `upstream.colors.${want}`, table(colors[want]))

  if (modeOf(other) !== want) {
    fail(file, `[palette.upstream.colors.${want}] must be ${want}`)
  }

  return { palette, colors: base, other }
}

export function readTheme(file: string, source: string, place: Place): Theme {
  return themeOf(file, toml(file, source), place)
}

export function themeOf(file: string, doc: Record<string, unknown>, place: Place): Theme {
  const colors = table(doc.colors)
  const builtin = place.builtin === true
  const subject = subjectOf(file, doc.subject)
  const upstream = readUpstream(file, doc.upstream, place.name)
  const own = readShade(file, 'colors', colors)
  const { background, foreground, cursor, selectionBackground, ansi } = own
  const other = readOther(file, colors, own)

  if (builtin && other === undefined) {
    fail(
      file,
      `a built-in palette carries its other mode in [palette.colors.${otherOf(modeOf(own))}] — bun .agents/skills/palette/scripts/light.ts --write <its set> writes it`,
    )
  }

  const pictures = readPictures(file, doc.picture, place.foreign === true)

  return {
    name: place.name,
    ...(subject ? { subject } : {}),
    ...(upstream ? { upstream } : {}),
    background,
    foreground,
    cursor,
    selectionBackground,
    ansi,
    ...(other ? { other } : {}),
    ...(pictures ? { pictures } : {}),
  }
}

export function inOther(theme: Theme): Theme[] {
  const { other, ...rest } = theme

  return other === undefined ? [] : [{ ...rest, ...other }]
}

export const MARKETPLACE_SCHEMA_URL = 'https://www.schemastore.org/ttheme-marketplace.json'
export const WORK_SCHEMA_URL = 'https://www.schemastore.org/ttheme-work.json'
