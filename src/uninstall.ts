import { existsSync, readdirSync, readFileSync, rmSync, utimesSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import * as p from '@clack/prompts'
import { cacheRoot } from './booru.ts'
import { restoreUserFile } from './edits.ts'
import { owned } from './emit/index.ts'
import { Cancelled } from './init.ts'
import { ownDir } from './own.ts'
import {
  alacrittyConfig,
  blockFile,
  configHome as configDir,
  type Installed,
  type ItermDefaults,
  itermDefaults,
  itermProfilesPath,
  pointItermDefault,
  readInstalled,
  themeDir,
  WARP_DEFAULT,
  warpBasePath,
  warpSettings,
  weztermConfig,
  wtFragmentPath,
  wtSettings,
} from './palettes.ts'
import { removeBlock, removeLuaBlock, warpThemeOf, withWarpTheme } from './wiring.ts'

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

function readText(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf8') : ''
}

function installed(configHome: string): Installed | undefined {
  try {
    return readInstalled(configHome)
  } catch {
    return undefined
  }
}

function warpEdit(configHome: string, home: string): { file: string; content: string } | undefined {
  const file = warpSettings(home, configHome)
  const content = readText(file)
  if (!warpThemeOf(content)?.includes(`path = "${owned('')}`)) {
    return undefined
  }
  return { file, content: withWarpTheme(content, readText(warpBasePath(configHome)) || WARP_DEFAULT) }
}

export function planUninstall(paths: UninstallPaths): UninstallPlan {
  const { home, configHome } = paths
  const state = installed(configHome)
  const edits: UninstallPlan['edits'] = []
  const strip = (file: string, remove: (content: string) => string) => {
    const content = readText(file)
    const next = remove(content)
    if (next !== content) {
      edits.push({ file, content: next })
    }
  }
  strip(join(paths.zdotdir, '.zshrc'), removeBlock)
  strip(blockFile('ghostty', configHome), removeBlock)
  strip(blockFile('kitty', configHome), removeBlock)
  strip(alacrittyConfig(configHome), removeBlock)
  strip(weztermConfig(configHome, home), removeLuaBlock)
  const warp = warpEdit(configHome, home)
  if (warp) {
    edits.push(warp)
  }
  const removals: string[] = []
  for (const terminal of ['ghostty', 'kitty', 'alacritty', 'wezterm', 'warp'] as const) {
    const dir = themeDir(terminal, configHome, home)
    if (existsSync(dir)) {
      removals.push(...readdirSync(dir).flatMap((file) => (file.startsWith(owned('')) ? [join(dir, file)] : [])))
    }
  }
  const owns = [
    itermProfilesPath(home),
    ...(state?.wtHome ? [dirname(wtFragmentPath(state.wtHome))] : []),
    join(configHome, 'ttheme'),
    paths.cacheDir,
    paths.stateDir,
  ]
  removals.push(...owns.filter((path) => existsSync(path)))
  return { edits, removals, touches: state?.wtHome ? wtSettings(state.wtHome) : [], ...(state ? { state } : {}) }
}

export function applyUninstall(plan: UninstallPlan, prefs: ItermDefaults = itermDefaults()): string[] {
  const done: string[] = []
  for (const { file, content } of plan.edits) {
    const result = restoreUserFile(file, content)
    done.push(
      result === 'removed'
        ? `removed ${file} — ttheme had created it`
        : result === 'restored'
          ? `took ttheme out of ${file}`
          : `took ttheme out of ${file} — kept ${file}.ttheme.bak, since the file changed after ttheme's first edit`,
    )
  }
  if (plan.state && pointItermDefault({ ...plan.state, off: true }, prefs)) {
    done.push('gave iTerm2 its own default profile back — it takes it at its next start')
  }
  for (const path of plan.removals) {
    rmSync(path, { recursive: true, force: true })
  }
  if (plan.removals.length > 0) {
    done.push(`deleted ${plan.removals.length} files and folders ttheme wrote`)
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
    console.log('nothing of ttheme is installed')
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
        ...plan.edits.map((e) => `take ttheme out of ${e.file}`),
        ...plan.removals.map((r) =>
          r === tthemeDir
            ? `delete ${r} — settings, pins, every installed picture${existsSync(ownDir(paths.configHome)) ? ', and the palettes you made (`ttheme share` prints a code that keeps one)' : ''}`
            : `delete ${r}`,
        ),
      ].join('\n'),
      'uninstall',
    )
    const ok = await p.confirm({ message: 'remove ttheme?' })
    if (p.isCancel(ok) || !ok) {
      p.cancel('nothing changed')
      throw new Cancelled()
    }
  }
  for (const line of applyUninstall(plan)) {
    console.log(line)
  }
  console.log('open tabs keep their colors until they close — restart your terminal to drop ttheme everywhere')
}
