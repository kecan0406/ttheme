import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import * as p from '@clack/prompts'
import pkg from '../package.json' with { type: 'json' }
import { build } from './build.ts'
import { Cancelled } from './cancelled.ts'
import { available, parseCatalog, readCatalog, writeCatalog } from './catalog.ts'
import { editUserFile, writeAtomic } from './edits.ts'
import { pickPalettes } from './installs.ts'
import { liveOf } from './live.ts'
import type { Manifest, PaletteEntry } from './manifest.ts'
import {
  configHome as configDir,
  type Installed,
  pointDefaults,
  readInstalled,
  startupPalette,
  sync,
  wiringNext,
  wiringNotes,
  wiringPlan,
  withBases,
  worn,
  writeInstalled,
} from './palettes.ts'
import { redrawPictures } from './redraw.ts'
import {
  bashBlock,
  bashFiles,
  fishFunction,
  fishText,
  hasZsh,
  invokingShell,
  ownsFish,
  type Shell,
  shellNamed,
  shellsOf,
  zdotdirOf,
} from './shells.ts'
import { marketsOf, OFFICIAL } from './sources.ts'
import { detectTerminal, TRAITS } from './terminal.ts'
import { systemHost, tilde } from './terminals/common.ts'
import { WIRED, WIRINGS, type Wired, wirings } from './terminals/index.ts'
import type { Host, Pointed, Setup } from './terminals/types.ts'
import { warpSettings } from './terminals/warp.ts'
import { windowsAppData } from './terminals/windows-terminal.ts'
import { marketOf } from './theme.ts'
import { configFile, settingValue, upsertBlock, withSetting, zshrcBlock } from './wiring.ts'

export interface InitOptions {
  terminals: Wired[]
  palettes: string[]
  off?: boolean
  warpFast?: boolean
}

export interface InitPaths extends Setup {
  root: string
  zdotdir: string
  stateDir?: string
  shells?: Shell[]
  platform?: NodeJS.Platform
}

export interface InitPlan {
  home: string
  copies: { from: string; to: string; executable?: boolean }[]
  edits: { file: string; block: string; about: string }[]
  writes: { file: string; content: string; about: string }[]
  settings: { file: string; content: string }
  forget: string[]
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
  return parseCatalog(readFileSync(join(root, 'dist', 'manifest.json'), 'utf8'))
}

export function planInit(opts: InitOptions, paths: InitPaths): InitPlan {
  const home = join(paths.configHome, 'ttheme')
  const copies: InitPlan['copies'] = [
    { from: join(paths.root, 'bin', 'ttheme.js'), to: join(home, 'ttheme.js') },
    { from: join(paths.root, 'bin', 'ttheme.js.map'), to: join(home, 'ttheme.js.map') },
    { from: join(paths.root, 'bin', 'package.json'), to: join(home, 'package.json') },
    { from: join(paths.root, 'shell', 'ttheme.zsh'), to: join(home, 'ttheme.zsh') },
    { from: join(paths.root, 'shell', 'preview.zsh'), to: join(home, 'preview.zsh') },
    { from: join(paths.root, 'shell', 'launch-tab.zsh'), to: join(home, 'launch-tab.zsh'), executable: true },
  ]
  copyDir(copies, join(paths.root, 'shell', 'adapters'), join(home, 'adapters'))
  const shells = paths.shells ?? ['zsh']
  const edits: InitPlan['edits'] = [
    { file: join(paths.zdotdir, '.zshrc'), block: zshrcBlock(), about: 'source ttheme.zsh' },
    ...(shells.includes('bash')
      ? bashFiles(paths.home, paths.platform ?? process.platform).map((file) => ({
          file,
          block: bashBlock(),
          about: 'the ttheme command, run through zsh',
        }))
      : []),
  ]
  const fish = fishFunction(paths.configHome)
  const ours = !existsSync(fish) || ownsFish(readFileSync(fish, 'utf8'))
  const writes: InitPlan['writes'] =
    shells.includes('fish') && ours
      ? [{ file: fish, content: fishText(), about: 'the ttheme command, run through zsh' }]
      : []
  const configPath = join(home, 'config.zsh')
  const seeded = configFile(existsSync(configPath) ? readFileSync(configPath, 'utf8') : '')
  const settings = {
    file: configPath,
    content:
      opts.warpFast === undefined ? seeded : withSetting(seeded, 'TTHEME_WARP_FAST', opts.warpFast ? 'on' : 'off'),
  }
  const installed: Installed = {
    terminals: opts.terminals,
    palettes: opts.palettes,
    ...Object.fromEntries(
      wirings(opts.terminals).flatMap((wiring) =>
        Object.entries(wiring.installs?.(paths) ?? {}).filter(([, value]) => value !== undefined),
      ),
    ),
    ...(opts.off ? { off: true as const } : {}),
  }
  const notes = [
    ...wiringNotes(paths.configHome, installed, paths.home),
    ...(shells.includes('fish') && !ours
      ? [`${tilde(fish, paths.home)} is a function of your own — ttheme left it, so fish has no ttheme command`]
      : []),
    ...(shells.some((shell) => shell !== 'zsh')
      ? [
          `${shells.filter((shell) => shell !== 'zsh').join(' and ')} run ttheme through zsh — a pin taking effect on cd, the picture following the tab in front and the repaint after a program resets the colors stay with zsh tabs`,
        ]
      : []),
  ]
  const forget = paths.stateDir ? [join(paths.stateDir, 'ghostty', '.blind')] : []
  return {
    home: paths.home,
    copies,
    edits,
    writes,
    settings,
    forget,
    catalog: loadManifest(paths.root),
    installed,
    notes,
  }
}

export function installedState(configHome: string): Installed | undefined {
  try {
    return readInstalled(configHome)
  } catch {
    return undefined
  }
}

function currentPalettes(configHome: string, official: Manifest): PaletteEntry[] {
  try {
    return available(configHome, readCatalog(configHome, false, official), false).palettes
  } catch {
    return []
  }
}

export function againCatalog(state: Installed, paths: InitPaths): Manifest {
  const bundled = loadManifest(paths.root)
  const official = marketsOf(state.markets).includes(OFFICIAL) ? bundled.palettes : []
  const names = new Set(official.map((e) => e.name))
  const others = currentPalettes(paths.configHome, bundled).filter(
    (e) => !names.has(e.name) && (marketOf(e.name) !== undefined || state.palettes.includes(e.name)),
  )
  return { ...bundled, palettes: [...official, ...others] }
}

export function keptStartup(state: Installed, palettes: string[]): string | undefined {
  const was = startupPalette(state)
  return was && palettes.includes(was) ? was : undefined
}

export function planAgain(state: Installed, opts: InitOptions, paths: InitPaths): InitPlan {
  const plan = planInit(opts, paths)
  const startup = keptStartup(state, opts.palettes)
  const asked = new Set<string>([
    'terminals',
    'palettes',
    'off',
    'startup',
    ...WIRED.flatMap((id) => Object.keys(WIRINGS[id].installs?.(paths) ?? {})),
  ])
  const kept = Object.fromEntries(Object.entries(state).filter(([key]) => !asked.has(key)))
  return {
    ...plan,
    installed: { ...kept, ...plan.installed, ...(startup ? { startup } : {}) } as Installed,
  }
}

export function planUpgrade(state: Installed, paths: InitPaths): InitPlan {
  const plan = planInit({ terminals: state.terminals, palettes: state.palettes, off: state.off }, paths)
  const known = new Set(
    [...plan.catalog.palettes, ...currentPalettes(paths.configHome, plan.catalog)].map((e) => e.name),
  )
  const palettes = state.palettes.filter((n) => known.has(n))
  const gone = state.palettes.filter((n) => !known.has(n))
  const { startup, ...rest } = state
  const installed: Installed = {
    ...rest,
    palettes,
    ...(startup && palettes.includes(startup) ? { startup } : {}),
  }
  const notes = gone.length > 0 ? [`Dropped ${gone.join(', ')} — no longer in the catalog`, ...plan.notes] : plan.notes
  return { ...plan, installed, notes }
}

function installedVersion(configHome: string): string | undefined {
  try {
    const out = execFileSync(process.execPath, [join(configHome, 'ttheme', 'ttheme.js'), '--version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return out.trim() || undefined
  } catch {
    return undefined
  }
}

function summary(state: Installed): string {
  const startup = worn(state)
  return [
    wirings(state.terminals)
      .map((wiring) => wiring.name)
      .join(', '),
    `${state.palettes.length} palettes`,
    startup ? `default ${startup}` : 'no default — ttheme is off',
  ].join(' · ')
}

export function applyInit(plan: InitPlan, host: Host = systemHost()): Map<Wired, Pointed> {
  for (const c of plan.copies) {
    mkdirSync(dirname(c.to), { recursive: true })
    rmSync(c.to, { force: true })
    rmSync(`${c.to}.zwc`, { force: true })
    copyFileSync(c.from, c.to)
    if (c.executable) {
      chmodSync(c.to, 0o755)
    }
  }
  writeAtomic(plan.settings.file, plan.settings.content)
  for (const f of plan.forget) {
    rmSync(f, { force: true })
  }
  const configHome = dirname(dirname(plan.settings.file))
  const kept = installedState(configHome)
  const carried = Object.fromEntries(
    wirings(plan.installed.terminals).flatMap((wiring) => {
      const key = wiring.defaults?.key
      const base = key ? kept?.[key] : undefined
      return key && base ? [[key, base]] : []
    }),
  )
  const installed = withBases(configHome, { ...plan.installed, ...carried }, host, plan.home)
  if (marketsOf(installed.markets).includes(OFFICIAL)) {
    writeCatalog(configHome, plan.catalog)
  }
  writeInstalled(configHome, installed)
  sync(configHome, readCatalog(configHome), installed, plan.home, host)
  for (const e of plan.edits) {
    mkdirSync(dirname(e.file), { recursive: true })
    const current = existsSync(e.file) ? readFileSync(e.file, 'utf8') : ''
    editUserFile(e.file, upsertBlock(current, e.block))
  }
  for (const w of plan.writes) {
    writeAtomic(w.file, w.content)
  }
  return pointDefaults(configHome, installed, true, host, plan.home)
}

function accepted<T>(value: T | typeof p.CANCEL_SYMBOL): T {
  if (p.isCancel(value)) {
    p.cancel('Nothing changed')
    throw new Cancelled()
  }
  return value as T
}

function offered(paths: InitPaths, host: Host): Wired[] {
  return WIRED.filter((id) => WIRINGS[id].offered(paths, host))
}

async function askTerminals(detected: string, preselected: Wired[], paths: InitPaths, host: Host): Promise<Wired[]> {
  return accepted(
    await p.multiselect({
      message: 'Wire which terminals?',
      options: offered(paths, host).map((t) => ({
        value: t,
        label: WIRINGS[t].name,
        hint: t === detected ? 'detected' : undefined,
      })),
      initialValues: preselected,
      required: true,
    }),
  )
}

async function askWarpFast(configHome: string): Promise<boolean> {
  return accepted(
    await p.confirm({
      message:
        "Switch Warp to each tab's palette in about 0.2 s instead of 0.6 s?\nAbout 8% CPU while Warp is in front with tabs of different palettes — `ttheme config` changes it",
      initialValue: settingValue(configHome, 'TTHEME_WARP_FAST') !== 'off',
    }),
  )
}

function verify(plan: InitPlan): void {
  const missing = [
    ...plan.copies.filter((c) => !existsSync(c.to)).map((c) => c.to),
    ...(existsSync(plan.settings.file) ? [] : [plan.settings.file]),
    ...plan.edits.filter((e) => !readFileSync(e.file, 'utf8').includes('# ttheme begin')).map((e) => e.file),
    ...plan.writes.filter((w) => !existsSync(w.file)).map((w) => w.file),
  ]
  if (missing.length > 0) {
    throw new Error(`init left gaps:\n${missing.join('\n')}`)
  }
}

function seriesOf(catalog: Manifest, names: string[]): string[] {
  return [...new Set(catalog.palettes.filter((e) => names.includes(e.name)).map((e) => e.group))]
}

function paintStartup(catalog: Manifest, installed: Installed, configHome: string): boolean {
  const startup = catalog.palettes.find((e) => e.name === worn(installed))
  const tty = process.stdout.isTTY === true
  const wear = startup && liveOf(process.env, tty, configHome)?.wear(startup, installed.terminals)
  if (wear === undefined) {
    return false
  }
  process.stdout.write(wear)
  return true
}

function startupLines(installed: Installed, painted: boolean): string[] {
  const startup = worn(installed)
  if (!startup) {
    return [
      'Default    none — new tabs keep the terminal colors',
      `Turn on    \`ttheme on\` wears ${startupPalette(installed)}`,
    ]
  }
  return [
    `Default    ${startup}${painted ? ' — this tab wears it already' : ''}`,
    'Change it  `ttheme`, enter on a palette, then default',
  ]
}

function pickDefault(configHome: string): void {
  spawnSync('zsh', ['-c', 'source "$1" && __tt_preview init', 'zsh', join(configHome, 'ttheme', 'ttheme.zsh')], {
    stdio: 'inherit',
  })
}

function reopen(shell: Shell): string {
  return shell === 'bash' ? 'exec bash -l' : `exec ${shell}`
}

function receipt(
  plan: InitPlan,
  opts: InitOptions,
  painted: boolean,
  pointed: ReadonlyMap<Wired, Pointed>,
  here: Shell,
): void {
  const series = seriesOf(plan.catalog, opts.palettes)
  p.note(
    [`${series.join(', ')} (${opts.palettes.length})`, ...startupLines(plan.installed, painted)].join('\n'),
    `Installed ${opts.palettes.length} palettes`,
  )
  p.note([`${reopen(here).padEnd(18)}The ttheme command in this tab`, ...nextLines(plan, pointed)].join('\n'), 'Next')
  p.outro('Done')
}

function nextLines(plan: InitPlan, pointed: ReadonlyMap<Wired, Pointed>): string[] {
  return [...wiringNext(dirname(dirname(plan.settings.file)), plan.installed, pointed, plan.home), ...plan.notes]
}

function say(interactive: boolean): (line: string) => void {
  return interactive ? (line) => p.log.step(line) : (line) => console.log(line)
}

async function upgrade(
  state: Installed,
  paths: InitPaths,
  host: Host,
  interactive: boolean,
  here: Shell,
): Promise<void> {
  const plan = planUpgrade(state, paths)
  const pointed = applyInit(plan, host)
  verify(plan)
  await redrawPictures(paths.configHome, say(interactive), paths.home)
  const lines = [
    `${reopen(here).padEnd(18)}Open tabs run the new layer — new tabs already do`,
    ...nextLines(plan, pointed),
  ]
  const title = `Updated to ${pkg.version} — kept ${summary(plan.installed)}`
  if (!interactive) {
    console.log([title, ...lines].join('\n'))
    return
  }
  p.note(lines.join('\n'), title)
  p.outro('Done')
}

function report(plan: InitPlan, pointed: ReadonlyMap<Wired, Pointed>, here: Shell): void {
  const lines = [
    `Placed ${plan.copies.length} files`,
    `Settings in ${plan.settings.file} — edit later with \`ttheme config\``,
    ...[...plan.edits, ...plan.writes].map((e) => `Wired ${e.file}`),
    ...nextLines(plan, pointed),
    `No palettes yet — open a new shell (\`${reopen(here)}\`), then \`ttheme\` picks them from the catalog`,
  ]
  console.log(lines.join('\n'))
}

export async function runInit(flags: { yes?: boolean } = {}): Promise<void> {
  const root = join(import.meta.dirname, '..')
  for (const file of ['ttheme.js', 'package.json']) {
    if (!existsSync(join(root, 'bin', file))) {
      throw new Error(`bin/${file} is missing — run \`mise run bin:build\` first`)
    }
  }
  if (!existsSync(join(root, 'dist'))) {
    if (typeof Bun === 'undefined') {
      throw new Error('this package is missing dist/ — reinstall @kecan0406/ttheme')
    }
    await build()
  }
  const home = homedir()
  const configHome = configDir()
  const host = systemHost()
  if (!hasZsh(host)) {
    throw new Error('ttheme runs its tab layer in zsh, even for bash and fish — install zsh first')
  }
  const wtHome = windowsAppData(host)
  const wtProfile = process.env.WT_PROFILE_ID
  const paths: InitPaths = {
    root,
    home,
    configHome,
    zdotdir: zdotdirOf(host, home),
    shells: shellsOf(host, process.ppid),
    platform: host.platform,
    stateDir: join(process.env.XDG_STATE_HOME ?? join(home, '.local', 'state'), 'ttheme'),
    ...(wtHome ? { wtHome } : {}),
    ...(wtProfile ? { wtProfile } : {}),
  }
  const here = invokingShell(host.run, process.ppid) ?? shellNamed(host.env.SHELL) ?? 'zsh'
  const detected = detectTerminal(process.env)
  const preselected = offered(paths, host).filter((t) => t === detected)
  if (!flags.yes && (process.stdin.isTTY !== true || process.stdout.isTTY !== true)) {
    throw new Error(
      'init asks before it edits your configs — run it in a terminal, or pass --yes to accept the defaults',
    )
  }
  const existing = installedState(configHome)
  if (flags.yes && existing) {
    await upgrade(existing, paths, host, false, here)
    return
  }
  if (flags.yes) {
    if (preselected.length === 0) {
      throw new Error(
        `no supported terminal detected — run this inside ${wirings(offered(paths, host))
          .map((wiring) => wiring.name.toLowerCase())
          .join(', ')
          .replace(/, ([^,]*)$/, ' or $1')}`,
      )
    }
    const opts: InitOptions = { terminals: preselected, palettes: [] }
    const plan = planInit(opts, paths)
    const pointed = applyInit(plan, host)
    verify(plan)
    report(plan, pointed, here)
    return
  }
  p.intro('ttheme init')
  if (existing) {
    const from = installedVersion(configHome)
    const keep = accepted(
      await p.confirm({
        message: `ttheme${from ? ` ${from}` : ''} is installed — ${summary(existing)}\n${from === pkg.version ? 'Reinstall' : 'Update to'} ${pkg.version} and keep all of it?`,
        active: 'Yes',
        inactive: 'No, set it up again',
        initialValue: true,
      }),
    )
    if (keep) {
      await upgrade(existing, paths, host, true, here)
      return
    }
  }
  const terminals = await askTerminals(detected, existing?.terminals ?? preselected, paths, host)
  const warpFast = terminals.includes('warp') ? await askWarpFast(configHome) : undefined
  const catalog = existing ? againCatalog(existing, paths) : loadManifest(root)
  const palettes = existing
    ? await pickPalettes(catalog, existing.palettes, 'palette', true)
    : await pickPalettes(catalog, [], 'series', true)
  if (!palettes) {
    p.cancel('Nothing changed')
    throw new Cancelled()
  }
  const first = (existing && keptStartup(existing, palettes)) ?? palettes[0]
  const choose =
    palettes.length > 1 &&
    (TRAITS[detected].paints ||
      (detected === 'warp' && terminals.includes('warp') && existsSync(warpSettings(home, configHome))))
  const wear = accepted(
    await p.confirm({
      message: choose ? 'Pick a default palette in ttheme once installed?' : `Wear ${first} in every tab?`,
      initialValue: existing ? !existing.off : true,
    }),
  )
  const opts: InitOptions = { terminals, palettes, off: !wear, warpFast }
  const plan = existing ? planAgain(existing, opts, paths) : planInit(opts, paths)
  p.note(
    [
      `Install ${palettes.length} palettes — ${seriesOf(catalog, palettes).join(', ')}`,
      `Copy ${plan.copies.length} files under ${configHome}`,
      `Write ${plan.settings.file}`,
      ...plan.edits.map((e) => `Edit ${e.file} — a ttheme block: ${e.about}`),
      ...plan.writes.map((w) => `Write ${w.file} — ${w.about}`),
      ...wiringPlan(configHome, plan.installed, home),
      'Each config is backed up once to <file>.ttheme.bak before the first edit — `npx @kecan0406/ttheme uninstall` takes it all out',
      wear
        ? choose
          ? `Open ttheme — every tab wears the palette picked there, ${first} until then`
          : `Paint every tab with ${first}, this one now`
        : 'Leave the terminal colors as they are — `ttheme on` wears a palette later',
      ...(wear && first
        ? wirings(terminals).flatMap((wiring) =>
            wiring.defaults ? [`Make "${wiring.defaults.profile(first)}" the ${wiring.name} default profile`] : [],
          )
        : []),
    ].join('\n'),
    `Wiring ${wirings(terminals)
      .map((wiring) => wiring.name)
      .join(', ')}`,
  )
  if (!accepted(await p.confirm({ message: 'Apply these changes?' }))) {
    p.cancel('Nothing changed')
    throw new Cancelled()
  }
  const pointed = applyInit(plan, host)
  verify(plan)
  await redrawPictures(configHome, say(true), home)
  if (wear && choose) {
    pickDefault(configHome)
  }
  const installed = readInstalled(configHome)
  receipt({ ...plan, catalog, installed }, opts, paintStartup(catalog, installed, configHome), pointed, here)
}
