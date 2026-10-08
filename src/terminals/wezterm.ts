import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { backgroundsDir } from '../backdrop.ts'
import { wezterm as emitter } from '../emit/index.ts'
import { weztermModule } from '../emit/wezterm.ts'
import { fromHome, MANAGED } from '../wiring.ts'
import { readText, stripped, tilde } from './common.ts'
import type { At, Wiring } from './types.ts'

const LUA_BLOCK = /-- ttheme begin\n[\s\S]*?-- ttheme end\n?/
const LUA_RETURN = /^return config[ \t]*$/gm

export function weztermBlock(module: string, home: string): string {
  const relative = fromHome(module, home, '')
  const path =
    relative === undefined ? JSON.stringify(module) : `require('wezterm').home_dir .. ${JSON.stringify(relative)}`
  return `-- ${MANAGED}\ndo local path = ${path} local file = io.open(path) if file then file:close() dofile(path)(config) end end`
}

const WEZTERM_SKELETON = "local wezterm = require 'wezterm'\nlocal config = wezterm.config_builder()\n\n"

export function removeLuaBlock(content: string): string {
  const out = content.replace(/-- ttheme begin\n[\s\S]*?-- ttheme end\n\n?/, '')
  return out === `${WEZTERM_SKELETON}return config\n` ? '' : out
}

export function upsertLuaBlock(content: string, body: string): string | undefined {
  const block = `-- ttheme begin\n${body}\n-- ttheme end\n`
  if (LUA_BLOCK.test(content)) {
    return content.replace(LUA_BLOCK, block)
  }
  if (content === '') {
    return `${WEZTERM_SKELETON}${block}\nreturn config\n`
  }
  const last = [...content.matchAll(LUA_RETURN)].at(-1)
  if (last?.index === undefined) {
    return undefined
  }
  return `${content.slice(0, last.index)}${block}\n${content.slice(last.index)}`
}

function weztermConfig(configHome: string, home: string): string {
  const dotfile = join(home, '.wezterm.lua')
  return existsSync(dotfile) ? dotfile : join(configHome, 'wezterm', 'wezterm.lua')
}

function colors(at: At): string {
  return join(at.configHome, 'wezterm', 'colors')
}

function module(at: At): string {
  return join(at.configHome, 'ttheme', 'wezterm.lua')
}

export const wezterm: Wiring = {
  id: 'wezterm',
  name: 'WezTerm',
  emitter,
  shelf: { from: 'colors', dir: colors },
  offered: () => true,
  present: (setup) => existsSync(join(setup.configHome, 'wezterm')) || existsSync(join(setup.home, '.wezterm.lua')),
  sync(ctx, out) {
    out.themes(wezterm)
    out.write(
      module(ctx),
      weztermModule({
        path: module(ctx),
        colors: colors(ctx),
        backgrounds: backgroundsDir(ctx.configHome),
        ...(ctx.startup ? { startup: ctx.startup } : {}),
        palettes: ctx.themes,
      }),
    )
    const config = weztermConfig(ctx.configHome, ctx.home)
    const wired = upsertLuaBlock(readText(config), weztermBlock(module(ctx), ctx.home))
    if (wired !== undefined) {
      out.wire(config, wired)
    }
  },
  plan(ctx) {
    const config = weztermConfig(ctx.configHome, ctx.home)
    return upsertLuaBlock(readText(config), '') !== undefined
      ? [
          `Edit ${tilde(config, ctx.home)} — a ttheme block before \`return config\`: color_scheme_dirs, color_scheme, pictures`,
        ]
      : []
  },
  notes(ctx) {
    const config = weztermConfig(ctx.configHome, ctx.home)
    return existsSync(config) && upsertLuaBlock(readText(config), '') === undefined
      ? [
          `${config} has no \`return config\` line — ttheme left it alone; call \`dofile("${module(ctx)}")(config)\` from it yourself`,
        ]
      : []
  },
  next: () => ['WezTerm           Reloads its config by itself'],
  unwire: (at) => ({
    edits: stripped(weztermConfig(at.configHome, at.home), removeLuaBlock),
    removals: [],
    touches: [],
  }),
}
