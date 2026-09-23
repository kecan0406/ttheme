import { execFileSync, spawnSync } from 'node:child_process'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import * as p from '@clack/prompts'
import { build } from './build.ts'
import { writeCatalog } from './catalog.ts'
import type { Manifest } from './emit/manifest.ts'
import { pickPalettes } from './market.ts'
import { paletteOsc } from './osc.ts'
import {
  alacrittyConfig,
  type Installed,
  type ItermDefaults,
  itermDefaults,
  pointItermDefault,
  readInstalled,
  startupPalette,
  sync,
  warpThemes,
  weztermConfig,
  withItermBase,
  worn,
  writeInstalled,
} from './palettes.ts'
import {
  configFile,
  detectTerminal,
  INIT_TERMINALS,
  type InitTerminal,
  upsertAlacrittyImport,
  upsertBlock,
  upsertLuaBlock,
  zshrcBlock,
} from './wiring.ts'

export interface InitOptions {
  terminals: InitTerminal[]
  palettes: string[]
  off?: boolean
}

export interface InitPaths {
  root: string
  home: string
  configHome: string
  zdotdir: string
  wtHome?: string
  wtProfile?: string
}

export interface InitPlan {
  home: string
  copies: { from: string; to: string; executable?: boolean }[]
  edits: { file: string; block: string }[]
  settings: { file: string; content: string }
  catalog: Manifest
  installed: Installed
  notes: string[]
}

function copyDir(copies: InitPlan['copies'], from: string, to: string): void {
  for (const f of readdirSync(from)) {
    copies.push({ from: join(from, f), to: join(to, f) })
  }
}

export function loadManifest(root: string): Manifest {
  return JSON.parse(readFileSync(join(root, 'dist', 'manifest.json'), 'utf8'))
}

export function planInit(opts: InitOptions, paths: InitPaths): InitPlan {
  const dist = join(paths.root, 'dist')
  const home = join(paths.configHome, 'ttheme')
  const copies: InitPlan['copies'] = [
    { from: join(paths.root, 'bin', 'ttheme.js'), to: join(home, 'ttheme.js') },
    { from: join(paths.root, 'shell', 'ttheme.zsh'), to: join(home, 'ttheme.zsh') },
    { from: join(paths.root, 'shell', 'launch-tab.zsh'), to: join(home, 'launch-tab.zsh'), executable: true },
    { from: join(dist, 'ghostty', 'ttheme.conf'), to: join(home, 'ttheme.conf') },
  ]
  copyDir(copies, join(paths.root, 'shell', 'adapters'), join(home, 'adapters'))
  const edits: InitPlan['edits'] = [{ file: join(paths.zdotdir, '.zshrc'), block: zshrcBlock(home) }]
  const configPath = join(home, 'config.zsh')
  const seeded = configFile(existsSync(configPath) ? readFileSync(configPath, 'utf8') : '')
  const settings = { file: configPath, content: seeded }
  const notes: string[] = []
  if (opts.terminals.includes('ghostty')) {
    copyDir(copies, join(paths.root, 'ghostty', 'shaders'), join(paths.configHome, 'ghostty', 'shaders'))
  }
  if (opts.terminals.includes('alacritty')) {
    const config = alacrittyConfig(paths.configHome)
    if (existsSync(config) && upsertAlacrittyImport(readFileSync(config, 'utf8'), undefined) === undefined) {
      notes.push(
        `${config} already imports files under [general] — ttheme left it alone; add ${join(paths.configHome, 'alacritty', 'themes')}/<palette>.toml to that import list yourself`,
      )
    }
  }
  if (opts.terminals.includes('wezterm')) {
    const config = weztermConfig(paths.configHome, paths.home)
    if (existsSync(config) && upsertLuaBlock(readFileSync(config, 'utf8'), '') === undefined) {
      notes.push(
        `${config} has no \`return config\` line — ttheme left it alone; call \`dofile("${join(home, 'wezterm.lua')}")(config)\` from it yourself`,
      )
    }
  }
  const wt = opts.terminals.includes('windows-terminal')
  if (wt && !paths.wtHome) {
    notes.push(
      'windows terminal: %LOCALAPPDATA% was not found — drop the release fragment into its Fragments folder yourself',
    )
  }
  if (opts.terminals.includes('warp')) {
    notes.push(
      'warp: wears the default palette app-wide through its settings.toml — the shell layer stays off in it, since Warp paints no tab background of its own',
    )
  }
  const installed: Installed = {
    terminals: opts.terminals,
    palettes: opts.palettes,
    ...(wt && paths.wtHome ? { wtHome: paths.wtHome } : {}),
    ...(wt && paths.wtProfile ? { wtProfile: paths.wtProfile } : {}),
    ...(opts.off ? { off: true as const } : {}),
  }
  return { home: paths.home, copies, edits, settings, catalog: loadManifest(paths.root), installed, notes }
}

function keptBase(configHome: string): string | undefined {
  try {
    return readInstalled(configHome).itermBase
  } catch {
    return undefined
  }
}

export function applyInit(plan: InitPlan, prefs: ItermDefaults = itermDefaults()): boolean {
  for (const c of plan.copies) {
    mkdirSync(dirname(c.to), { recursive: true })
    rmSync(c.to, { force: true })
    rmSync(`${c.to}.zwc`, { force: true })
    copyFileSync(c.from, c.to)
    if (c.executable) {
      chmodSync(c.to, 0o755)
    }
  }
  mkdirSync(dirname(plan.settings.file), { recursive: true })
  writeFileSync(plan.settings.file, plan.settings.content)
  const configHome = dirname(dirname(plan.settings.file))
  const base = keptBase(configHome)
  const installed = withItermBase(base ? { ...plan.installed, itermBase: base } : plan.installed, prefs)
  writeCatalog(configHome, plan.catalog)
  writeInstalled(configHome, installed)
  sync(configHome, plan.catalog, installed, plan.home)
  for (const e of plan.edits) {
    mkdirSync(dirname(e.file), { recursive: true })
    const current = existsSync(e.file) ? readFileSync(e.file, 'utf8') : ''
    writeFileSync(e.file, upsertBlock(current, e.block))
  }
  return pointItermDefault(installed, prefs)
}

function accepted<T>(value: T | symbol): T {
  if (p.isCancel(value)) {
    p.cancel('nothing changed')
    process.exit(1)
  }
  return value as T
}

function offered(paths: InitPaths): InitTerminal[] {
  return INIT_TERMINALS.filter((t) => {
    if (t === 'iterm2') {
      return process.platform === 'darwin'
    }
    if (t === 'windows-terminal') {
      return paths.wtHome !== undefined
    }
    return t !== 'warp' || process.platform !== 'win32'
  })
}

function present(terminal: InitTerminal, paths: InitPaths): boolean {
  if (terminal === 'iterm2') {
    return existsSync(join(paths.home, 'Library', 'Application Support', 'iTerm2'))
  }
  if (terminal === 'windows-terminal') {
    return paths.wtHome !== undefined
  }
  if (terminal === 'warp') {
    return existsSync(dirname(warpThemes(paths.home)))
  }
  if (terminal === 'wezterm') {
    return existsSync(join(paths.configHome, 'wezterm')) || existsSync(join(paths.home, '.wezterm.lua'))
  }
  return existsSync(join(paths.configHome, terminal))
}

function windowsAppData(): string | undefined {
  if (process.platform === 'win32') {
    return process.env.LOCALAPPDATA
  }
  if (!process.env.WSL_DISTRO_NAME) {
    return undefined
  }
  const run = (command: string, args: string[]) =>
    execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  try {
    return run('wslpath', ['-u', run('cmd.exe', ['/d', '/c', 'echo %LOCALAPPDATA%'])]) || undefined
  } catch {
    return undefined
  }
}

async function askTerminals(detected: string, preselected: InitTerminal[], paths: InitPaths): Promise<InitTerminal[]> {
  return accepted(
    await p.multiselect({
      message: 'wire which terminals?',
      options: offered(paths).map((t) => ({ value: t, hint: t === detected ? 'detected' : undefined })),
      initialValues: preselected,
      required: true,
    }),
  )
}

function verify(plan: InitPlan): void {
  const missing = [
    ...plan.copies.filter((c) => !existsSync(c.to)).map((c) => c.to),
    ...(existsSync(plan.settings.file) ? [] : [plan.settings.file]),
    ...plan.edits.filter((e) => !readFileSync(e.file, 'utf8').includes('# ttheme begin')).map((e) => e.file),
  ]
  if (missing.length > 0) {
    throw new Error(`init left gaps:\n${missing.join('\n')}`)
  }
}

function seriesOf(catalog: Manifest, names: string[]): string[] {
  return [...new Set(catalog.palettes.filter((e) => names.includes(e.name)).map((e) => e.group))]
}

function paintStartup(catalog: Manifest, installed: Installed): boolean {
  const startup = catalog.palettes.find((e) => e.name === worn(installed))
  const live =
    process.stdout.isTTY === true &&
    !process.env.NO_COLOR &&
    !process.env.TMUX &&
    detectTerminal(process.env) !== 'warp'
  if (!startup || !live) {
    return false
  }
  process.stdout.write(paletteOsc(startup))
  return true
}

function startupLines(installed: Installed, painted: boolean): string[] {
  const startup = worn(installed)
  if (!startup) {
    return [
      'default    none — new tabs keep the terminal colors',
      `turn on    \`ttheme on\` wears ${startupPalette(installed)}`,
    ]
  }
  return [
    `default    ${startup}${painted ? ' — this tab wears it already' : ''}`,
    'change it  `ttheme preview`, enter on a palette, then default',
  ]
}

function pickDefault(configHome: string): void {
  spawnSync('zsh', ['-c', 'source "$1" && __tt_preview init', 'zsh', join(configHome, 'ttheme', 'ttheme.zsh')], {
    stdio: 'inherit',
  })
}

function receipt(plan: InitPlan, opts: InitOptions, painted: boolean, restart: boolean): void {
  const series = seriesOf(plan.catalog, opts.palettes)
  p.note(
    [`${series.join(', ')} (${opts.palettes.length})`, ...startupLines(plan.installed, painted)].join('\n'),
    `installed ${opts.palettes.length} palettes`,
  )
  const next = ['exec zsh          the ttheme command in this tab']
  if (opts.terminals.includes('ghostty')) {
    next.push('restart ghostty   new tabs pick up its config')
  }
  if (opts.terminals.includes('kitty')) {
    next.push('new kitty window  pictures follow it — kitty reloads its colors by itself')
  }
  if (opts.terminals.includes('alacritty')) {
    next.push('alacritty         reloads its config by itself')
  }
  if (opts.terminals.includes('wezterm')) {
    next.push('wezterm           reloads its config by itself')
  }
  if (opts.terminals.includes('windows-terminal')) {
    next.push('windows terminal  reloads its settings by itself')
  }
  if (opts.terminals.includes('iterm2')) {
    next.push(...itermLines(worn(plan.installed), restart))
  }
  p.note([...next, ...plan.notes].join('\n'), 'next')
  p.outro('done')
}

function itermLines(startup: string | undefined, restart: boolean): string[] {
  const lines = ['iterm2 profiles   a "ttheme · <palette>" per palette in Settings › Profiles']
  if (startup) {
    lines.push(
      restart
        ? `restart iterm2    new tabs open on "ttheme · default", which wears ${startup}`
        : `iterm2 default    "ttheme · default" wears ${startup} and follows \`ttheme default\``,
    )
  }
  return lines
}

function report(plan: InitPlan, opts: InitOptions): void {
  const lines = [
    `placed ${plan.copies.length} files`,
    `settings in ${plan.settings.file} — edit later with \`ttheme config\``,
    ...plan.edits.map((e) => `wired ${e.file}`),
  ]
  if (opts.terminals.includes('ghostty')) {
    lines.push('restart ghostty to pick up its config')
  }
  if (opts.terminals.includes('kitty')) {
    lines.push('kitty reloads its colors by itself; pictures show in kitty windows opened from now on')
  }
  if (opts.terminals.includes('alacritty')) {
    lines.push('alacritty reloads its config by itself')
  }
  if (opts.terminals.includes('wezterm') || opts.terminals.includes('windows-terminal')) {
    lines.push('wezterm and windows terminal reload their config by themselves')
  }
  if (opts.terminals.includes('iterm2')) {
    lines.push('iterm2 gets a "ttheme · <palette>" profile per palette under Settings › Profiles')
  }
  lines.push(...plan.notes)
  lines.push('no palettes yet — open a new shell (`exec zsh`), then `ttheme browse` picks them from the catalog')
  console.log(lines.join('\n'))
}

export async function runInit(flags: { yes?: boolean } = {}): Promise<void> {
  const root = join(import.meta.dirname, '..')
  if (!existsSync(join(root, 'bin', 'ttheme.js'))) {
    throw new Error('bin/ttheme.js is missing — run `mise run bin:build` first')
  }
  if (!existsSync(join(root, 'dist'))) {
    if (typeof Bun === 'undefined') {
      throw new Error('this package is missing dist/ — reinstall @kecan0406/ttheme')
    }
    await build()
  }
  const home = homedir()
  const configHome = process.env.XDG_CONFIG_HOME ?? join(home, '.config')
  const zdotdir = process.env.ZDOTDIR ?? home
  const wtHome = windowsAppData()
  const wtProfile = process.env.WT_PROFILE_ID
  const paths: InitPaths = {
    root,
    home,
    configHome,
    zdotdir,
    ...(wtHome ? { wtHome } : {}),
    ...(wtProfile ? { wtProfile } : {}),
  }
  const detected = detectTerminal(process.env)
  const preselected = offered(paths).filter((t) => t === detected || present(t, paths))
  const interactive = !flags.yes && process.stdin.isTTY === true && process.stdout.isTTY === true
  if (!interactive) {
    if (preselected.length === 0) {
      throw new Error(
        'no supported terminal detected — run this inside ghostty, kitty, alacritty, wezterm, iterm2, windows terminal or warp',
      )
    }
    const opts: InitOptions = { terminals: preselected, palettes: [] }
    const plan = planInit(opts, paths)
    applyInit(plan)
    verify(plan)
    report(plan, opts)
    return
  }
  p.intro('ttheme init')
  const terminals = await askTerminals(detected, preselected, paths)
  const catalog = loadManifest(root)
  const palettes = await pickPalettes(catalog, [], 'series', true)
  if (!palettes) {
    p.cancel('nothing changed')
    process.exit(1)
  }
  const first = palettes[0]
  const choose = palettes.length > 1 && detectTerminal(process.env) !== 'warp'
  const wear = accepted(
    await p.confirm({
      message: choose ? 'pick a default palette in ttheme preview once installed?' : `wear ${first} in every tab?`,
    }),
  )
  const opts: InitOptions = { terminals, palettes, off: !wear }
  const plan = planInit(opts, paths)
  p.note(
    [
      `install ${palettes.length} palettes — ${seriesOf(plan.catalog, palettes).join(', ')}`,
      `copy ${plan.copies.length} files under ${configHome}`,
      `write ${plan.settings.file}`,
      ...plan.edits.map((e) => `edit ${e.file}`),
      wear
        ? choose
          ? `open ttheme preview — every tab wears the palette picked there, ${first} until then`
          : `paint every tab with ${first}, this one now`
        : 'leave the terminal colors as they are — `ttheme on` wears a palette later',
      ...(terminals.includes('iterm2') && wear ? ['make "ttheme · default" the iTerm2 default profile'] : []),
    ].join('\n'),
    `wiring ${terminals.join(', ')}`,
  )
  if (!accepted(await p.confirm({ message: 'apply these changes?' }))) {
    p.cancel('nothing changed')
    process.exit(1)
  }
  const prefs = itermDefaults()
  const moved = applyInit(plan, prefs)
  verify(plan)
  if (wear && choose) {
    pickDefault(configHome)
  }
  const installed = readInstalled(configHome)
  receipt({ ...plan, installed }, opts, paintStartup(plan.catalog, installed), moved && prefs.running())
}
