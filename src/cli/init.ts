import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import * as p from '@clack/prompts'
import pkg from '../../package.json' with { type: 'json' }
import { Cancelled } from '../core/cancelled.ts'
import { aboutOf, worldOrder } from '../core/commons.ts'
import { inMode, type Manifest } from '../core/manifest.ts'
import type { Mode, Setting } from '../core/mode.ts'
import { BUILTIN, isBuiltin, publisherOf } from '../core/theme.ts'
import { WIRED, type Wired } from '../core/wired.ts'
import { backgroundsDir, coloringOf, decodable, readStore } from '../pictures/backdrop.ts'
import { ROOT } from '../root.ts'
import {
  type AgentHomes,
  agentHomes,
  detectedSkill,
  heldElsewhere,
  offeredSkills,
  placeSkill,
  SKILL,
  SKILL_LABELS,
  type SkillTarget,
  skillPath,
} from '../store/agent-skills.ts'
import { readAppearance, systemAppearance } from '../store/appearance.ts'
import { available, type Bundled, readMarketplaces, readPackaged, writeBundled } from '../store/available.ts'
import { editUserFile, writeAtomic } from '../store/edits.ts'
import { type Host, systemHost } from '../store/host.ts'
import { type Installed, readInstalled, startupPalette, worn, writeInstalled } from '../store/installed.ts'
import { configHome as configDir } from '../store/paths.ts'
import { marketplacesOf } from '../store/sources.ts'
import { coloringFor, configFile, modeFor, modeSetting, upsertBlock, withSetting, zshrcBlock } from '../store/wiring.ts'
import { tilde } from '../terminals/common.ts'
import { WIRINGS, wirings } from '../terminals/index.ts'
import { liveOf } from '../terminals/live.ts'
import { colorless } from '../terminals/osc.ts'
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
} from '../terminals/shells.ts'
import { detectTerminal, settingsFor, TRAITS } from '../terminals/terminal.ts'
import type { Pointed, Setup } from '../terminals/types.ts'
import { warpChannelOf, warpSettings } from '../terminals/warp.ts'
import { windowsAppData } from '../terminals/windows-terminal.ts'
import { cap } from '../tui/keycaps.ts'
import { logoOf } from '../tui/parts.ts'
import { painter } from '../tui/style.ts'
import { interactive } from '../tui/terminal.ts'
import { build } from './build.ts'
import { pickPalettes } from './installs.ts'
import { redrawPictures } from './redraw.ts'
import { pointDefaults, sync, wiringNext, wiringNotes, wiringPlan, withBases } from './sync.ts'

export interface InitOptions {
  terminals: Wired[]
  palettes: string[]
  off?: boolean
  mode?: Setting
  skills?: SkillTarget[]
}

export interface InitPaths extends Setup {
  root: string
  zdotdir: string
  stateDir?: string
  shells?: Shell[]
  platform?: NodeJS.Platform
  claudeHome?: string
}

interface InitPlan {
  home: string
  root: string
  agents: AgentHomes
  copies: { from: string; to: string; executable?: boolean }[]
  edits: { file: string; block: string; about: string }[]
  writes: { file: string; content: string; about: string }[]
  settings: { file: string; content: string }
  forget: string[]
  bundled: Bundled
  installed: Installed
  notes: string[]
}

function copyDir(from: string, to: string): InitPlan['copies'] {
  return readdirSync(from).map((f) => ({ from: join(from, f), to: join(to, f) }))
}

function manifestOf({ builtin, commons }: Bundled): Manifest {
  return { ...builtin, works: commons.works }
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
    ...copyDir(join(paths.root, 'shell', 'adapters'), join(home, 'adapters')),
  ]

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
    content: opts.mode === undefined ? seeded : withSetting(seeded, 'TTHEME_MODE', opts.mode),
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
    ...(opts.skills && opts.skills.length > 0 ? { skills: opts.skills } : {}),
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
    root: paths.root,
    agents: { home: paths.home, claude: paths.claudeHome ?? join(paths.home, '.claude') },
    copies,
    edits,
    writes,
    settings,
    forget,
    bundled: readPackaged(paths.root),
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

function currentView(configHome: string, bundled: Bundled): Manifest {
  try {
    return available(configHome, readMarketplaces(configHome, false, bundled), false)
  } catch {
    return { ...manifestOf(bundled), palettes: [] }
  }
}

export function againManifest(state: Installed, paths: InitPaths): Manifest {
  const bundled = readPackaged(paths.root)
  const builtin = marketplacesOf(state.marketplaces).includes(BUILTIN) ? bundled.builtin.palettes : []
  const names = new Set(builtin.map((e) => e.name))
  const current = currentView(paths.configHome, bundled)

  const others = current.palettes.filter(
    (e) => !names.has(e.name) && (!isBuiltin(e.name) || state.palettes.includes(e.name)),
  )

  return { ...manifestOf(bundled), works: current.works, palettes: [...builtin, ...others] }
}

function keptStartup(state: Installed, palettes: string[]): string | undefined {
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
    'skills',
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
    [...plan.bundled.builtin.palettes, ...currentView(paths.configHome, plan.bundled).palettes].map((e) => e.name),
  )

  const palettes = state.palettes.filter((n) => known.has(n))
  const gone = state.palettes.filter((n) => !known.has(n))
  const { startup, ...rest } = state

  const installed: Installed = {
    ...rest,
    palettes,
    ...(startup && palettes.includes(startup) ? { startup } : {}),
  }

  const notes =
    gone.length > 0 ? [`Dropped ${gone.join(', ')} — no longer in any marketplace`, ...plan.notes] : plan.notes

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

  const { skills: asked = [], ...wanted } = plan.installed
  const { placed, failed } = placeSkill(plan.root, asked, plan.agents)

  plan.notes.push(
    ...failed.map(
      (where) =>
        `Could not write the ${SKILL} skill to ${where} — run \`npx @kecan0406/ttheme init\` in your own terminal to add it`,
    ),
  )

  const installed = withBases(
    configHome,
    { ...wanted, ...carried, ...(placed.length > 0 ? { skills: placed } : {}) },
    host,
    plan.home,
  )

  writeBundled(configHome, plan.bundled)
  writeInstalled(configHome, installed)
  sync(configHome, readMarketplaces(configHome), installed, plan.home, host)

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

async function askSkills(agents: AgentHomes, ours: readonly SkillTarget[]): Promise<SkillTarget[]> {
  const offered = offeredSkills(agents).filter((target) => !heldElsewhere(target, agents, ours))
  const detected = detectedSkill(process.env)

  if (offered.length === 0) {
    return []
  }

  return accepted(
    await p.multiselect<SkillTarget>({
      message: `Add the ${SKILL} skill for your coding agents?\nAsk one to make a palette for a character and it measures the colors on the character's art`,
      options: offered.map((target) => ({
        value: target,
        label: SKILL_LABELS[target],
        hint: tilde(skillPath(target, agents), agents.home),
      })),
      initialValues: offered.filter((target) => (ours.length > 0 ? ours.includes(target) : target === detected)),
      required: false,
    }),
  )
}

export function startingMode(offered: readonly Setting[], was: Setting, again: boolean): Setting | undefined {
  if (again && offered.includes(was)) {
    return was
  }

  return offered.includes('auto') ? 'auto' : offered.includes(was) ? was : undefined
}

async function askMode(configHome: string, terminals: readonly Wired[], again: boolean): Promise<Setting> {
  const offered = settingsFor(terminals)
  const was = modeSetting(configHome)

  const hints: Record<Setting, string> = {
    auto: "the system's, followed as it changes",
    light: 'dark text on a light background',
    dark: 'light text on a dark background',
  }

  const modes = offered.includes('auto') ? 'auto, light or dark' : 'light or dark'
  const picks = offered.map((setting) => `\`ttheme ${setting}\``)

  return accepted(
    await p.select<Setting>({
      message: `Show the palettes in ${modes} mode?\nEvery palette comes in both — ${picks.join(', ')} or ${cap('alt+c')} in \`ttheme\` switches it later`,
      options: offered.map((value) => ({ value, label: value, hint: hints[value] })),
      initialValue: startingMode(offered, was, again) ?? modeFor(configHome),
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

function shelvesOf(manifest: Manifest, names: readonly string[]): string[] {
  const picked = worldOrder(
    manifest.palettes.filter((e) => names.includes(e.name)),
    manifest.works,
  )

  return [...new Set(picked.map((e) => aboutOf(manifest.works, e.subject)?.work.name ?? publisherOf(e.name)))]
}

function paintStartup(manifest: Manifest, installed: Installed, configHome: string): boolean {
  const startup = manifest.palettes.find((e) => e.name === worn(installed))
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
      `Turn on    \`ttheme on\` uses ${startupPalette(installed)}`,
    ]
  }

  return [
    `Default    ${startup}${painted ? ' — this tab shows it already' : ''}`,
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
  manifest: Manifest,
  opts: InitOptions,
  painted: boolean,
  pointed: ReadonlyMap<Wired, Pointed>,
  here: Shell,
): void {
  const shelves = shelvesOf(manifest, opts.palettes)
  p.note(
    [`${shelves.join(', ')} (${opts.palettes.length})`, ...startupLines(plan.installed, painted)].join('\n'),
    `Installed ${opts.palettes.length} palettes`,
  )
  p.note(
    [
      `${reopen(here).padEnd(18)}The ttheme command in this tab`,
      ...(plan.installed.skills
        ? [`Ask your coding agent to make a ttheme palette for a character — ${SKILL} knows how`]
        : []),
      ...nextLines(plan, pointed),
    ].join('\n'),
    'Next',
  )
  p.outro('Done')
}

function nextLines(plan: InitPlan, pointed: ReadonlyMap<Wired, Pointed>): string[] {
  return [...wiringNext(dirname(dirname(plan.settings.file)), plan.installed, pointed, plan.home), ...plan.notes]
}

function say(interactive: boolean): (line: string) => void {
  return interactive ? (line) => p.log.step(line) : (line) => console.log(line)
}

export async function moveColors(home: string, say: (line: string) => void, user = homedir()): Promise<void> {
  if (readInstalled(home).colorsMoved) {
    return
  }

  if (coloringFor(home) !== 'tone') {
    await redrawPictures(home, say, user, { ownColors: true })

    const left = Object.values(readStore(backgroundsDir(home)).palettes).some((rack) =>
      rack.pictures.some((picture) => coloringOf(picture) === 'tone' && decodable(home, picture)),
    )

    if (left) {
      return
    }
  }

  writeInstalled(home, { ...readInstalled(home), colorsMoved: true })
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
  await moveColors(paths.configHome, say(interactive), paths.home)
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
    `No palettes yet — open a new shell (\`${reopen(here)}\`), then \`ttheme\` picks them from your marketplaces`,
  ]

  console.log(lines.join('\n'))
}

export async function runInit(flags: { yes?: boolean } = {}): Promise<void> {
  const paint = painter(process.stdout.isTTY === true && !colorless())
  console.log(['', ...logoOf(paint, ['ttheme', 'Installer']), ''].join('\n'))

  for (const file of ['ttheme.js', 'package.json']) {
    if (!existsSync(join(ROOT, 'bin', file))) {
      throw new Error(`bin/${file} is missing — run \`mise run bin:build\` first`)
    }
  }

  if (!existsSync(join(ROOT, 'dist'))) {
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
  const stateDir = join(process.env.XDG_STATE_HOME ?? join(home, '.local', 'state'), 'ttheme')

  const paths: InitPaths = {
    root: ROOT,
    home,
    configHome,
    zdotdir: zdotdirOf(host, home),
    shells: shellsOf(host, process.ppid),
    platform: host.platform,
    stateDir,
    claudeHome: agentHomes(home, process.env).claude,
    ...(wtHome ? { wtHome } : {}),
    ...(wtProfile ? { wtProfile } : {}),
  }

  const here = invokingShell(host.run, process.ppid) ?? shellNamed(host.env.SHELL) ?? 'zsh'
  const detected = detectTerminal(process.env)
  const preselected = offered(paths, host).filter((t) => t === detected)

  if (!flags.yes && !interactive()) {
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
    await moveColors(configHome, say(false), home)
    report(plan, pointed, here)

    return
  }

  p.intro(`Setting up ttheme ${paint.accent(pkg.version)}`)

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
  const mode = await askMode(configHome, terminals, existing !== undefined)
  const worn: Mode = mode === 'auto' ? (readAppearance() ?? systemAppearance(host) ?? 'dark') : mode
  const made = existing ? againManifest(existing, paths) : manifestOf(readPackaged(ROOT))
  const manifest = { ...made, palettes: made.palettes.map((entry) => inMode(entry, worn)) }

  const palettes = existing
    ? await pickPalettes(manifest, existing.palettes, 'palette', true)
    : await pickPalettes(manifest, [], 'work', true)

  if (!palettes) {
    p.cancel('Nothing changed')
    throw new Cancelled()
  }

  const first = (existing && keptStartup(existing, palettes)) ?? palettes[0]

  const choose =
    palettes.length > 1 &&
    (TRAITS[detected].paints ||
      (detected === 'warp' &&
        terminals.includes('warp') &&
        existsSync(warpSettings(home, configHome, warpChannelOf(process.env)))))

  const wear = accepted(
    await p.confirm({
      message: choose ? 'Pick a default palette in ttheme once installed?' : `Use ${first} in every tab?`,
      initialValue: existing ? !existing.off : true,
    }),
  )

  const skills = await askSkills(agentHomes(home, process.env), existing?.skills ?? [])
  const opts: InitOptions = { terminals, palettes, off: !wear, mode, skills }
  const plan = existing ? planAgain(existing, opts, paths) : planInit(opts, paths)
  p.note(
    [
      `Install ${palettes.length} palettes — ${shelvesOf(manifest, palettes).join(', ')}`,
      mode === 'auto'
        ? 'Show every palette in the mode the system is in, following it as it changes'
        : `Show every palette in its ${mode} mode`,
      `Copy ${plan.copies.length} files under ${configHome}`,
      `Write ${plan.settings.file}`,
      ...plan.edits.map((e) => `Edit ${e.file} — a ttheme block: ${e.about}`),
      ...plan.writes.map((w) => `Write ${w.file} — ${w.about}`),
      ...wiringPlan(configHome, plan.installed, home),
      ...(skills.length > 0
        ? [`Add the ${SKILL} skill — ${skills.map((target) => tilde(skillPath(target, plan.agents), home)).join(', ')}`]
        : []),
      'Each config is backed up once to <file>.ttheme.bak before the first edit — `npx @kecan0406/ttheme uninstall` takes it all out',
      wear
        ? choose
          ? `Open ttheme — every tab uses the palette picked there, ${first} until then`
          : `Use ${first} in every tab, this one now`
        : 'Leave the terminal colors as they are — `ttheme on` uses a palette later',
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
  await moveColors(configHome, say(true), home)
  await redrawPictures(configHome, say(true), home)

  if (wear && choose) {
    pickDefault(configHome)
  }

  const installed = readInstalled(configHome)
  receipt({ ...plan, installed }, manifest, opts, paintStartup(manifest, installed, configHome), pointed, here)
}
