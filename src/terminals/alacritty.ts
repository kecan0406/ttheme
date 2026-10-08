import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { alacritty as emitter } from '../emit/index.ts'
import { owned } from '../theme.ts'
import { BLOCK, BLOCK_BEGIN, BLOCK_END, fromHome, GENERATED, MANAGED, removeBlock, upsertBlock } from '../wiring.ts'
import { readText, stripped, tilde } from './common.ts'
import type { At, Now, Wiring } from './types.ts'

export function alacrittyColors(content: string): boolean {
  const outside = content.replace(BLOCK, '')
  return /^[ \t]*\[colors[\].]/m.test(outside) || /^[ \t]*colors[ \t]*[.=]/m.test(outside)
}

const TOML_GENERAL = /^[ \t]*\[general\][ \t]*(?:#.*)?$/m
const TOML_TABLE = /^[ \t]*\[/m
const TOML_IMPORT = /^[ \t]*import[ \t]*=/m
const TOML_GENERAL_KEY = /^[ \t]*general[ \t]*[.=]/m

function importLine(pointer: string): string {
  return `import = [${JSON.stringify(pointer)}]`
}

export function upsertAlacrittyImport(content: string, pointer: string): string | undefined {
  const outside = content.replace(BLOCK, '')
  const general = TOML_GENERAL.exec(outside)
  if (!general) {
    const first = outside.search(TOML_TABLE)
    const root = first < 0 ? outside : outside.slice(0, first)
    if (TOML_GENERAL_KEY.test(outside) || TOML_IMPORT.test(root)) {
      return undefined
    }
    return upsertBlock(content, `# ${MANAGED}\n[general]\n${importLine(pointer)}`)
  }
  const at = general.index + general[0].length
  const rest = outside.slice(at)
  const next = rest.search(TOML_TABLE)
  if (TOML_IMPORT.test(next < 0 ? rest : rest.slice(0, next))) {
    return undefined
  }
  return `${outside.slice(0, at)}\n${BLOCK_BEGIN}\n# ${MANAGED}\n${importLine(pointer)}\n${BLOCK_END}${rest}`
}

export function alacrittyCandidates(at: At): string[] {
  return [
    ...new Set([
      join(at.configHome, 'alacritty', 'alacritty.toml'),
      join(at.configHome, 'alacritty.toml'),
      join(at.home, '.config', 'alacritty', 'alacritty.toml'),
      join(at.home, '.alacritty.toml'),
    ]),
  ]
}

export interface AlacrittyConfig {
  file: string
  yaml?: string
}

export function alacrittyConfig(at: At): AlacrittyConfig {
  const candidates = alacrittyCandidates(at)
  const found = candidates.find((file) => existsSync(file))
  if (found) {
    return { file: found }
  }
  const yaml = candidates.map((file) => file.replace(/\.toml$/, '.yml')).find((file) => existsSync(file))
  return { file: candidates[0] as string, ...(yaml ? { yaml } : {}) }
}

export function alacrittyOwn(configHome: string): string {
  return join(configHome, 'ttheme', 'alacritty.toml')
}

export function alacrittyOwnText(theme: string | undefined): string {
  return [`# ${GENERATED}`, ...(theme ? ['[general]', importLine(theme)] : []), ''].join('\n')
}

function pointer(at: At): string {
  const own = alacrittyOwn(at.configHome)
  return fromHome(own, at.home, '~') ?? own
}

function themes(at: At): string {
  return join(at.configHome, 'alacritty', 'themes')
}

function themeOf(now: Now): string | undefined {
  return now.startup ? join(themes(now), `${owned(now.startup)}.toml`) : undefined
}

export const alacritty: Wiring = {
  id: 'alacritty',
  name: 'Alacritty',
  emitter,
  shelf: { from: 'themes', dir: themes },
  offered: () => true,
  present: (setup) => existsSync(join(setup.configHome, 'alacritty')),
  sync(ctx, out) {
    out.themes(alacritty)
    out.write(alacrittyOwn(ctx.configHome), alacrittyOwnText(themeOf(ctx)))
    const config = alacrittyConfig(ctx)
    const wired = config.yaml ? undefined : upsertAlacrittyImport(readText(config.file), pointer(ctx))
    if (wired !== undefined) {
      out.wire(config.file, wired)
    }
  },
  plan(now) {
    const config = alacrittyConfig(now)
    return !config.yaml && upsertAlacrittyImport(readText(config.file), pointer(now)) !== undefined
      ? [
          `Edit ${tilde(config.file, now.home)} — a ttheme block: general.import`,
          `Write ${tilde(alacrittyOwn(now.configHome), now.home)} — general.import`,
        ]
      : []
  },
  notes(now) {
    const config = alacrittyConfig(now)
    if (config.yaml) {
      return [
        `${tilde(config.yaml, now.home)} is the config Alacritty reads, and ttheme edits TOML only — \`alacritty migrate\` converts it, and ttheme wires the TOML at its next add, remove or default`,
      ]
    }
    const content = readText(config.file)
    return [
      ...(existsSync(config.file) && upsertAlacrittyImport(content, pointer(now)) === undefined
        ? [
            `${tilde(config.file, now.home)} already imports files under [general] — ttheme left it alone; add ${pointer(now)} to that import list yourself`,
          ]
        : []),
      ...(now.startup && alacrittyColors(content)
        ? [
            `${tilde(config.file, now.home)} sets its own colors, which win over an imported palette — remove them to open with ttheme's`,
          ]
        : []),
    ]
  },
  next: () => ['Alacritty         Reloads its config by itself'],
  unwire: (at) => ({
    edits: alacrittyCandidates(at).flatMap((file) => stripped(file, removeBlock)),
    removals: [],
    touches: [],
  }),
}
