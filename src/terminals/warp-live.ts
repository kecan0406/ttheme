import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Mode } from '../core/mode.ts'
import { owned } from '../core/theme.ts'
import { editUserFile, relink, writeAtomic } from '../store/edits.ts'
import { readInstalled, worn } from '../store/installed.ts'
import { modeFor } from '../store/wiring.ts'
import { type WarpLook, type WarpPicture, warpTheme } from './emit/warp.ts'
import { colorless } from './osc.ts'
import { detectTerminal, type Live } from './terminal.ts'
import {
  WARP_DEFAULT,
  warpChannelOf,
  warpReady,
  warpSettings,
  warpSystemOf,
  warpThemeOf,
  warpThemes,
  warpThemeValue,
  warpWear,
} from './warp.ts'

type Env = Record<string, string | undefined>

export const WARP_SETTLE = 150

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

export function warpInstalled(dir: string, name: string, mode: Mode): string | undefined {
  const stem = owned(name)

  if (!existsSync(dir)) {
    return undefined
  }

  const hashed = readdirSync(dir)
    .filter(
      (file) =>
        file.startsWith(`${stem}.${mode}.`) && /^[0-9a-f]{8}\.yaml$/.test(file.slice(stem.length + mode.length + 2)),
    )
    .map((file) => ({ file, at: statSync(join(dir, file)).mtimeMs }))
    .sort((a, b) => b.at - a.at)

  return hashed[0]?.file ?? (existsSync(join(dir, `${stem}.yaml`)) ? `${stem}.yaml` : undefined)
}

function pictureOf(dir: string, file: string | undefined): WarpPicture | undefined {
  if (!file) {
    return undefined
  }

  let yaml: string

  try {
    yaml = readFileSync(join(dir, file), 'utf8')
  } catch {
    return undefined
  }

  const m = /^background_image:\n\s+path:\s*"([^"]*)"\n\s+opacity:\s*(\d+)/m.exec(yaml)

  return m?.[1] ? { image: m[1], opacity: Number(m[2]) / 100 } : undefined
}

export function warpLive(env: Env, tty: boolean, configHome: string, home = homedir()): Live | undefined {
  if (!tty || colorless(env) || env.TMUX || detectTerminal(env) !== 'warp') {
    return undefined
  }

  const channel = warpChannelOf(env)
  const settings = warpSettings(home, configHome, channel)

  if (!existsSync(settings) || !wired(configHome)) {
    return undefined
  }

  const dir = warpThemes(home, channel)
  const views: string[] = []
  const own = env.TTHEME_WARP_WEARS ?? worn(readInstalled(configHome))
  const mode = modeFor(configHome)
  const picture = pictureOf(dir, own && warpInstalled(dir, own, mode))
  let settle: NodeJS.Timeout | undefined
  let known: NodeJS.Timeout | undefined

  const wear = (value: string) => {
    const content = readFileSync(settings, 'utf8')
    const next = warpWear(content, value, configHome, channel)

    if (next === content) {
      return
    }

    editUserFile(settings, next)
    relink(settings)
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

  const show = (look: WarpLook, file?: string, laid?: WarpPicture) => {
    stop()
    settle = setTimeout(() => {
      let theme = file

      if (!theme) {
        theme = `${owned(look.name)}.view-${process.pid}-${views.length + 1}.yaml`
        writeAtomic(join(dir, theme), warpTheme(look, laid))
        views.push(theme)
      }

      const shown = theme
      const now = Date.now()
      known = setTimeout(
        () => {
          wear(warpThemeValue(look.name, shown))
          sweep(shown)
        },
        Math.max(0, warpReady(join(dir, shown), settings, now) - now),
      )
    }, WARP_SETTLE)
  }

  return {
    slots: [],
    paint: (entry) => {
      if (entry.name === own) {
        show(entry, warpInstalled(dir, entry.name, mode))
      } else if (picture) {
        show(entry, undefined, picture)
      } else {
        show(entry, existsSync(join(dir, `${owned(entry.name)}.yaml`)) ? `${owned(entry.name)}.yaml` : undefined)
      }

      return ''
    },
    wear: (_, terminals) => (terminals.includes('warp') ? '' : undefined),
    saved: async () => new Map([['theme', warpThemeOf(readFileSync(settings, 'utf8')) ?? '']]),
    restore: (saved) => {
      stop()
      const value = saved.get('theme')

      if (value) {
        wear(value)
      } else {
        const content = readFileSync(settings, 'utf8')
        const theme = warpThemeOf(content)

        if (ours(theme) || ours(warpSystemOf(content))) {
          wear(ours(theme) || theme === undefined ? WARP_DEFAULT : theme)
        }
      }

      sweep()

      return ''
    },
  }
}
