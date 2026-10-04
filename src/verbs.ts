import pkg from '../package.json' with { type: 'json' }
import { WIRED } from './terminals/types.ts'

export interface Flag {
  type: 'boolean' | 'string'
  short?: string
  multiple?: true
  value?: string
  choices?: readonly string[]
  about: string
}

export type Section = 'tab' | 'startup' | 'catalog' | 'own' | 'setup' | 'support'

export const SECTIONS: { section: Section; title: string }[] = [
  { section: 'tab', title: 'This tab' },
  { section: 'startup', title: 'New tabs' },
  { section: 'catalog', title: 'Palettes' },
  { section: 'own', title: 'Your own' },
  { section: 'setup', title: 'Setup' },
  { section: 'support', title: 'Support' },
]

export interface VerbSpec {
  name: string
  args: string[]
  about: string
  section: Section
  actions?: [string, string][]
  shell?: true
  hidden?: true
  flags?: Record<string, Flag>
}

export const VERB_SPECS: VerbSpec[] = [
  {
    name: 'preview',
    args: [],
    about:
      'Try palettes live — focus repaints, enter edits its tone and picture and applies it, esc restores, ? lists keys',
    section: 'tab',
    shell: true,
  },
  {
    name: 'use',
    args: ['<palette>'],
    about: 'Paint this tab — a unique prefix works: ttheme use ho',
    section: 'tab',
    shell: true,
  },
  { name: 'default', args: ['<palette>'], about: 'Make a palette the one new tabs open with', section: 'startup' },
  { name: 'on', args: [], about: 'Wear the default palette in new tabs again', section: 'startup' },
  {
    name: 'off',
    args: [],
    about: "Take the palette and picture off every tab — the terminal's own colors until `ttheme on`",
    section: 'startup',
  },
  {
    name: 'pin',
    args: ['[dir|ssh:<host>]'],
    about:
      'Pin a palette to a directory or an ssh host — the pin covers everything below it, or its whole repository; cd or ssh in repaints, leaving restores',
    section: 'tab',
    shell: true,
  },
  {
    name: 'unpin',
    args: ['[dir|ssh:<host>]'],
    about: "Drop a pin — this directory's, every one below it, the one above that paints it, or an ssh host's",
    section: 'tab',
    shell: true,
  },
  {
    name: 'pins',
    args: [],
    about:
      "Map every pin — the pinned directories as a tree in their palettes' colors, every ssh host, and the pin that covers this one",
    section: 'tab',
    shell: true,
  },
  {
    name: 'config',
    args: [],
    about: 'Edit settings in $EDITOR — they apply in new tabs',
    section: 'startup',
    shell: true,
  },
  {
    name: 'browse',
    args: [],
    about:
      'Pick palettes and markets in a live picker — shift+←/→ moves between Catalog, Installed, Markets and Errors',
    section: 'catalog',
  },
  {
    name: 'list',
    args: ['[query]'],
    about: 'Show the catalog, marking what is installed',
    section: 'catalog',
    flags: { json: { type: 'boolean', about: 'Print the matches as JSON — name, group, catalog, installed' } },
  },
  {
    name: 'add',
    args: ['<palette...>'],
    about: 'Install palettes — from the catalog, or from a share code: ttheme add tt1:…',
    section: 'catalog',
    flags: {
      market: {
        type: 'string',
        value: '<source>',
        about: 'Add this market first — a repository, a folder or official — and take bare palette names from it',
      },
    },
  },
  { name: 'remove', args: ['<palette...>'], about: 'Uninstall palettes', section: 'catalog' },
  {
    name: 'update',
    args: [],
    about: 'Refresh every market you added now — those with auto-update refresh on their own once a day',
    section: 'catalog',
  },
  {
    name: 'market',
    args: ['[action]', '[source]'],
    about: 'The markets you added — add, remove and search them; init makes one of your own',
    actions: [
      ['(none)', 'List the markets you added — their palettes, auto-update and last update'],
      [
        'add <source>',
        'Add a market — a repository (alice/ttheme-pastel, #v1 pins a tag or branch), a folder, or official; asks whether it updates on its own',
      ],
      ['remove <market>', 'Drop one by its name (alice@pastel) — the palettes you installed from it keep working'],
      ['search [query]', 'Repositories on GitHub with the ttheme-market topic'],
      [
        'init [name]',
        'Make a market of your own — <you>@<name>, in ~/.config/ttheme/market/<name> or a folder you give',
      ],
      [
        'check [dir]',
        "Check a market's folder before you push it — ttheme-market.toml, every palette, the renames and the gate; nothing is written",
      ],
    ],
    section: 'catalog',
  },
  {
    name: 'new',
    args: ['<name>'],
    about: 'Make a palette of your own in the palette editor — <you>@<market>/<name>, from blank, installed at once',
    section: 'own',
    flags: {
      from: { type: 'string', value: '<palette>', about: "Start from this palette's colors instead of blank" },
      in: { type: 'string', value: '<market>', about: 'The local market to put it in — when you have more than one' },
    },
  },
  {
    name: 'edit',
    args: ['<palette>'],
    about: 'Change one of your palettes in the palette editor — the contrast gate advises, never refuses',
    section: 'own',
  },
  {
    name: 'check',
    args: ['<palette>'],
    about: 'Measure a palette against the contrast gate — where it misses, suggest colors that pass',
    section: 'own',
    flags: { fix: { type: 'boolean', about: 'Write the suggested colors into your palette' } },
  },
  {
    name: 'share',
    args: ['<palette>'],
    about: 'Print a share code — ttheme add <code> installs it anywhere, pictures included',
    section: 'own',
    flags: {
      tone: {
        type: 'string',
        value: '<tuned|original>',
        choices: ['tuned', 'original'],
        about: 'Share it as you tuned it, or as it was — asked when you tuned it and omit this',
      },
    },
  },
  {
    name: 'init',
    args: [],
    about: 'Install the shell layer and wire your terminals',
    section: 'setup',
    flags: { yes: { type: 'boolean', short: 'y', about: 'Accept every default without prompting' } },
  },
  {
    name: 'uninstall',
    args: [],
    about: 'Remove ttheme — its block comes out of every terminal config and what it wrote is deleted',
    section: 'setup',
    flags: { yes: { type: 'boolean', short: 'y', about: 'Remove without asking' } },
  },
  {
    name: 'wire',
    args: ['<terminal>'],
    about:
      'Wire one more terminal into this setup, after showing what it edits — the shell offers it in a terminal that paints only through the config init would have wired',
    section: 'setup',
    hidden: true,
  },
  {
    name: 'info',
    args: [],
    about: 'Print what a bug report needs — version, OS, shell, terminal and the settings you changed',
    section: 'support',
  },
  {
    name: 'build',
    args: [],
    about: 'Emit dist/ for every terminal, plus the zsh palette table — from a checkout',
    section: 'setup',
    hidden: true,
    flags: {
      only: {
        type: 'string',
        multiple: true,
        value: '<terminal>',
        choices: WIRED,
        about: 'Rebuild just this terminal — repeat it for more',
      },
    },
  },
  {
    name: 'find',
    args: ['<palette>'],
    about: 'Pick a booru background for a palette — preview opens this on tab',
    section: 'setup',
    hidden: true,
  },
  {
    name: 'image',
    args: ['<palette>', '<action>', '[picture]'],
    about:
      "Show one of a palette's saved backgrounds, remove one, draw one in its palette's tone or its own colors (or get the other ready before it is asked for), or pass on tuning — preview calls this",
    section: 'setup',
    hidden: true,
  },
  {
    name: 'flatten',
    args: ['<source>', '<out>', '<background>', '<opacity>', '[canvas]', '[place]', '[into]'],
    about:
      'Lay a picture on a background color at an opacity, placed on a canvas when given one, for Warp, which fades the window instead, and Terminal.app, which takes it written into the file its profile points at and renamed to the out — preview calls this',
    section: 'setup',
    hidden: true,
  },
  {
    name: 'bake',
    args: ['<source>', '<out>', '<canvas>', '<place>'],
    about: "Place a picture on a transparent canvas the way sips bakes preview's tuning — preview in Warp calls this",
    section: 'setup',
    hidden: true,
  },
  {
    name: 'tone',
    args: ['<palette>', '<action>'],
    about: "Print a palette's colors for preview's panel, or open them in the palette editor — preview calls this",
    section: 'setup',
    hidden: true,
  },
  {
    name: 'redraw',
    args: [],
    about: 'Draw the background pictures again after TTHEME_BG_BLUR changed — ttheme config and preview call this',
    section: 'setup',
    hidden: true,
  },
  {
    name: 'names',
    args: [],
    about:
      "Download aninames' character names when its release changed and index them — any command starts this in the background once a day",
    section: 'setup',
    hidden: true,
  },
]

export function usageOf(verb: VerbSpec): string {
  const flags = Object.entries(verb.flags ?? {}).map(([name, { value }]) => `[--${name}${value ? ` ${value}` : ''}]`)
  return [verb.name, ...flags, ...verb.args].join(' ')
}

function columns(rows: [string, string][], width = WIDTH): string[] {
  return rows.map(([left, right]) => `  ${left.padEnd(width)}  ${right}`)
}

function headOf(text: string): string {
  return text.split(' — ')[0] as string
}

function flagRows(verb: VerbSpec): [string, string][] {
  return Object.entries(verb.flags ?? {}).map(([name, { short, value, about }]) => [
    `${short ? `-${short}, ` : ''}--${name}${value ? ` ${value}` : ''}`,
    about,
  ])
}

function listed(verb: VerbSpec, all: boolean): [string, string][] {
  const under = all ? [...(verb.actions ?? []), ...flagRows(verb)] : []
  return [
    [[verb.name, ...verb.args].join(' '), headOf(verb.about)],
    ...under.map(([left, right]): [string, string] => [`  ${left}`, headOf(right)]),
  ]
}

const BANNER = [`ttheme ${pkg.version}`, pkg.description, 'Usage: ttheme <command> [options] [args]']

const GETTING_HELP: [string, string][] = [
  ['ttheme help', 'Every command'],
  ['ttheme help all', 'Every command with its options, and examples'],
  ['ttheme help <command>', 'One command in full'],
]

const GLOBAL_OPTIONS: [string, string][] = [
  ['-h, --help', "Show help — after a command, that command's"],
  ['-v, --version', 'Print the version'],
]

const WIDTH = Math.max(
  ...[...GETTING_HELP, ...GLOBAL_OPTIONS, ...VERB_SPECS.filter((v) => !v.hidden).flatMap((v) => listed(v, true))].map(
    ([left]) => left.length,
  ),
)

const EXAMPLES: [string, string][] = [
  ['npx @kecan0406/ttheme init -y', 'Wire the terminals found here, no prompts'],
  ['ttheme add homura madoka', 'Install two palettes'],
  ['ttheme use homura', 'Paint this tab with one'],
  ['ttheme list --json madoka', 'The madoka series as JSON'],
  ['ttheme market add alice/ttheme-pastel', "alice's market, alice@pastel — ttheme add alice@pastel/dusk"],
  ['ttheme add dusk --market alice/ttheme-pastel', 'The same in one step'],
  ['ttheme new rei --from rei', 'Your own rei, <you>@<market>/rei, to edit and share'],
]

export function briefText(): string {
  return [...BANNER, '', 'Use --help to list every command, or init to set ttheme up'].join('\n')
}

export function commandHelp(verb: VerbSpec): string {
  const flags = flagRows(verb)
  return [
    `Usage: ttheme ${usageOf(verb)}`,
    '',
    verb.about,
    ...(verb.actions ? ['', 'Actions:', ...columns(verb.actions)] : []),
    ...(flags.length > 0 ? ['', 'Options:', ...columns(flags)] : []),
  ].join('\n')
}

export function helpText(all: boolean, shell = false): string {
  const shown = VERB_SPECS.filter((v) => !v.hidden && !(shell && v.section === 'setup'))
  const sections = SECTIONS.filter(({ section }) => shown.some((v) => v.section === section))
  return [
    ...BANNER,
    '',
    'Getting help:',
    ...columns(GETTING_HELP),
    '',
    'Global options:',
    ...columns(GLOBAL_OPTIONS),
    ...sections.flatMap(({ section, title }) => [
      '',
      `${title}:`,
      ...columns(shown.filter((v) => v.section === section).flatMap((v) => listed(v, all))),
    ]),
    ...(all ? ['', 'Examples:', ...columns(EXAMPLES, Math.max(...EXAMPLES.map(([left]) => left.length)))] : []),
    '',
    ...(shell ? ['ttheme alone opens preview and browse as tabs — tab and shift+tab move between them'] : []),
    'https://kecan0406.github.io/ttheme',
  ].join('\n')
}
