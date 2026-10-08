import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, rmSync, statSync, utimesSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import * as p from '@clack/prompts'
import { cacheRoot } from './booru.ts'
import { Cancelled } from './cancelled.ts'
import { restoreUserFile } from './edits.ts'
import { configHome as configDir, type Installed, pointDefaults, readInstalled } from './palettes.ts'
import { bashCandidates, fishFunction, ownsFish, zdotdirOf } from './shells.ts'
import { localRoot } from './sources.ts'
import { ownedIn, stripped, systemHost } from './terminals/common.ts'
import { WIRED, wirings } from './terminals/index.ts'
import type { Host } from './terminals/types.ts'
import { owned } from './theme.ts'
import { removeBlock } from './wiring.ts'

export interface UninstallPaths {
  home: string
  configHome: string
  zdotdir: string
  cacheDir: string
  stateDir: string
}

interface UninstallPlan {
  edits: { file: string; content: string }[]
  removals: string[]
  touches: string[]
  state?: Installed
}

const SHIPPED_SHADERS = new Set([
  '814e75361c745b9f1467c82bee90ab3f47daeaa70a528d330a4bc8aec9faeeb9',
  '668092ea188445700b02d60a102c429e092e46fcd88c33509b9f1fd64d68e6a6',
  'bf52a8c6d019f59f71723be460d7fe450234d0f03ff0f35e94db2c42455f00ba',
  '8df4e3246f2cf26deaa0f620f31e94efac21104ec2dbe81fba55ba066141aeb4',
  '7bdc8051f34b902e970df84df0e4c8d27331b5e04da7f7b498d50b592eaa72f2',
  'e06b39cd6fa2701bd360b7062d82d4a56766aba97889dfa547d14db5895454f1',
])

function filesIn(dir: string): string[] {
  try {
    return readdirSync(dir)
      .map((file) => join(dir, file))
      .filter((path) => statSync(path).isFile())
  } catch {
    return []
  }
}

function unprefixed(path: string): boolean {
  const file = path.slice(path.lastIndexOf('/') + 1)
  if (file.startsWith(owned(''))) {
    return false
  }
  const name = file.replace(/\.(conf|toml)$/, '')
  const text = readFileSync(path, 'utf8')
  return (
    (text.startsWith(`# ${name} — `) && text.split('\n')[1]?.startsWith('# ANSI: ') === true) ||
    text.startsWith(`[metadata]\nname = "${name}"\norigin_url = "`)
  )
}

function oldShaders(dir: string): string[] {
  const files = filesIn(dir)
  const shipped = files.filter((path) =>
    SHIPPED_SHADERS.has(createHash('sha256').update(readFileSync(path)).digest('hex')),
  )
  return shipped.length > 0 && shipped.length === readdirSync(dir).length ? [dir] : shipped
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
  const fish = fishFunction(configHome)
  return {
    edits: [
      ...[...new Set([join(paths.zdotdir, '.zshrc'), join(home, '.zshrc')])].flatMap((file) =>
        stripped(file, removeBlock),
      ),
      ...bashCandidates(home).flatMap((file) => stripped(file, removeBlock)),
      ...parts.flatMap((part) => part.edits),
    ],
    removals: [
      ...(existsSync(fish) && ownsFish(readFileSync(fish, 'utf8')) ? [fish] : []),
      ...every.flatMap((wiring) => (wiring.shelf ? ownedIn(wiring.shelf.dir(at)) : [])),
      ...every.flatMap((wiring) => (wiring.shelf ? filesIn(wiring.shelf.dir(at)).filter(unprefixed) : [])),
      ...oldShaders(join(configHome, 'ghostty', 'shaders')),
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
    zdotdir: zdotdirOf(systemHost(), home),
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
