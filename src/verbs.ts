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
    about:
      'Try palettes live — focus repaints, enter edits its tone and picture and applies it, esc restores, ? lists keys',
    section: 'tab',
    start: 'Try every palette live — enter tunes the one you land on and applies it',
    shell: true,
  },
  {
    name: 'use',
    args: ['<palette>'],
    about: 'Paint this tab — a unique prefix works: ttheme use ho',
    section: 'tab',
    start: 'Paint this tab with one — ttheme use homura',
    shell: true,
  },
  { name: 'next', args: [], about: 'Advance this tab to the next palette', section: 'tab', shell: true },
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
    args: ['[directory|ssh:<host>]'],
    about:
      'Pick a palette for this directory, everything below it, its repository or an ssh host — cd or ssh in repaints, leaving restores',
    section: 'tab',
    shell: true,
  },
  {
    name: 'unpin',
    args: ['[directory|ssh:<host>]'],
    about: "Drop a pin — this directory's, every one below it, the one above that paints it, or an ssh host's",
    section: 'tab',
    shell: true,
  },
  {
    name: 'pins',
    args: [],
    about:
      "Map every pinned directory as a tree in its palette's colors, every ssh host, and the pin that covers this one",
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
    start: 'Install or drop palettes, add markets — every change applies at once on enter',
  },
  {
    name: 'list',
    args: ['[query]'],
    about: 'Show the catalog, marking what is installed',
    section: 'catalog',
    flags: { json: { type: 'boolean', about: 'Print the matches as JSON: name, group, catalog, installed' } },
  },
  {
    name: 'add',
    args: ['<palette...>'],
    about: 'Install palettes from the catalog, or from a share code: ttheme add tt1:…',
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
      ['(none)', 'List the markets you added: palettes, auto-update and the last update'],
      [
        'add <source>',
        'Add one: a repository (alice/ttheme-pastel, #v1 pins a tag or branch), a folder, or official — asks whether it updates on its own',
      ],
      ['remove <market>', 'Drop one by its name (alice@pastel) — the palettes you installed from it keep working'],
      ['search [query]', 'Repositories on GitHub with the ttheme-market topic'],
      ['init [name]', 'Make a market of your own, <you>@<name>, in ~/.config/ttheme/market/<name> (or give a folder)'],
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
    about: 'Make a palette of your own, <you>@<market>/<name>, from blank in the palette editor — installed at once',
    section: 'own',
    flags: {
      from: { type: 'string', value: '<palette>', about: "Open the editor on this palette's colors instead of blank" },
      in: { type: 'string', value: '<market>', about: 'The local market to put it in, when you have more than one' },
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
    about: 'Measure a palette against the contrast gate and suggest colors that pass',
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
        about: 'Share the palette as you tuned its colors, or as it was — asked when you tuned it and omit this',
      },
    },
  },
  {
    name: 'init',
    args: [],
    about: 'Install the shell layer and wire your terminal configs',
    section: 'setup',
    flags: { yes: { type: 'boolean', short: 'y', about: 'Accept every default without prompting' } },
  },
  {
    name: 'uninstall',
    args: [],
    about: 'Take ttheme out of every terminal config and delete what it wrote',
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
    args: ['<palette>'],
    about: "Serve a palette's tone editor over stdin and stdout — preview's palette panel runs it",
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

function columns(rows: [string, string][], width = Math.max(...rows.map(([left]) => left.length))): string[] {
  return rows.map(([left, right]) => `  ${left.padEnd(width)}  ${right}`)
}

const EXAMPLES: [string, string][] = [
  ['npx @kecan0406/ttheme init -y', 'Wire the terminals found here, no prompts'],
  ['ttheme add homura madoka', 'Install two palettes'],
  ['ttheme use homura', 'Paint this tab with one'],
  ['ttheme list --json madoka', 'The madoka series as JSON'],
  ['ttheme market add alice/ttheme-pastel', "alice's market, alice@pastel — ttheme add alice@pastel/dusk"],
  ['ttheme add dusk --market alice/ttheme-pastel', 'The same in one step'],
  ['ttheme new rei --from rei', 'Your own rei, <you>@<market>/rei, to edit and share'],
]

export function helpText(all: boolean, shell = false): string {
  const shown = VERB_SPECS.filter((v) => !v.hidden && !(shell && v.section === 'setup'))
  const sections = SECTIONS.filter(({ section }) => shown.some((v) => v.section === section))
  const footer = [
    ...(shell ? ['ttheme alone opens preview and browse as tabs — tab and shift+tab move between them'] : []),
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
