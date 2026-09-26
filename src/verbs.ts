import pkg from '../package.json' with { type: 'json' }

export const TERMINALS = ['ghostty', 'kitty', 'alacritty', 'wezterm', 'iterm2', 'windows-terminal', 'warp'] as const

export interface Flag {
  type: 'boolean' | 'string'
  short?: string
  multiple?: true
  value?: string
  choices?: readonly string[]
  about: string
}

export type Section = 'tab' | 'startup' | 'catalog' | 'own' | 'setup'

export const SECTIONS: { section: Section; title: string }[] = [
  { section: 'tab', title: 'This tab' },
  { section: 'startup', title: 'New tabs' },
  { section: 'catalog', title: 'Palettes' },
  { section: 'own', title: 'Your own' },
  { section: 'setup', title: 'Setup' },
]

export interface VerbSpec {
  name: string
  args: string[]
  about: string
  section: Section
  start?: string
  actions?: [string, string][]
  shell?: true
  hidden?: true
  flags?: Record<string, Flag>
}

export const VERB_SPECS: VerbSpec[] = [
  {
    name: 'preview',
    args: [],
    about: 'browse live — focus repaints, enter keeps (this tab or default), esc restores, ? lists keys',
    section: 'tab',
    start: 'try every palette live — enter keeps the one you land on',
    shell: true,
  },
  {
    name: 'use',
    args: ['<palette>'],
    about: 'paint this tab — a unique prefix works: ttheme use ho',
    section: 'tab',
    start: 'paint this tab with one — ttheme use homura',
    shell: true,
  },
  { name: 'next', args: [], about: 'advance this tab to the next palette', section: 'tab', shell: true },
  { name: 'default', args: ['<palette>'], about: 'make a palette the one new tabs open with', section: 'startup' },
  { name: 'on', args: [], about: 'wear the default palette in new tabs again', section: 'startup' },
  {
    name: 'off',
    args: [],
    about: "take the palette and picture off every tab — the terminal's own colors until `ttheme on`",
    section: 'startup',
  },
  {
    name: 'pin',
    args: [],
    about: 'pick a palette for this directory — cd into it repaints, cd out restores',
    section: 'tab',
    shell: true,
  },
  { name: 'unpin', args: [], about: 'drop the palette pinned to this directory', section: 'tab', shell: true },
  {
    name: 'config',
    args: [],
    about: 'edit settings in $EDITOR — they apply in new tabs',
    section: 'startup',
    shell: true,
  },
  {
    name: 'browse',
    args: [],
    about: 'pick palettes from the catalog in a live picker',
    section: 'catalog',
    start: 'install or drop palettes — every market you added, in one picker',
  },
  {
    name: 'list',
    args: ['[query]'],
    about: 'show the catalog, marking what is installed',
    section: 'catalog',
    flags: { json: { type: 'boolean', about: 'print the matches as JSON: name, group, installed' } },
  },
  {
    name: 'add',
    args: ['<palette...>'],
    about: 'install palettes from the catalog, or from a share code: ttheme add tt1:…',
    section: 'catalog',
  },
  { name: 'remove', args: ['<palette...>'], about: 'uninstall palettes', section: 'catalog' },
  { name: 'update', args: [], about: 'refresh every market you added', section: 'catalog' },
  {
    name: 'market',
    args: ['[action]', '[source]'],
    about: 'the markets you added — add, remove and search them; init makes one of your own',
    actions: [
      ['(none)', 'list the markets you added, with how many palettes each holds'],
      ['add <source>', 'add one: a repository (alice/ttheme-pastel), a folder, or official'],
      ['remove <market>', 'drop one by its name (alice@pastel) — the palettes you installed from it keep working'],
      ['search [query]', 'repositories on GitHub with the ttheme-market topic'],
      ['init [name]', 'make a market of your own, <you>@<name>, in ~/.config/ttheme/market/<name> (or give a folder)'],
    ],
    section: 'catalog',
  },
  {
    name: 'new',
    args: ['<name>'],
    about: 'make a palette of your own, <you>@<market>/<name>, in your local market — installed at once',
    section: 'own',
    flags: {
      from: { type: 'string', value: '<palette>', about: 'the palette to start from — the default one when left out' },
      in: { type: 'string', value: '<market>', about: 'the local market to put it in, when you have more than one' },
    },
  },
  {
    name: 'edit',
    args: ['<palette>'],
    about: 'change one of your palettes in $EDITOR — the contrast gate advises, never refuses',
    section: 'own',
  },
  {
    name: 'check',
    args: ['<palette>'],
    about: 'measure a palette against the contrast gate and suggest colors that pass',
    section: 'own',
    flags: { fix: { type: 'boolean', about: 'write the suggested colors into your palette' } },
  },
  {
    name: 'share',
    args: ['<palette>'],
    about: 'print a share code — ttheme add <code> installs it anywhere, pictures included',
    section: 'own',
  },
  {
    name: 'init',
    args: [],
    about: 'install the shell layer and wire your terminal configs',
    section: 'setup',
    flags: { yes: { type: 'boolean', short: 'y', about: 'accept every default without prompting' } },
  },
  {
    name: 'uninstall',
    args: [],
    about: 'take ttheme out of every terminal config and delete what it wrote',
    section: 'setup',
    flags: { yes: { type: 'boolean', short: 'y', about: 'remove without asking' } },
  },
  {
    name: 'build',
    args: [],
    about: 'emit dist/ for every terminal, plus the zsh palette table — from a checkout',
    section: 'setup',
    hidden: true,
    flags: {
      only: {
        type: 'string',
        multiple: true,
        value: '<terminal>',
        choices: TERMINALS,
        about: 'rebuild just this terminal — repeat it for more',
      },
    },
  },
  {
    name: 'find',
    args: ['<palette>'],
    about: 'pick a booru background for a palette — preview opens this on tab',
    section: 'setup',
    hidden: true,
  },
  {
    name: 'image',
    args: ['<palette>', '<action>'],
    about:
      'switch a palette between its saved backgrounds, remove the one shown, or pass on tuning — preview calls this',
    section: 'setup',
    hidden: true,
  },
  {
    name: 'redraw',
    args: [],
    about: 'draw the background pictures again after TTHEME_BG_BLUR changed — ttheme config and preview call this',
    section: 'setup',
    hidden: true,
  },
]

export function usageOf(verb: VerbSpec): string {
  const flags = Object.entries(verb.flags ?? {}).map(([name, { value }]) => `[--${name}${value ? ` ${value}` : ''}]`)
  return [verb.name, ...flags, ...verb.args].join(' ')
}

function columns(rows: [string, string][], width = Math.max(...rows.map(([left]) => left.length))): string[] {
  return rows.map(([left, right]) => `  ${left.padEnd(width)}  ${right}`)
}

const EXAMPLES: [string, string][] = [
  ['npx @kecan0406/ttheme init -y', 'wire the terminals found here, no prompts'],
  ['ttheme add homura madoka', 'install two palettes'],
  ['ttheme use homura', 'paint this tab with one'],
  ['ttheme list --json madoka', 'the madoka series as JSON'],
  ['ttheme market add alice/ttheme-pastel', "alice's market, alice@pastel — ttheme add alice@pastel/dusk"],
  ['ttheme new rei --from rei', 'your own rei, <you>@<market>/rei, to edit and share'],
]

export function helpText(all: boolean, shell = false): string {
  const shown = VERB_SPECS.filter((v) => !v.hidden && !(shell && v.section === 'setup'))
  const sections = SECTIONS.filter(({ section }) => shown.some((v) => v.section === section))
  const footer = [
    ...(shell ? ['ttheme alone lists every installed palette, grouped, with previews'] : []),
    all
      ? 'ttheme help <command> describes one command · ttheme --version prints the version'
      : 'ttheme help <command> describes one · ttheme help all lists every command with what it does',
    'https://kecan0406.github.io/ttheme',
  ]
  if (!all) {
    const start = shown.filter((v) => v.start)
    const width = Math.max(...sections.map(({ title }) => title.length))
    return [
      'Usage: ttheme <command>',
      '',
      pkg.description,
      '',
      'Start here',
      ...columns(start.map((v): [string, string] => [usageOf(v), v.start as string])),
      '',
      ...sections.map(
        ({ section, title }) =>
          `${title.padEnd(width)}  ${shown
            .filter((v) => v.section === section)
            .map((v) => v.name)
            .join(' · ')}`,
      ),
      '',
      ...footer,
    ].join('\n')
  }
  const width = Math.max(...shown.map((v) => usageOf(v).length))
  return [
    'Usage: ttheme <command>',
    '',
    pkg.description,
    ...sections.flatMap(({ section, title }) => [
      '',
      title,
      ...columns(
        shown.filter((v) => v.section === section).map((v): [string, string] => [usageOf(v), v.about]),
        width,
      ),
    ]),
    '',
    'Examples',
    ...columns(EXAMPLES),
    '',
    ...footer,
  ].join('\n')
}
