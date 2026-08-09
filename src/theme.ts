import { readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
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

export interface Theme {
  name: string
  group: string
  native?: string
  order: number
  role?: 'default'
  ansiSource: string
  background: Hex
  foreground: Hex
  cursor: Hex
  selectionBackground: Hex
  ansi: Hex[]
  font: Font
  ghostty: GhosttyExtras
  waive: string[]
  waiveReason?: string
}

const DEFAULTS_FILE = '_defaults.toml'

export const RESERVED_NAMES = new Set(['next', 'help', 'preview'])

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

function readTheme(file: string, source: string, defaults: Record<string, unknown>): Theme {
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

  const background = hex(file, 'colors.background', colors.background)
  const cursor = hex(file, 'colors.cursor', colors.cursor)
  const selectionBackground = hex(file, 'colors.selection_background', colors.selection_background)
  const waive = Array.isArray(contrastRules.waive) ? contrastRules.waive.map(String) : []
  if (waive.length > 0 && typeof contrastRules.reason !== 'string') {
    fail(file, 'contrast.waive needs a contrast.reason explaining why')
  }

  return {
    name,
    group: str(file, 'meta.group', meta.group),
    native: meta.native === undefined ? undefined : str(file, 'meta.native', meta.native),
    order: Number(meta.order),
    role,
    ansiSource: str(file, 'meta.ansi_source', meta.ansi_source),
    background,
    foreground: hex(file, 'colors.foreground', colors.foreground),
    cursor,
    selectionBackground,
    ansi: ansiRaw.map((c, i) => hex(file, `colors.ansi[${i}]`, c)),
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

  const themes = readdirSync(dir)
    .filter((f) => f.endsWith('.toml') && f !== DEFAULTS_FILE)
    .map((f) => readTheme(f, readFileSync(join(dir, f), 'utf8'), defaults))
    .sort((a, b) => a.order - b.order)

  const orders = new Set(themes.map((t) => t.order))
  if (orders.size !== themes.length) {
    throw new Error('themes: meta.order must be unique across all themes')
  }
  return themes
}

export function rotation(themes: Theme[]): Theme[] {
  return themes.filter((t) => t.role === undefined)
}
