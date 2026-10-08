import { readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { parse } from 'smol-toml'
import { SITES } from './booru.ts'
import { type Hex, isHex } from './color.ts'

export interface GhosttyExtras {
  iconGhost: Hex
  iconScreen: Hex[]
}

export interface Catalog {
  name: string
  native?: string
  lead?: string
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
  base?: string
  catalog?: string
  native?: string
  nativeNames?: string[]
  lead: boolean
  order: number
  role?: 'default'
  ansiSource: string
  booru?: string
  booruSites?: Record<string, string[]>
  background: Hex
  foreground: Hex
  cursor: Hex
  selectionBackground: Hex
  ansi: Hex[]
  signature: Hex[]
  signatureSlots: string[]
  ghostty: GhosttyExtras
  waive: string[]
  waiveReason?: string
  pictures?: SharedPicture[]
}

export interface Place {
  name: string
  catalog?: string
  catalogs: ReadonlyMap<string, Catalog>
  bases?: ReadonlyMap<string, { order: number }>
  open?: true
  foreign?: true
}

export const MARKETPLACE_FILE = 'ttheme-marketplace.toml'
const SHARED_ORDER = 1_000_000
const SIGNATURE_SIZE = 3
const MAX_PICTURES = 8
const SLUG = '[a-z0-9]+(?:-[a-z0-9]+)*'
const NAME = new RegExp(`^(?:(${SLUG})@(${SLUG})/)?(${SLUG})$`)
const NAMED_SLOTS = ['background', 'foreground', 'cursor', 'selection'] as const

type NamedSlot = (typeof NAMED_SLOTS)[number]

function fail(file: string, message: string): never {
  throw new Error(`${file}: ${message}`)
}

function hex(file: string, field: string, value: unknown): Hex {
  if (typeof value !== 'string' || !isHex(value)) {
    fail(file, `${field} must be "#rrggbb" (lowercase), got ${JSON.stringify(value)}`)
  }
  return value
}

function str(file: string, field: string, value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    fail(file, `${field} must be a non-empty string`)
  }
  return value
}

export function stem(name: string): string {
  return name.replace('@', '--').replace('/', '--')
}

export function owned(name: string): string {
  return `ttheme-${stem(name)}`
}

export function marketplaceOf(name: string): string | undefined {
  const at = name.indexOf('/')
  return at < 0 ? undefined : name.slice(0, at)
}

export function slugOf(name: string): string {
  return name.slice(name.indexOf('/') + 1)
}

export function nameProblem(name: string): string | undefined {
  const m = NAME.exec(name)
  if (!m) {
    return 'takes lowercase letters, digits and single hyphens, as <palette> or <owner>@<marketplace>/<palette>'
  }
  if ((m[1]?.length ?? 0) > 39) {
    return 'has an owner longer than a GitHub handle can be'
  }
  return (m[2]?.length ?? 0) > 40 || (m[3]?.length ?? 0) > 40 ? 'is longer than 40 characters' : undefined
}

export function textProblem(value: string): string | undefined {
  if (/[\p{Cc}"$`\\]/u.test(value)) {
    return 'holds a control character, a quote, $, ` or \\'
  }
  return value.length > 80 ? 'is longer than 80 characters' : undefined
}

function text(file: string, field: string, value: unknown): string {
  const s = str(file, field, value)
  const problem = textProblem(s)
  if (problem) {
    fail(file, `${field} ${JSON.stringify(s)} ${problem}`)
  }
  return s
}

function paletteName(file: string, field: string, value: unknown): string {
  const name = str(file, field, value)
  const problem = nameProblem(name)
  if (problem) {
    fail(file, `${field} "${name}" ${problem}`)
  }
  return name
}

function table(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
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
    fail(file, `meta.signature must name exactly ${SIGNATURE_SIZE} palette slots`)
  }
  const known = slotColors(slots)
  const names: string[] = []
  const colors: Hex[] = []
  for (const [i, raw] of value.entries()) {
    const field = `meta.signature[${i}]`
    const slot = str(file, field, raw)
    const color = known.get(slot)
    if (color === undefined) {
      fail(
        file,
        `${field} ${JSON.stringify(raw)} is not a palette slot — use ${NAMED_SLOTS.join(', ')} or ansi0-ansi15`,
      )
    }
    names.push(slot)
    colors.push(color)
  }
  if (new Set(colors).size !== colors.length) {
    fail(file, 'meta.signature slots must resolve to three different colors')
  }
  return { names, colors }
}

export function readBooruSites(
  file: string,
  raw: unknown,
  booru: string | undefined,
  foreign = false,
): Record<string, string[]> | undefined {
  if (raw === undefined) {
    return undefined
  }
  if (!booru) {
    fail(file, 'meta.booru_sites renames meta.booru per site, so it needs meta.booru')
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    fail(file, 'meta.booru_sites must be a table of site = "tag" or site = ["tag", ...]')
  }
  const sites: Record<string, string[]> = {}
  for (const [key, value] of Object.entries(raw)) {
    const site = SITES.find((s) => s.key === key)
    if (!site) {
      if (foreign) {
        continue
      }
      fail(file, `meta.booru_sites.${key} is not a find site — use ${SITES.map((s) => s.key).join(', ')}`)
    }
    const names = typeof value === 'string' ? [value] : Array.isArray(value) ? value : undefined
    if (!names || names.some((name) => typeof name !== 'string' || name === '' || /\s/.test(name))) {
      fail(file, `meta.booru_sites.${key} must be one tag or a list of tags, got ${JSON.stringify(value)}`)
    }
    if (names.length > 1 && !site.ors) {
      fail(file, `meta.booru_sites.${key} takes one tag — ${site.name} does not OR tags`)
    }
    if (names.length > site.tagBudget) {
      fail(
        file,
        `meta.booru_sites.${key} takes ${site.tagBudget} tags at most — ${site.name} searches that many at a time`,
      )
    }
    sites[key] = names as string[]
  }
  return sites
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

function toml(file: string, source: string): Record<string, unknown> {
  try {
    return parse(source) as Record<string, unknown>
  } catch (error) {
    fail(file, `is not valid TOML — ${(error instanceof Error ? error.message : String(error)).split('\n')[0]}`)
  }
}

export function readCatalogs(file: string, raw: unknown): Catalog[] {
  if (raw === undefined) {
    return []
  }
  if (!Array.isArray(raw)) {
    fail(file, 'catalog must be [[catalog]] tables')
  }
  const catalogs = raw.map((entry, i) => {
    const c = table(entry)
    return {
      name: text(file, `catalog[${i}].name`, c.name),
      ...(c.native === undefined ? {} : { native: text(file, `catalog[${i}].native`, c.native) }),
      ...(c.lead === undefined ? {} : { lead: paletteName(file, `catalog[${i}].lead`, c.lead) }),
    }
  })
  if (new Set(catalogs.map((c) => c.name)).size !== catalogs.length) {
    fail(file, 'catalog.name must be unique')
  }
  return catalogs
}

function readNativeNames(file: string, raw: unknown): string[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    fail(file, 'meta.native_names must be a list of names, like ["後藤ひとり"]')
  }
  return raw.map((name, i) => {
    const said = text(file, `meta.native_names[${i}]`, name)
    if (said.includes('|')) {
      fail(file, `meta.native_names[${i}] ${JSON.stringify(said)} contains |`)
    }
    return said
  })
}

export const PALETTE_KEYS: Readonly<Record<string, readonly string[]>> = {
  '': ['$schema', 'meta', 'colors', 'contrast', 'ghostty', 'picture'],
  meta: ['name', 'base', 'ansi_source', 'booru', 'booru_sites', 'native_names', 'signature', 'order', 'role'],
  colors: ['background', 'foreground', 'cursor', 'selection_background', 'ansi'],
  contrast: ['waive', 'reason'],
  ghostty: ['icon_ghost', 'icon_screen'],
  picture: ['site', 'id', 'size', 'position', 'opacity'],
}

export function unknownKeys(file: string, source: string): string[] {
  const doc = toml(file, source)
  const odd = (path: string, value: unknown, known: readonly string[] = []): string[] =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? Object.keys(value)
          .filter((key) => !known.includes(key))
          .map((key) => (path ? `${path}.${key}` : key))
      : []
  return [
    ...odd('', doc, PALETTE_KEYS['']),
    ...['meta', 'colors', 'contrast', 'ghostty'].flatMap((table) => odd(table, doc[table], PALETTE_KEYS[table])),
    ...(Array.isArray(doc.picture) ? doc.picture : []).flatMap((p, i) => odd(`picture[${i}]`, p, PALETTE_KEYS.picture)),
  ]
}

export function readTheme(file: string, source: string, place: Place): Theme {
  const doc = toml(file, source)
  const meta = table(doc.meta)
  const colors = table(doc.colors)
  const contrastRules = table(doc.contrast)

  const ansiRaw = colors.ansi
  if (!Array.isArray(ansiRaw) || ansiRaw.length !== 16) {
    fail(
      file,
      `colors.ansi must hold exactly 16 colors, got ${Array.isArray(ansiRaw) ? ansiRaw.length : typeof ansiRaw}`,
    )
  }

  const name = paletteName(file, 'meta.name', meta.name)
  if (name !== place.name) {
    fail(file, `meta.name "${name}" does not match its file — it lives at ${place.name}`)
  }
  const shared = place.open === true
  for (const key of ['order', 'role']) {
    if (shared && meta[key] !== undefined) {
      fail(file, `meta.${key} is for the official palettes — a marketplace palette follows its base`)
    }
  }

  const role = meta.role
  if (role !== undefined && role !== 'default') {
    fail(file, `meta.role must be "default", got ${JSON.stringify(role)}`)
  }

  const base = meta.base === undefined ? undefined : paletteName(file, 'meta.base', meta.base)
  if (base !== undefined && !shared) {
    fail(file, 'meta.base is for marketplace palettes')
  }
  const from = base === undefined ? undefined : place.bases?.get(base)

  const catalog = place.catalog === undefined ? undefined : place.catalogs.get(place.catalog)
  if (!shared && !catalog) {
    fail(
      file,
      place.catalog === undefined
        ? 'an official palette lives in a catalog folder, palettes/<catalog>/<palette>.toml'
        : `its folder "${place.catalog}" has no [[catalog]] table in ${MARKETPLACE_FILE}`,
    )
  }

  const background = hex(file, 'colors.background', colors.background)
  const foreground = hex(file, 'colors.foreground', colors.foreground)
  const cursor = hex(file, 'colors.cursor', colors.cursor)
  const selectionBackground = hex(file, 'colors.selection_background', colors.selection_background)
  const ansi = ansiRaw.map((c, i) => hex(file, `colors.ansi[${i}]`, c))
  const signature = readSignature(file, meta.signature, {
    background,
    foreground,
    cursor,
    selection: selectionBackground,
    ansi,
  })
  const booru = meta.booru === undefined ? undefined : str(file, 'meta.booru', meta.booru)
  if (booru !== undefined && /[\s\p{Cc}]/u.test(booru)) {
    fail(file, `meta.booru must be a single booru tag, got ${JSON.stringify(booru)}`)
  }
  const booruSites = readBooruSites(file, meta.booru_sites, booru, place.foreign === true)
  const nativeNames = meta.native_names === undefined ? undefined : readNativeNames(file, meta.native_names)
  const waive = Array.isArray(contrastRules.waive) ? contrastRules.waive.map(String) : []
  if (waive.length > 0 && typeof contrastRules.reason !== 'string') {
    fail(file, 'contrast.waive needs a contrast.reason explaining why')
  }
  const pictures = readPictures(file, doc.picture, place.foreign === true)

  return {
    name,
    ...(base ? { base } : {}),
    ...(place.catalog === undefined ? {} : { catalog: place.catalog }),
    native: catalog?.native,
    ...(nativeNames ? { nativeNames } : {}),
    lead: catalog?.lead === name,
    order: shared ? (from?.order ?? SHARED_ORDER) : Number(meta.order),
    role,
    ansiSource:
      shared && meta.ansi_source === undefined
        ? (base ?? 'original')
        : text(file, 'meta.ansi_source', meta.ansi_source),
    ...(booru ? { booru } : {}),
    ...(booruSites ? { booruSites } : {}),
    background,
    foreground,
    cursor,
    selectionBackground,
    ansi,
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

export function loadThemes(dir: string): Theme[] {
  const catalogs = readCatalogs(
    MARKETPLACE_FILE,
    toml(MARKETPLACE_FILE, readFileSync(join(dir, MARKETPLACE_FILE), 'utf8')).catalog,
  )
  if (catalogs.length === 0) {
    fail(MARKETPLACE_FILE, 'needs at least one [[catalog]] table')
  }
  const byName = new Map(catalogs.map((c) => [c.name, c]))
  const shelf = join(dir, 'palettes')

  const themes = readdirSync(shelf, { withFileTypes: true })
    .filter((item) => !item.name.startsWith('.'))
    .flatMap((item) => {
      if (!item.isDirectory()) {
        fail(
          `palettes/${item.name}`,
          'an official palette lives in a catalog folder, palettes/<catalog>/<palette>.toml',
        )
      }
      return readdirSync(join(shelf, item.name))
        .filter((f) => f.endsWith('.toml'))
        .map((f) =>
          readTheme(`palettes/${item.name}/${f}`, readFileSync(join(shelf, item.name, f), 'utf8'), {
            name: basename(f, '.toml'),
            catalog: item.name,
            catalogs: byName,
          }),
        )
    })
    .sort((a, b) => a.order - b.order)

  const orders = new Set(themes.map((t) => t.order))
  if (orders.size !== themes.length) {
    throw new Error('themes: meta.order must be unique across all themes')
  }

  for (const catalog of catalogs) {
    const members = themes.filter((t) => t.catalog === catalog.name)
    if (members.length === 0) fail(MARKETPLACE_FILE, `catalog "${catalog.name}" has no palettes`)
    if (!members.some((t) => t.name === catalog.lead)) {
      fail(MARKETPLACE_FILE, `catalog "${catalog.name}" needs a lead, one of its palettes`)
    }
  }
  const shown = [...new Set(themes.map((t) => t.catalog))]
  if (shown.join('\n') !== catalogs.map((c) => c.name).join('\n')) {
    fail(MARKETPLACE_FILE, 'the [[catalog]] tables must follow the order meta.order gives their palettes')
  }
  return themes
}

export function rotation(themes: Theme[]): Theme[] {
  return themes.filter((t) => t.role === undefined)
}

export function shelfOf(item: { name: string; catalog?: string }): string {
  return [marketplaceOf(item.name), item.catalog].filter((part) => part !== undefined).join(' / ')
}

export function topOf(item: { name: string; catalog?: string }): string {
  return marketplaceOf(item.name) ?? item.catalog ?? ''
}

export function alphabetical<T extends { name: string; base?: string; catalog?: string }>(items: T[]): T[] {
  const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
  const root = (t: T) => (marketplaceOf(t.name) ? t.name : (t.base ?? t.name))
  return [...items].sort(
    (a, b) =>
      Number(marketplaceOf(a.name) !== undefined) - Number(marketplaceOf(b.name) !== undefined) ||
      cmp(topOf(a).toLowerCase(), topOf(b).toLowerCase()) ||
      Number(a.catalog === undefined) - Number(b.catalog === undefined) ||
      cmp((a.catalog ?? '').toLowerCase(), (b.catalog ?? '').toLowerCase()) ||
      cmp(root(a), root(b)) ||
      Number(a.base !== undefined) - Number(b.base !== undefined) ||
      cmp(a.name, b.name),
  )
}
