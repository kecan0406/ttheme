import { readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { SITES } from './booru.ts'
import { type Hex, isHex } from './color.ts'

export interface CodepointMap {
  range: string
  family: string
}

export interface Font {
  family: string
  size: number
  codepointMap: CodepointMap[]
}

export interface GhosttyExtras {
  shader?: string
  iconGhost: Hex
  iconScreen: Hex[]
}

export interface Group {
  name: string
  native?: string
  lead: string
}

export interface Theme {
  name: string
  group: string
  native?: string
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
  font: Font
  ghostty: GhosttyExtras
  waive: string[]
  waiveReason?: string
}

const DEFAULTS_FILE = '_defaults.toml'
const GROUPS_FILE = '_groups.toml'
const SIGNATURE_SIZE = 3
const NAMED_SLOTS = ['background', 'foreground', 'cursor', 'selection'] as const

type NamedSlot = (typeof NAMED_SLOTS)[number]

export const RESERVED_NAMES = new Set(['next', 'help', 'preview', 'pin', 'unpin', 'config'])

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

function table(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function readFont(file: string, own: unknown, base: unknown): Font {
  const font = { ...table(base), ...table(own) }
  const raw = font.codepoint_map ?? []
  if (!Array.isArray(raw)) fail(file, 'font.codepoint_map must be an array')

  return {
    family: str(file, 'font.family', font.family),
    size: Number(font.size),
    codepointMap: raw.map((entry) => {
      const e = table(entry)
      return {
        range: str(file, 'font.codepoint_map[].range', e.range),
        family: str(file, 'font.codepoint_map[].family', e.family),
      }
    }),
  }
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

function readGhostty(file: string, own: unknown, base: unknown, colors: IconColors): GhosttyExtras {
  const g = { ...table(base), ...table(own) }

  return {
    shader: g.shader === undefined ? undefined : str(file, 'ghostty.shader', g.shader),
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
      fail(file, `meta.booru_sites.${key} is not a find site — use ${SITES.map((s) => s.key).join(', ')}`)
    }
    const names = typeof value === 'string' ? [value] : Array.isArray(value) ? value : undefined
    if (!names || names.some((name) => typeof name !== 'string' || name === '' || /\s/.test(name))) {
      fail(file, `meta.booru_sites.${key} must be one tag or a list of tags, got ${JSON.stringify(value)}`)
    }
    if (names.length > 1 && Number.isFinite(site.tagBudget)) {
      fail(file, `meta.booru_sites.${key} takes one tag — ${site.name} searches ${site.tagBudget} tags at a time`)
    }
    sites[key] = names as string[]
  }
  return sites
}

function readGroups(dir: string): Group[] {
  const doc = Bun.TOML.parse(readFileSync(join(dir, GROUPS_FILE), 'utf8')) as Record<string, unknown>
  const raw = doc.group
  if (!Array.isArray(raw) || raw.length === 0) {
    fail(GROUPS_FILE, 'needs at least one [[group]] table')
  }
  return raw.map((entry) => {
    const g = table(entry)
    return {
      name: str(GROUPS_FILE, 'group.name', g.name),
      native: g.native === undefined ? undefined : str(GROUPS_FILE, 'group.native', g.native),
      lead: str(GROUPS_FILE, 'group.lead', g.lead),
    }
  })
}

function readTheme(file: string, source: string, defaults: Record<string, unknown>, groups: Map<string, Group>): Theme {
  const doc = Bun.TOML.parse(source) as Record<string, unknown>
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

  const name = str(file, 'meta.name', meta.name)
  if (name !== basename(file, '.toml')) {
    fail(file, `meta.name "${name}" does not match the filename`)
  }
  if (RESERVED_NAMES.has(name)) {
    fail(file, `meta.name "${name}" collides with a ttheme subcommand`)
  }
  if (name.startsWith('-')) {
    fail(file, `meta.name "${name}" would be read as a flag by the ttheme CLI`)
  }

  const role = meta.role
  if (role !== undefined && role !== 'default') {
    fail(file, `meta.role must be "default", got ${JSON.stringify(role)}`)
  }

  const groupName = str(file, 'meta.group', meta.group)
  const group = groups.get(groupName)
  if (!group) fail(file, `meta.group "${groupName}" has no [[group]] table in ${GROUPS_FILE}`)

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
  if (booru !== undefined && /\s/.test(booru)) {
    fail(file, `meta.booru must be a single booru tag, got ${JSON.stringify(booru)}`)
  }
  const booruSites = readBooruSites(file, meta.booru_sites, booru)
  const waive = Array.isArray(contrastRules.waive) ? contrastRules.waive.map(String) : []
  if (waive.length > 0 && typeof contrastRules.reason !== 'string') {
    fail(file, 'contrast.waive needs a contrast.reason explaining why')
  }

  return {
    name,
    group: groupName,
    native: group.native,
    lead: group.lead === name,
    order: Number(meta.order),
    role,
    ansiSource: str(file, 'meta.ansi_source', meta.ansi_source),
    ...(booru ? { booru } : {}),
    ...(booruSites ? { booruSites } : {}),
    background,
    foreground,
    cursor,
    selectionBackground,
    ansi,
    signature: signature.colors,
    signatureSlots: signature.names,
    font: readFont(file, doc.font, defaults.font),
    ghostty: readGhostty(file, doc.ghostty, defaults.ghostty, {
      background,
      cursor,
      selectionBackground,
    }),
    waive,
    waiveReason: typeof contrastRules.reason === 'string' ? contrastRules.reason : undefined,
  }
}

export function loadThemes(dir: string): Theme[] {
  const defaults = Bun.TOML.parse(readFileSync(join(dir, DEFAULTS_FILE), 'utf8')) as Record<string, unknown>
  const groups = readGroups(dir)
  const byName = new Map(groups.map((g) => [g.name, g]))
  if (byName.size !== groups.length) {
    fail(GROUPS_FILE, 'group.name must be unique')
  }

  const themes = readdirSync(dir)
    .filter((f) => f.endsWith('.toml') && !f.startsWith('_'))
    .map((f) => readTheme(f, readFileSync(join(dir, f), 'utf8'), defaults, byName))
    .sort((a, b) => a.order - b.order)

  const orders = new Set(themes.map((t) => t.order))
  if (orders.size !== themes.length) {
    throw new Error('themes: meta.order must be unique across all themes')
  }

  for (const group of groups) {
    const members = themes.filter((t) => t.group === group.name)
    if (members.length === 0) fail(GROUPS_FILE, `group "${group.name}" has no themes`)
    if (!members.some((t) => t.name === group.lead)) {
      fail(GROUPS_FILE, `group "${group.name}" lead "${group.lead}" is not one of its themes`)
    }
  }
  return themes
}

export function rotation(themes: Theme[]): Theme[] {
  return themes.filter((t) => t.role === undefined)
}

export function alphabetical<T extends { group: string; name: string }>(items: T[]): T[] {
  const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
  return [...items].sort((a, b) => cmp(a.group.toLowerCase(), b.group.toLowerCase()) || cmp(a.name, b.name))
}
