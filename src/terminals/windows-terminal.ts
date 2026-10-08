import { existsSync, readFileSync, utimesSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { windowsTerminal as emitter } from '../emit/index.ts'
import { wtFragment } from '../emit/windows-terminal.ts'
import type { Host, Wiring } from './types.ts'

export function wtFragmentPath(wtHome: string): string {
  return join(wtHome, 'Microsoft', 'Windows Terminal', 'Fragments', 'ttheme', 'ttheme.json')
}

function wtSettings(wtHome: string): string[] {
  return [
    join(wtHome, 'Packages', 'Microsoft.WindowsTerminal_8wekyb3d8bbwe', 'LocalState', 'settings.json'),
    join(wtHome, 'Packages', 'Microsoft.WindowsTerminalPreview_8wekyb3d8bbwe', 'LocalState', 'settings.json'),
    join(wtHome, 'Microsoft', 'Windows Terminal', 'settings.json'),
  ].filter((file) => existsSync(file))
}

function wtDefaultProfile(settings: string[]): string | undefined {
  for (const file of settings) {
    const guid = /"defaultProfile"\s*:\s*"(\{[0-9a-fA-F-]+\})"/.exec(readFileSync(file, 'utf8'))?.[1]
    if (guid) {
      return guid
    }
  }
  return undefined
}

export function windowsAppData(host: Host): string | undefined {
  if (host.platform === 'win32') {
    return host.env.LOCALAPPDATA
  }
  if (!host.env.WSL_DISTRO_NAME) {
    return undefined
  }
  const local = host.run('cmd.exe', ['/d', '/c', 'echo %LOCALAPPDATA%'])
  return (local && host.run('wslpath', ['-u', local])) || undefined
}

export const windowsTerminal: Wiring = {
  id: 'windows-terminal',
  name: 'Windows Terminal',
  emitter,
  offered: (setup) => setup.wtHome !== undefined,
  present: (setup) => setup.wtHome !== undefined,
  installs: (setup) => ({ wtHome: setup.wtHome, wtProfile: setup.wtProfile }),
  sync(ctx, out) {
    const { wtHome, wtProfile } = ctx.state
    if (!wtHome) {
      return
    }
    const settings = wtSettings(wtHome)
    if (
      out.write(wtFragmentPath(wtHome), wtFragment(ctx.themes, wtProfile ?? wtDefaultProfile(settings), ctx.startup))
    ) {
      const now = new Date()
      for (const file of settings) {
        utimesSync(file, now, now)
      }
      if (settings.length > 0) {
        out.repaint()
      }
    }
  },
  plan: (ctx) =>
    ctx.state.wtHome
      ? [`Write ${wtFragmentPath(ctx.state.wtHome)} — its schemes, and touch settings.json so it reloads`]
      : [],
  notes: (ctx) =>
    ctx.state.wtHome
      ? []
      : [
          'Windows Terminal: %LOCALAPPDATA% was not found — drop the release fragment into its Fragments folder yourself',
        ],
  next: () => ['Windows Terminal  Reloads its settings by itself'],
  unwire(_, state) {
    const wtHome = state?.wtHome
    const dir = wtHome ? dirname(wtFragmentPath(wtHome)) : undefined
    return {
      edits: [],
      removals: dir && existsSync(dir) ? [dir] : [],
      touches: wtHome ? wtSettings(wtHome) : [],
    }
  },
}
