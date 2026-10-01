import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { editUserFile, writeAtomic } from './edits.ts'
import { type WarpLook, warpTheme } from './emit/warp.ts'
import { colorless } from './osc.ts'
import { readInstalled } from './palettes.ts'
import { detectTerminal, type Live } from './terminal.ts'
import {
  WARP_DEFAULT,
  warpBasePath,
  warpSettings,
  warpThemeOf,
  warpThemes,
  warpThemeValue,
  withWarpTheme,
} from './terminals/warp.ts'
import { owned } from './theme.ts'

type Env = Record<string, string | undefined>

export const WARP_SETTLE = 150

export const WARP_KNOWN = 260

function ours(value: string | undefined): boolean {
  return value?.includes(`path = "${owned('')}`) === true
}

function wired(configHome: string): boolean {
  try {
    return readInstalled(configHome).terminals.includes('warp')
  } catch {
    return false
  }
}

export function warpInstalled(dir: string, name: string): string | undefined {
  const stem = owned(name)
  if (!existsSync(dir)) {
    return undefined
  }
  const hashed = readdirSync(dir)
    .filter((file) => file.startsWith(`${stem}.`) && /^[0-9a-f]{8}\.yaml$/.test(file.slice(stem.length + 1)))
    .map((file) => ({ file, at: statSync(join(dir, file)).mtimeMs }))
    .sort((a, b) => b.at - a.at)
  return hashed[0]?.file ?? (existsSync(join(dir, `${stem}.yaml`)) ? `${stem}.yaml` : undefined)
}

export function warpLive(env: Env, tty: boolean, configHome: string, home = homedir()): Live | undefined {
  if (!tty || colorless(env) || env.TMUX || detectTerminal(env) !== 'warp') {
    return undefined
  }
  const settings = warpSettings(home, configHome)
  if (!existsSync(settings) || !wired(configHome)) {
    return undefined
  }
  const dir = warpThemes(home)
  const base = warpBasePath(configHome)
  const views: string[] = []
  let settle: NodeJS.Timeout | undefined
  let known: NodeJS.Timeout | undefined
  const wear = (value: string) => {
    const content = readFileSync(settings, 'utf8')
    const was = warpThemeOf(content)
    if (was === value) {
      return
    }
    if (ours(value) && !ours(was) && !existsSync(base)) {
      writeAtomic(base, was ?? '')
    }
    editUserFile(settings, withWarpTheme(content, value))
    if (!ours(value)) {
      rmSync(base, { force: true })
    }
  }
  const sweep = (keep?: string) => {
    for (const view of views.splice(0)) {
      if (view === keep) {
        views.push(view)
      } else {
        rmSync(join(dir, view), { force: true })
      }
    }
  }
  const stop = () => {
    clearTimeout(settle)
    clearTimeout(known)
  }
  const show = (look: WarpLook, file?: string) => {
    stop()
    settle = setTimeout(() => {
      let theme = file
      if (!theme) {
        theme = `${owned(look.name)}.view-${process.pid}-${views.length + 1}.yaml`
        writeAtomic(join(dir, theme), warpTheme(look))
        views.push(theme)
      }
      const shown = theme
      const age = Date.now() - statSync(join(dir, shown)).mtimeMs
      known = setTimeout(
        () => {
          wear(warpThemeValue(look.name, shown))
          sweep(shown)
        },
        Math.max(0, WARP_KNOWN - age),
      )
    }, WARP_SETTLE)
  }
  return {
    slots: [],
    paint: (entry) => {
      show(entry, warpInstalled(dir, entry.name))
      return ''
    },
    look: (name, shown) => {
      const [background = '', foreground = '', cursor = '', , ...ansi] = shown
      show({ name, background, foreground, cursor, ansi })
    },
    wear: (_, terminals) => (terminals.includes('warp') ? '' : undefined),
    saved: async () => new Map([['theme', warpThemeOf(readFileSync(settings, 'utf8')) ?? '']]),
    restore: (saved) => {
      stop()
      const value = saved.get('theme')
      if (value) {
        wear(value)
      } else if (ours(warpThemeOf(readFileSync(settings, 'utf8')))) {
        wear(WARP_DEFAULT)
      }
      sweep()
      return ''
    },
  }
}
