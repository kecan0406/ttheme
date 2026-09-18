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
import { runBrowse } from './market.ts'
import { type Installed, sync, writeInstalled } from './palettes.ts'
import { configFile, detectTerminal, INIT_TERMINALS, type InitTerminal, upsertBlock, zshrcBlock } from './wiring.ts'

export interface InitOptions {
  terminals: InitTerminal[]
  tabPalette: 'seq' | 'off'
  announce: boolean
}

export interface InitPaths {
  root: string
  home: string
  configHome: string
  zdotdir: string
}

export interface InitPlan {
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
  const settings = {
    file: configPath,
    content: configFile(existsSync(configPath) ? readFileSync(configPath, 'utf8') : '', opts),
  }
  const notes: string[] = []
  if (opts.terminals.includes('ghostty')) {
    copyDir(copies, join(paths.root, 'ghostty', 'shaders'), join(paths.configHome, 'ghostty', 'shaders'))
  }
  if (opts.terminals.includes('alacritty')) {
    const config = join(paths.configHome, 'alacritty', 'alacritty.toml')
    if (existsSync(config) && !readFileSync(config, 'utf8').includes('# ttheme begin')) {
      notes.push('alacritty.toml already exists — ttheme left it alone; add its themes/ import yourself')
    }
  }
  notes.push('wezterm and iterm2: import the palettes you install from the release archive')
  const catalog: Manifest = JSON.parse(readFileSync(join(dist, 'manifest.json'), 'utf8'))
  const installed: Installed = { terminals: opts.terminals, palettes: [] }
  return { copies, edits, settings, catalog, installed, notes }
}

export function applyInit(plan: InitPlan): void {
  for (const c of plan.copies) {
    mkdirSync(dirname(c.to), { recursive: true })
    rmSync(c.to, { force: true })
    copyFileSync(c.from, c.to)
    if (c.executable) {
      chmodSync(c.to, 0o755)
    }
  }
  mkdirSync(dirname(plan.settings.file), { recursive: true })
  writeFileSync(plan.settings.file, plan.settings.content)
  const configHome = dirname(dirname(plan.settings.file))
  writeCatalog(configHome, plan.catalog)
  writeInstalled(configHome, plan.installed)
  sync(configHome, plan.catalog, plan.installed)
  for (const e of plan.edits) {
    mkdirSync(dirname(e.file), { recursive: true })
    const current = existsSync(e.file) ? readFileSync(e.file, 'utf8') : ''
    writeFileSync(e.file, upsertBlock(current, e.block))
  }
}

function accepted<T>(value: T | symbol): T {
  if (p.isCancel(value)) {
    p.cancel('nothing changed')
    process.exit(1)
  }
  return value as T
}

async function ask(detected: string, preselected: InitTerminal[]): Promise<InitOptions> {
  p.intro('ttheme init')
  const terminals = accepted(
    await p.multiselect({
      message: 'wire which terminals?',
      options: INIT_TERMINALS.map((t) => ({ value: t, hint: t === detected ? 'detected' : undefined })),
      initialValues: preselected,
      required: true,
    }),
  )
  const tabPalette = accepted(
    await p.select<'seq' | 'off'>({
      message: 'new tabs',
      options: [
        { value: 'seq', label: 'rotate through the palettes', hint: 'default' },
        { value: 'off', label: 'inherit the window colors' },
      ],
      initialValue: 'seq',
    }),
  )
  const announce = accepted(
    await p.confirm({ message: 'show the palette name under "Last login:"?', initialValue: true }),
  )
  return { terminals, tabPalette, announce }
}

function report(plan: InitPlan, opts: InitOptions, interactive: boolean): void {
  const missing = [
    ...plan.copies.filter((c) => !existsSync(c.to)).map((c) => c.to),
    ...(existsSync(plan.settings.file) ? [] : [plan.settings.file]),
    ...plan.edits.filter((e) => !readFileSync(e.file, 'utf8').includes('# ttheme begin')).map((e) => e.file),
  ]
  if (missing.length > 0) {
    throw new Error(`init left gaps:\n${missing.join('\n')}`)
  }
  const lines = [
    `placed ${plan.copies.length} files`,
    `settings in ${plan.settings.file} — edit later with \`ttheme config\``,
    ...plan.edits.map((e) => `wired ${e.file}`),
  ]
  if (opts.terminals.includes('ghostty')) {
    lines.push('restart ghostty to pick up its config')
  }
  if (opts.terminals.includes('kitty')) {
    lines.push('open a new kitty window to pick up its config')
  }
  lines.push(...plan.notes)
  lines.push('no palettes yet — `ttheme browse` picks them from the catalog')
  if (interactive) {
    p.note(lines.join('\n'), 'done')
  } else {
    console.log(lines.join('\n'))
    console.log('run `ttheme browse` to pick your palettes')
  }
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
  const paths: InitPaths = { root, home, configHome, zdotdir }
  const detected = detectTerminal(process.env)
  const preselected = INIT_TERMINALS.filter((t) => t === detected || existsSync(join(configHome, t)))
  const interactive = !flags.yes && process.stdin.isTTY === true && process.stdout.isTTY === true
  let opts: InitOptions
  if (interactive) {
    opts = await ask(detected, preselected)
  } else {
    if (preselected.length === 0) {
      throw new Error('no supported terminal detected — run this inside ghostty, kitty or alacritty')
    }
    opts = { terminals: preselected, tabPalette: 'seq', announce: true }
  }
  const plan = planInit(opts, paths)
  if (interactive) {
    p.note(
      [
        `copy ${plan.copies.length} files under ${configHome}`,
        `write ${plan.settings.file}`,
        ...plan.edits.map((e) => `edit ${e.file}`),
      ].join('\n'),
      `wiring ${opts.terminals.join(', ')}`,
    )
    const go = accepted(await p.confirm({ message: 'apply these changes?' }))
    if (!go) {
      p.cancel('nothing changed')
      process.exit(1)
    }
  }
  applyInit(plan)
  report(plan, opts, interactive)
  if (!interactive) {
    return
  }
  const browse = accepted(await p.confirm({ message: 'pick your palettes now?', initialValue: true }))
  if (browse) {
    await runBrowse()
  } else {
    p.outro('run `ttheme browse` when you are ready')
  }
}
