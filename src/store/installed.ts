import { existsSync, readFileSync } from 'node:fs'
import { WIRED, type Wired } from '../core/wired.ts'
import { writeAtomic } from './edits.ts'
import { installedPath } from './sources.ts'

export interface Installed {
  terminals: Wired[]
  author?: string
  startup?: string
  off?: true
  itermBase?: string
  konsoleBase?: string
  terminalBase?: string
  wtHome?: string
  wtProfile?: string
  marketplaces?: string[]
  updates?: Record<string, boolean>
  palettes: string[]
}

export function startupPalette(state: Installed): string | undefined {
  return state.startup && state.palettes.includes(state.startup) ? state.startup : state.palettes[0]
}

export function worn(state: Installed): string | undefined {
  return state.off ? undefined : startupPalette(state)
}

type Optional = Exclude<keyof Installed, 'terminals' | 'palettes'>

export const text = (value: unknown) => (typeof value === 'string' && value !== '' ? value : undefined)

const OPTIONAL = {
  author: text,
  startup: text,
  off: (value) => (value ? true : undefined),
  itermBase: text,
  konsoleBase: text,
  terminalBase: text,
  wtHome: text,
  wtProfile: text,
  marketplaces: (value) => (Array.isArray(value) ? value.filter((m): m is string => typeof m === 'string') : undefined),
  updates: (value) =>
    value && typeof value === 'object'
      ? Object.fromEntries(
          Object.entries(value).filter((pair): pair is [string, boolean] => typeof pair[1] === 'boolean'),
        )
      : undefined,
} satisfies { [K in Optional]-?: (value: unknown) => Installed[K] }

export function readInstalled(configHome: string): Installed {
  const path = installedPath(configHome)

  if (!existsSync(path)) {
    throw new Error(`nothing installed yet at ${path} — run \`ttheme init\` first`)
  }

  const doc = JSON.parse(readFileSync(path, 'utf8'))

  if (!Array.isArray(doc?.palettes) || !Array.isArray(doc.terminals)) {
    throw new Error(`${path} has no palettes or terminals`)
  }

  return {
    terminals: doc.terminals.filter((t: Wired) => WIRED.includes(t)),
    ...Object.fromEntries(
      Object.entries(OPTIONAL).flatMap(([key, read]) => {
        const value = read(doc[key])

        return value === undefined ? [] : [[key, value]]
      }),
    ),
    palettes: doc.palettes,
  }
}

export function writeInstalled(configHome: string, state: Installed): void {
  writeAtomic(installedPath(configHome), `${JSON.stringify(state, null, 2)}\n`)
}
