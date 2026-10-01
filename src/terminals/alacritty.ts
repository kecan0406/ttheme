import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { alacritty as emitter } from '../emit/index.ts'
import { owned } from '../theme.ts'
import { BLOCK, BLOCK_BEGIN, BLOCK_END, removeBlock, upsertBlock } from '../wiring.ts'
import { readText, stripped, tilde } from './common.ts'
import type { At, Wiring } from './types.ts'

export function alacrittyColors(content: string): boolean {
  const outside = content.replace(BLOCK, '')
  return /^[ \t]*\[colors[\].]/m.test(outside) || /^[ \t]*colors[ \t]*[.=]/m.test(outside)
}

const TOML_GENERAL = /^[ \t]*\[general\][ \t]*(?:#.*)?$/m
const TOML_TABLE = /^[ \t]*\[/m
const TOML_IMPORT = /^[ \t]*import[ \t]*=/m
const TOML_GENERAL_KEY = /^[ \t]*general[ \t]*[.=]/m

function alacrittyBlock(themePath: string | undefined): string {
  return themePath ? `[general]\nimport = ["${themePath}"]` : ''
}

export function upsertAlacrittyImport(content: string, themePath: string | undefined): string | undefined {
  const outside = content.replace(BLOCK, '')
  const general = TOML_GENERAL.exec(outside)
  if (!general) {
    const first = outside.search(TOML_TABLE)
    const root = first < 0 ? outside : outside.slice(0, first)
    if (TOML_GENERAL_KEY.test(outside) || TOML_IMPORT.test(root)) {
      return undefined
    }
    return upsertBlock(content, alacrittyBlock(themePath))
  }
  const at = general.index + general[0].length
  const rest = outside.slice(at)
  const next = rest.search(TOML_TABLE)
  if (TOML_IMPORT.test(next < 0 ? rest : rest.slice(0, next))) {
    return undefined
  }
  const line = themePath ? `import = ["${themePath}"]\n` : ''
  return `${outside.slice(0, at)}\n${BLOCK_BEGIN}\n${line}${BLOCK_END}${rest}`
}

export function alacrittyConfig(configHome: string): string {
  return join(configHome, 'alacritty', 'alacritty.toml')
}

function themes(at: At): string {
  return join(at.configHome, 'alacritty', 'themes')
}

export function alacrittyTheme(configHome: string, palette: string | undefined): string | undefined {
  return palette ? join(configHome, 'alacritty', 'themes', `${owned(palette)}.toml`) : undefined
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
    const config = alacrittyConfig(ctx.configHome)
    const wired = upsertAlacrittyImport(readText(config), alacrittyTheme(ctx.configHome, ctx.startup))
    if (wired !== undefined) {
      out.wire(config, wired)
    }
  },
  plan(ctx) {
    const config = alacrittyConfig(ctx.configHome)
    return upsertAlacrittyImport(readText(config), undefined) !== undefined
      ? [`Edit ${tilde(config, ctx.home)} — a ttheme block: general.import`]
      : []
  },
  notes(ctx) {
    const config = alacrittyConfig(ctx.configHome)
    const content = readText(config)
    return [
      ...(existsSync(config) && upsertAlacrittyImport(content, undefined) === undefined
        ? [
            `${config} already imports files under [general] — ttheme left it alone; add ${themes(ctx)}/<palette>.toml to that import list yourself`,
          ]
        : []),
      ...(alacrittyColors(content)
        ? [
            `${tilde(config, ctx.home)} sets its own colors, which win over an imported palette — remove them to open with ttheme's`,
          ]
        : []),
    ]
  },
  next: () => ['Alacritty         Reloads its config by itself'],
  unwire: (at) => ({ edits: stripped(alacrittyConfig(at.configHome), removeBlock), removals: [], touches: [] }),
}
