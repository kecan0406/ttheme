import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import * as p from '@clack/prompts'
import { build, type PaletteEntry } from './build.ts'
import { paletteOsc, queryTerminalColors, restoreOsc } from './osc.ts'
import { PalettePrompt, promptFx } from './palette-prompt.ts'
import {
  alacrittyBlock,
  configFile,
  detectTerminal,
  ghosttyBlock,
  INIT_TERMINALS,
  type InitTerminal,
  kittyBlock,
  upsertBlock,
  weztermSnippet,
  zshrcBlock,
} from './wiring.ts'

export interface InitOptions {
  terminals: InitTerminal[]
  palette: string
  tabPalette: 'seq' | 'off'
  announce: boolean
  link: boolean
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
  notes: string[]
}

async function pickPalette(root: string): Promise<string> {
  const entries: PaletteEntry[] = JSON.parse(readFileSync(join(root, 'dist', 'manifest.json'), 'utf8'))
  const live = process.stdout.isTTY === true && !process.env.NO_COLOR
  const saved = live ? await queryTerminalColors() : new Map<string, string>()
  const prompt = new PalettePrompt({
    entries,
    color: !process.env.NO_COLOR,
    fx: promptFx(process.env.TTHEME_FX),
    onFocus: live ? (entry) => process.stdout.write(paletteOsc(entry)) : undefined,
  })
  const pick = await prompt.prompt()
  if (p.isCancel(pick)) {
    process.stdout.write(restoreOsc(saved))
    p.cancel('nothing changed')
    process.exit(1)
  }
  return pick ?? 'neutral'
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
    { from: join(paths.root, 'shell', 'ttheme.zsh'), to: join(home, 'ttheme.zsh') },
    { from: join(paths.root, 'shell', 'launch-tab.zsh'), to: join(home, 'launch-tab.zsh'), executable: true },
    { from: join(dist, 'shell', 'palettes.zsh'), to: join(home, 'palettes.zsh') },
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
    copyDir(copies, join(dist, 'ghostty', 'themes'), join(paths.configHome, 'ghostty', 'themes'))
    copyDir(copies, join(paths.root, 'ghostty', 'shaders'), join(paths.configHome, 'ghostty', 'shaders'))
    edits.push({
      file: join(paths.configHome, 'ghostty', 'config'),
      block: ghosttyBlock(home, opts.palette, opts.tabPalette),
    })
  }
  if (opts.terminals.includes('kitty')) {
    copyDir(copies, join(dist, 'kitty', 'themes'), join(paths.configHome, 'kitty', 'themes'))
    edits.push({ file: join(paths.configHome, 'kitty', 'kitty.conf'), block: kittyBlock(opts.palette) })
  }
  if (opts.terminals.includes('alacritty')) {
    copyDir(copies, join(dist, 'alacritty', 'themes'), join(paths.configHome, 'alacritty', 'themes'))
    const config = join(paths.configHome, 'alacritty', 'alacritty.toml')
    const block = alacrittyBlock(join(paths.configHome, 'alacritty', 'themes', `${opts.palette}.toml`))
    if (!existsSync(config) || readFileSync(config, 'utf8').includes('# ttheme begin')) {
      edits.push({ file: config, block })
    } else {
      notes.push(`alacritty.toml already exists — add this to it yourself:\n${block}`)
    }
  }
  notes.push(`wezterm: copy colors/ from the release archive, then ${weztermSnippet(opts.palette)}`)
  notes.push('iterm2: import the .itermcolors files from the release archive')
  return { copies, edits, settings, notes }
}

export function applyInit(plan: InitPlan, link: boolean): void {
  for (const c of plan.copies) {
    mkdirSync(dirname(c.to), { recursive: true })
    rmSync(c.to, { force: true })
    if (link) {
      symlinkSync(c.from, c.to)
    } else {
      copyFileSync(c.from, c.to)
      if (c.executable) {
        chmodSync(c.to, 0o755)
      }
    }
  }
  mkdirSync(dirname(plan.settings.file), { recursive: true })
  writeFileSync(plan.settings.file, plan.settings.content)
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

async function ask(root: string, detected: string, preselected: InitTerminal[], link: boolean): Promise<InitOptions> {
  p.intro('ttheme init')
  const terminals = accepted(
    await p.multiselect({
      message: 'wire which terminals?',
      options: INIT_TERMINALS.map((t) => ({ value: t, hint: t === detected ? 'detected' : undefined })),
      initialValues: preselected,
      required: true,
    }),
  )
  const palette = await pickPalette(root)
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
  return { terminals, palette, tabPalette, announce, link }
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
  if (interactive) {
    p.note(lines.join('\n'), 'done')
    p.outro('open a new tab and run `ttheme`')
  } else {
    console.log(lines.join('\n'))
    console.log('open a new tab and run `ttheme`')
  }
}

export async function runInit(flags: { yes?: boolean; link?: boolean } = {}): Promise<void> {
  const root = join(import.meta.dirname, '..')
  const link = flags.link === true
  if (link && !existsSync(join(root, 'src'))) {
    throw new Error('--link needs a repo checkout')
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
    opts = await ask(root, detected, preselected, link)
  } else {
    if (preselected.length === 0) {
      throw new Error('no supported terminal detected — run this inside ghostty, kitty or alacritty')
    }
    opts = { terminals: preselected, palette: 'neutral', tabPalette: 'seq', announce: true, link }
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
  applyInit(plan, opts.link)
  report(plan, opts, interactive)
}
