import { parse } from 'smol-toml'
import { SITES } from './booru.ts'
import { type Hex, isHex } from './color.ts'
import { MODES, modeOf, otherOf } from './mode.ts'
import { escaped, quoted } from './text.ts'

export interface GhosttyExtras {
  iconGhost: Hex
  iconScreen: Hex[]
}

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
  opacity?: number
}

export interface Theme {
  name: string
  subject?: string
  from?: string
  ansiSource: string
  background: Hex
  foreground: Hex
  cursor: Hex
  selectionBackground: Hex
  ansi: Hex[]
  other?: Shade
  signature: Hex[]
  signatureSlots: string[]
  ghostty: GhosttyExtras
  waive: string[]
  waiveReason?: string
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
const SIGNATURE_SIZE = 3
const MAX_PICTURES = 8
const SLUG = '[a-z0-9]+(?:-[a-z0-9]+)*'
const SLUG_ONLY = new RegExp(`^${SLUG}$`)
const NAME = new RegExp(`^(?:${BUILTIN}|(${SLUG})@(${SLUG}))/(${SLUG})$`)
const SUBJECT = new RegExp(`^(${SLUG})(?:/(${SLUG}))?$`)
const NAMED_SLOTS = ['background', 'foreground', 'cursor', 'selection'] as const

type NamedSlot = (typeof NAMED_SLOTS)[number]

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

interface IconColors {
  background: Hex
  cursor: Hex
  selectionBackground: Hex
}

function readIconScreen(file: string, value: unknown, colors: IconColors): Hex[] {
  if (value === undefined) {
    return [colors.cursor, colors.selectionBackground, colors.background]
  }

  const raw = Array.isArray(value) ? value : [value]

  if (raw.length === 0) fail(file, 'ghostty.icon_screen must not be empty')

  return raw.map((c, i) => hex(file, `ghostty.icon_screen[${i}]`, c))
}

function readGhostty(file: string, own: unknown, colors: IconColors): GhosttyExtras {
  const g = table(own)

  return {
    iconGhost: g.icon_ghost === undefined ? colors.cursor : hex(file, 'ghostty.icon_ghost', g.icon_ghost),
    iconScreen: readIconScreen(file, g.icon_screen, colors),
  }
}

type Slots = Record<NamedSlot, Hex> & { ansi: Hex[] }

interface Signature {
  names: string[]
  colors: Hex[]
}

function slotColors(slots: Slots): Map<string, Hex> {
  return new Map<string, Hex>([
    ...NAMED_SLOTS.map((slot): [string, Hex] => [slot, slots[slot]]),
    ...slots.ansi.map((color, index): [string, Hex] => [`ansi${index}`, color]),
  ])
}

function readSignature(file: string, value: unknown, slots: Slots): Signature {
  if (!Array.isArray(value) || value.length !== SIGNATURE_SIZE) {
    fail(file, `signature must name exactly ${SIGNATURE_SIZE} of the palette's colors`)
  }

  const known = slotColors(slots)
  const names: string[] = []
  const colors: Hex[] = []

  for (const [i, raw] of value.entries()) {
    const field = `signature[${i}]`
    const slot = str(file, field, raw)
    const color = known.get(slot)

    if (color === undefined) {
      fail(
        file,
        `${field} ${quoted(slot)} is not one of the palette's colors — use ${NAMED_SLOTS.join(', ')} or ansi0-ansi15`,
      )
    }

    names.push(slot)
    colors.push(color)
  }

  if (new Set(colors).size !== colors.length) {
    fail(file, 'signature must name three colors that differ')
  }

  return { names, colors }
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

    const { size, position, opacity } = t

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

    if (opacity !== undefined && !(typeof opacity === 'number' && opacity >= 0 && opacity <= 1)) {
      fail(file, `${field}.opacity must be a number from 0 to 1`)
    }

    return [
      {
        site: site.key,
        id: t.id,
        ...(size !== undefined ? { size: size as 'fill' | number } : {}),
        ...(position !== undefined && known ? { position: position as string } : {}),
        ...(opacity !== undefined ? { opacity: opacity as number } : {}),
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
  ['', ['$schema', 'subject', 'from', 'signature', 'ansi_source', 'colors', 'contrast', 'ghostty', 'picture']],
  ['colors', ['background', 'foreground', 'cursor', 'selection_background', 'ansi', ...MODES]],
  ...MODES.map((mode): [string, string[]] => [
    `colors.${mode}`,
    ['background', 'foreground', 'cursor', 'selection_background', 'ansi'],
  ]),
  ['contrast', ['waive', 'reason']],
  ['ghostty', ['icon_ghost', 'icon_screen']],
  ['picture', ['site', 'id', 'size', 'position', 'opacity']],
])

export function oddKeys(path: string, value: unknown, known: readonly string[] = []): string[] {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? Object.keys(value)
        .filter((key) => !known.includes(key))
        .map((key) => (path ? `${path}.${key}` : key))
    : []
}

export function unknownKeys(file: string, source: string): string[] {
  const doc = toml(file, source)

  return [
    ...oddKeys('', doc, PALETTE_KEYS.get('')),
    ...['colors', 'contrast', 'ghostty'].flatMap((name) => oddKeys(name, doc[name], PALETTE_KEYS.get(name))),
    ...MODES.flatMap((mode) => oddKeys(`colors.${mode}`, table(doc.colors)[mode], PALETTE_KEYS.get(`colors.${mode}`))),
    ...(Array.isArray(doc.picture) ? doc.picture : []).flatMap((p, i) =>
      oddKeys(`picture[${i}]`, p, PALETTE_KEYS.get('picture')),
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

function readOther(file: string, colors: Record<string, unknown>, own: Shade, signature: string[]): Shade | undefined {
  const mode = modeOf(own)
  const want = otherOf(mode)

  if (colors[mode] !== undefined) {
    fail(file, `[colors] is already ${mode} — the palette's other mode goes in [colors.${want}]`)
  }

  if (colors[want] === undefined) {
    return undefined
  }

  const other = readShade(file, `colors.${want}`, table(colors[want]))

  if (modeOf(other) !== want) {
    fail(
      file,
      `[colors.${want}] must be ${want}: its background is ${modeOf(other) === 'light' ? 'lighter' : 'darker'} than its foreground`,
    )
  }

  const known = slotColors({ ...other, selection: other.selectionBackground })

  if (new Set(signature.map((slot) => known.get(slot))).size !== signature.length) {
    fail(file, `signature must name three colors that differ in [colors.${want}] too`)
  }

  return other
}

export function readTheme(file: string, source: string, place: Place): Theme {
  const doc = toml(file, source)
  const colors = table(doc.colors)
  const contrastRules = table(doc.contrast)
  const builtin = place.builtin === true
  const subject = subjectOf(file, doc.subject)
  const origin = doc.from === undefined ? undefined : paletteName(file, 'from', doc.from)
  const own = readShade(file, 'colors', colors)
  const { background, foreground, cursor, selectionBackground, ansi } = own

  const signature = readSignature(file, doc.signature, {
    background,
    foreground,
    cursor,
    selection: selectionBackground,
    ansi,
  })

  const other = readOther(file, colors, own, signature.names)

  if (builtin && other === undefined) {
    fail(
      file,
      `a built-in palette carries its other mode in [colors.${otherOf(modeOf(own))}] — bun .claude/skills/palette/scripts/light.ts --write writes it`,
    )
  }

  const waive = Array.isArray(contrastRules.waive) ? contrastRules.waive.map(String) : []

  if (waive.length > 0 && typeof contrastRules.reason !== 'string') {
    fail(file, 'contrast.waive needs a contrast.reason explaining why')
  }

  const pictures = readPictures(file, doc.picture, place.foreign === true)

  return {
    name: place.name,
    ...(subject ? { subject } : {}),
    ...(origin ? { from: origin } : {}),
    ansiSource: !builtin && doc.ansi_source === undefined ? 'original' : text(file, 'ansi_source', doc.ansi_source),
    background,
    foreground,
    cursor,
    selectionBackground,
    ansi,
    ...(other ? { other } : {}),
    signature: signature.colors,
    signatureSlots: signature.names,
    ghostty: readGhostty(file, doc.ghostty, {
      background,
      cursor,
      selectionBackground,
    }),
    waive,
    waiveReason: typeof contrastRules.reason === 'string' ? contrastRules.reason : undefined,
    ...(pictures ? { pictures } : {}),
  }
}

export function inOther(theme: Theme): Theme[] {
  const { other, ...rest } = theme

  if (other === undefined) {
    return []
  }

  const known = slotColors({ ...other, selection: other.selectionBackground })

  return [{ ...rest, ...other, signature: theme.signatureSlots.map((slot) => known.get(slot) as Hex) }]
}

export function rotation(themes: Theme[], fallback?: string): Theme[] {
  return themes.filter((t) => t.name !== fallback)
}

export const MARKETPLACE_SCHEMA_URL = 'https://www.schemastore.org/ttheme-marketplace.json'
export const PALETTE_SCHEMA_URL = 'https://www.schemastore.org/ttheme-palette.json'
export const WORK_SCHEMA_URL = 'https://www.schemastore.org/ttheme-work.json'
