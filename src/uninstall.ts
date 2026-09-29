import { existsSync, rmSync, utimesSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import * as p from '@clack/prompts'
import { cacheRoot } from './booru.ts'
import { restoreUserFile } from './edits.ts'
import { Cancelled } from './init.ts'
import { configHome as configDir, type Installed, pointDefaults, readInstalled } from './palettes.ts'
import { localRoot } from './sources.ts'
import { ownedIn, stripped, systemHost } from './terminals/common.ts'
import { WIRED, wirings } from './terminals/index.ts'
import type { Host } from './terminals/types.ts'
import { removeBlock } from './wiring.ts'

export interface UninstallPaths {
  home: string
  configHome: string
  zdotdir: string
  cacheDir: string
  stateDir: string
}

export interface UninstallPlan {
  edits: { file: string; content: string }[]
  removals: string[]
  touches: string[]
  state?: Installed
}

function installed(configHome: string): Installed | undefined {
  try {
    return readInstalled(configHome)
  } catch {
    return undefined
  }
}

export function planUninstall(paths: UninstallPaths): UninstallPlan {
  const { home, configHome } = paths
  const state = installed(configHome)
  const at = { configHome, home }
  const every = wirings(WIRED)
  const parts = every.map((wiring) => wiring.unwire(at, state))
  const owns = [join(configHome, 'ttheme'), paths.cacheDir, paths.stateDir]
  return {
    edits: [...stripped(join(paths.zdotdir, '.zshrc'), removeBlock), ...parts.flatMap((part) => part.edits)],
    removals: [
      ...every.flatMap((wiring) => (wiring.shelf ? ownedIn(wiring.shelf.dir(at)) : [])),
      ...parts.flatMap((part) => part.removals),
      ...owns.filter((path) => existsSync(path)),
    ],
    touches: parts.flatMap((part) => part.touches),
    ...(state ? { state } : {}),
  }
}

export function applyUninstall(plan: UninstallPlan, paths: UninstallPaths, host: Host = systemHost()): string[] {
  const done: string[] = []
  for (const { file, content } of plan.edits) {
    const result = restoreUserFile(file, content)
    done.push(
      result === 'removed'
        ? `Removed ${file} — ttheme had created it`
        : result === 'restored'
          ? `Took ttheme out of ${file}`
          : `Took ttheme out of ${file} — kept ${file}.ttheme.bak, since the file changed after ttheme's first edit`,
    )
  }
  if (plan.state) {
    const pointed = pointDefaults(paths.configHome, { ...plan.state, off: true, palettes: [] }, false, host, paths.home)
    for (const wiring of wirings(plan.state.terminals)) {
      if (pointed.has(wiring.id)) {
        done.push(`Gave ${wiring.name} its own default profile back — it takes it at its next start`)
      }
    }
  }
  for (const path of plan.removals) {
    rmSync(path, { recursive: true, force: true })
  }
  if (plan.removals.length > 0) {
    done.push(`Deleted ${plan.removals.length} files and folders ttheme wrote`)
  }
  const now = new Date()
  for (const file of plan.touches) {
    utimesSync(file, now, now)
  }
  return done
}

function uninstallPaths(): UninstallPaths {
  const home = homedir()
  return {
    home,
    configHome: configDir(),
    zdotdir: process.env.ZDOTDIR ?? home,
    cacheDir: cacheRoot(),
    stateDir: join(process.env.XDG_STATE_HOME ?? join(home, '.local', 'state'), 'ttheme'),
  }
}

export async function runUninstall(yes = false): Promise<void> {
  const paths = uninstallPaths()
  const plan = planUninstall(paths)
  if (plan.edits.length === 0 && plan.removals.length === 0) {
    console.log('Nothing of ttheme is installed')
    return
  }
  if (!yes) {
    if (process.stdin.isTTY !== true || process.stdout.isTTY !== true) {
      throw new Error('uninstall asks before it deletes anything — run it in a terminal, or pass --yes')
    }
    const tthemeDir = join(paths.configHome, 'ttheme')
    p.intro('ttheme uninstall')
    p.note(
      [
        ...plan.edits.map((e) => `Take ttheme out of ${e.file}`),
        ...plan.removals.map((r) =>
          r === tthemeDir
            ? `Delete ${r} — settings, pins, every installed picture${existsSync(localRoot(paths.configHome)) ? `, and your markets under ${localRoot(paths.configHome)} (push them to GitHub first to keep them)` : ''}`
            : `Delete ${r}`,
        ),
      ].join('\n'),
      'Uninstall',
    )
    const ok = await p.confirm({ message: 'Remove ttheme?' })
    if (p.isCancel(ok) || !ok) {
      p.cancel('Nothing changed')
      throw new Cancelled()
    }
  }
  for (const line of applyUninstall(plan, paths)) {
    console.log(line)
  }
  console.log('Open tabs keep their colors until they close — restart your terminal to drop ttheme everywhere')
}
