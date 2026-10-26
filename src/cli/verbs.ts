import pkg from '../../package.json' with { type: 'json' }
import { CODE, SHARE_URL } from '../core/draft.ts'
import { WIRED } from '../core/wired.ts'
import { markOf } from '../tui/parts.ts'
import { type Paint, painter } from '../tui/style.ts'
import { EXIT_CODES } from './answer.ts'

export interface Flag {
  type: 'boolean' | 'string'
  short?: string
  multiple?: true
  value?: string
  choices?: readonly string[]
  about: string
}

export type Section = 'tab' | 'startup' | 'palettes' | 'own' | 'setup' | 'support'

export const SECTIONS: { section: Section; title: string }[] = [
  { section: 'tab', title: 'This tab' },
  { section: 'startup', title: 'New tabs' },
  { section: 'palettes', title: 'Palettes' },
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
  more?: true
  flags?: Record<string, Flag>
  notes?: string[]
}

export const VERB_SPECS: VerbSpec[] = [
  {
    name: 'use',
    args: ['<palette>'],
    about: 'Use a palette in this tab — a unique prefix works: ttheme use ho',
    section: 'tab',
    shell: true,
  },
  { name: 'default', args: ['<palette>'], about: 'Make a palette the one new tabs open with', section: 'startup' },
  { name: 'on', args: [], about: 'Use the default palette in new tabs again', section: 'startup' },
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
    about: "Drop a pin — this directory's, every one below it, the one above that covers it, or an ssh host's",
    section: 'tab',
    shell: true,
  },
  {
    name: 'pins',
    args: [],
    about:
      "Map every pin as a file tree — the pinned directories in their palettes' colors, every ssh host, and the pin that covers this one",
    section: 'tab',
    shell: true,
  },
  {
    name: 'config',
    args: [],
    about: 'Edit settings in $EDITOR — a new mode reaches every open tab, the rest apply in new tabs',
    section: 'startup',
    shell: true,
  },
  {
    name: 'auto',
    args: [],
    about:
      'Show every palette in the mode the system is in — following it as it changes, where a wired Ghostty, iTerm2, kitty or WezTerm reports it',
    section: 'startup',
    shell: true,
  },
  {
    name: 'light',
    args: [],
    about: 'Show every palette in its light mode — every open tab repaints, and new tabs open in it',
    section: 'startup',
    shell: true,
  },
  {
    name: 'dark',
    args: [],
    about: 'Show every palette in its dark mode — every open tab repaints, and new tabs open in it',
    section: 'startup',
    shell: true,
  },
  {
    name: 'browse',
    args: [],
    about:
      'Pick palettes and marketplaces in a live picker — one list with every marketplace as a card, its palettes and actions in a panel beside it',
    section: 'palettes',
    hidden: true,
  },
  {
    name: 'add',
    args: ['<palette...>'],
    about: `Install palettes — from your marketplaces, from a share link (ttheme add ${SHARE_URL}${CODE}…), whose tuned palettes join your local marketplace, or from a palette file, which joins it under its file's name: ttheme add ~/Downloads/kisara.toml`,
    section: 'palettes',
    flags: {
      in: {
        type: 'string',
        value: '<marketplace>',
        about:
          'The local marketplace a palette file, or a tuned palette from a link, goes into — when you have more than one',
      },
    },
  },
  {
    name: 'update',
    args: ['[marketplace...]'],
    about:
      'Update ttheme and refresh your marketplaces — the built-in palettes come with ttheme; an installed palette from another marketplace keeps its colors until ctrl+r on it in Browse takes its update',
    section: 'palettes',
  },
  {
    name: 'marketplace',
    args: ['<action>', '[source]'],
    about:
      'Add or drop a marketplace — Browse also finds them on GitHub and switches their auto-update; init makes one of your own',
    actions: [
      [
        'add <source>',
        'Add a marketplace — a repository (alice/ttheme-pastel, #v1 pins a tag or branch), a folder, or ttheme for the built-in one; asks whether it updates on its own',
      ],
      ['remove <marketplace>', 'Drop one by its name (alice@pastel) — the palettes you installed from it keep working'],
      [
        'init [name]',
        'Make a marketplace of your own — <you>@<name>, in ~/.config/ttheme/marketplace/<name> or a folder you give',
      ],
      [
        'check [dir]',
        "Check a marketplace's folder before you push it — ttheme-marketplace.toml, every palette, the works it proposes against the commons, the renames and the contrast checks; nothing is written",
      ],
    ],
    section: 'palettes',
    flags: {
      owner: {
        type: 'string',
        value: '<handle>',
        about: 'init: your GitHub handle, when gh is not logged in and there is no terminal to ask in',
      },
    },
  },
  {
    name: 'new',
    args: ['<name>'],
    about:
      'Make a palette of your own in the palette editor — <you>@<marketplace>/<name>, from blank, installed at once',
    section: 'own',
    flags: {
      from: {
        type: 'string',
        value: '<palette>',
        about: 'Start from this palette — its colors, and the work or character it is of — instead of blank',
      },
      in: {
        type: 'string',
        value: '<marketplace>',
        about: 'The local marketplace to put it in — when you have more than one',
      },
    },
  },
  {
    name: 'edit',
    args: ['[palette]'],
    about:
      "Change a palette in the palette editor — your own in its file, any other as your tuning over its marketplace's colors, which R and s in the editor put back; with none named, asks to edit the one this tab shows",
    section: 'own',
  },
  {
    name: 'check',
    args: ['[palette]'],
    about:
      'Check a palette against the contrast checks — where one fails, suggest colors that pass; with none named, asks to check the one this tab shows',
    section: 'own',
    more: true,
    flags: { fix: { type: 'boolean', about: 'Write the suggested colors into your palette' } },
  },
  {
    name: 'palette',
    args: ['<action>', '[arg]'],
    about:
      "Make a character's palette from colors measured on its art — the steps the ttheme-palette agent skill takes, each printing JSON with --json",
    section: 'own',
    more: true,
    actions: [
      [
        'measure <file|url>',
        "Count a picture's flat colors, or a box's with --crop — --preview writes a copy at most 800 px on its long side and reads the box in its pixels",
      ],
      [
        'consensus <tag>',
        "Read which colors danbooru's posts of a character tag name — the eyes, an item, or none — to pick the parts that carry the identity",
      ],
      [
        'make [palette]',
        'Turn an anchors file into palettes — ranks base schemes, harmonizes, fixes the ANSI roles and runs the contrast checks, then writes them into your local marketplace, proposes in its works/ each work or character the commons lacks, and installs them',
      ],
    ],
    flags: {
      json: { type: 'boolean', about: 'Print the result as JSON on stdout' },
      preview: {
        type: 'boolean',
        about: 'measure: write a preview at most 800 px on its long side; --crop is then in its pixels',
      },
      crop: { type: 'string', value: 'x,y,w,h', about: 'measure: the box to count' },
      quant: {
        type: 'string',
        value: '<n>',
        about: "measure: group near-duplicate colors — a JPEG's, an antialiased edge's — into n levels a channel",
      },
      anchors: { type: 'string', value: '<file>', about: 'make: the anchors file' },
      work: {
        type: 'string',
        value: '<work>',
        about: 'make: the work the characters are from, by its id — the name of its file in commons/works/',
      },
      'work-name': { type: 'string', value: '<name>', about: "make: a new work's name, as lists show it" },
      'work-native': { type: 'string', value: '<title>', about: "make: a new work's title in its own language" },
      in: {
        type: 'string',
        value: '<marketplace>',
        about: 'make: your local marketplace to write into, or its folder',
      },
      'dry-run': { type: 'boolean', about: 'make: show the result and write nothing' },
    },
    notes: [
      'Anchors file (--anchors), one entry per palette:',
      '  {',
      '    "bocchi": {',
      '      "slots": { "cursor": ["hair", "#ffb7c8"], "ansi4": ["eyes", "#7b96c8"], "ansi9": ["jacket", "#f39cbf"] },',
      '      "booru": "gotoh_hitori",',
      '      "native_names": ["後藤ひとり"],',
      '      "source": "https://…"',
      '    }',
      '  }',
      '  slots         three colors in the order the character reads, the first the seed — background, foreground,',
      '                cursor, selection or ansi0–ansi15 — each ["<part>", "#rrggbb"] as measured',
      "  booru         the character's danbooru tag — a character the commons knows by it is the one the palette",
      '                is of; otherwise it is recorded with the new character (optional)',
      "  native_names  the new character's names in its own language; left out, ttheme's name data fills them in (optional)",
      '  source        where the colors were measured (optional)',
      '',
      'With --json each action prints one object on stdout, its status done, unchanged or error;',
      'an error lists each field it refuses in problems, as { path, problem }.',
    ],
  },
  {
    name: 'share',
    args: ['[palette]'],
    about:
      "Share palettes as a link or a GitHub marketplace — asks which and which palettes, then prints the link and its QR code; ttheme add <link> installs a link's palettes, pictures included, and ttheme marketplace add <owner>/<repo> adds the marketplace, which gh creates and sharing it again updates; a palette named, or a link into a pipe, shares that palette, or the one this tab shows, as a link without asking",
    section: 'own',
    flags: {
      tone: {
        type: 'string',
        value: '<tuned|original>',
        choices: ['tuned', 'original'],
        about:
          'Share the palettes you tuned as you tuned them, named <palette>-tuned, or as they were — asked when you omit this',
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
      'Wire one more terminal into this setup, after showing what it edits — the shell offers it in a terminal that shows colors only through the config init would have wired',
    section: 'setup',
    hidden: true,
  },
  {
    name: 'info',
    args: [],
    about: 'Print what a bug report needs — version, OS, shell, terminal and the settings you changed',
    section: 'support',
    more: true,
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
    about: "Pick a booru background for a palette — preview's panel opens this on f",
    section: 'setup',
    hidden: true,
  },
  {
    name: 'image',
    args: ['<palette>', '<action>', '[picture]'],
    about:
      "Show one of a palette's saved backgrounds, remove one, draw one in its own colors or tinted in its palette's color (or get the other ready before it is asked for), or pass on tuning — preview calls this",
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
    about:
      "Place a picture on a transparent canvas where preview's tuning puts it — preview calls this for a size the terminal cannot scale and for the bands iTerm2 shows",
    section: 'setup',
    hidden: true,
  },
  {
    name: 'tone',
    args: ['<palette>', '<action>', '[width]'],
    about:
      "Print a palette's colors for preview's panel at its width, open them in the palette editor, or reset them to its marketplace's — preview calls this",
    section: 'setup',
    hidden: true,
  },
  {
    name: 'sync',
    args: [],
    about:
      "Write every wired terminal's config again from what is installed and config.zsh, drawing first the background pictures that TTHEME_MODE turned — ttheme config, ttheme auto, light and dark, and preview call this when TTHEME_TAB_PALETTE or TTHEME_MODE changed",
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
    name: 'latest',
    args: [],
    about: 'Ask npm for the newest ttheme — a command or a shell prompt starts this in the background once a day',
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

export function headOf(text: string): string {
  return text.split(' — ')[0] as string
}

export function flagRows(verb: VerbSpec): [string, string][] {
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

export function bannerHead(p: Paint): string {
  const mark = markOf(p)

  return `${mark ? `${mark} ` : ''}${p.bold('ttheme')} ${pkg.version}`
}

function bannerOf(color: boolean): string[] {
  return [bannerHead(painter(color)), pkg.description, 'Usage: ttheme <command> [options] [args]']
}

const GETTING_HELP: [string, string][] = [
  ['ttheme help', 'The everyday commands'],
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
  ['ttheme use homura', 'Use one in this tab'],
  ['ttheme marketplace add alice/ttheme-pastel', "alice's marketplace, alice@pastel — ttheme add alice@pastel/dusk"],
  ['ttheme new rei --from rei', 'Your own rei, <you>@<marketplace>/rei, to edit and share'],
]

export function briefText(color = false): string {
  return [...bannerOf(color), '', 'Use --help to list every command, or init to set ttheme up'].join('\n')
}

export const DOCS_URL = 'https://ttheme.dev/docs'

export function docsOf(verb: VerbSpec): string {
  return `${DOCS_URL}/reference/commands#${verb.name}`
}

export function commandHelp(verb: VerbSpec): string {
  const flags = flagRows(verb)

  return [
    `Usage: ttheme ${usageOf(verb)}`,
    '',
    verb.about,
    ...(verb.actions ? ['', 'Actions:', ...columns(verb.actions)] : []),
    ...(flags.length > 0 ? ['', 'Options:', ...columns(flags)] : []),
    ...(verb.notes ? ['', ...verb.notes] : []),
    ...(verb.flags?.json ? ['', 'Exit codes:', ...columns(EXIT_CODES, 1)] : []),
    '',
    `Docs: ${docsOf(verb)}`,
  ].join('\n')
}

export function helpText(all: boolean, shell = false, color = false): string {
  const shown = VERB_SPECS.filter((v) => !v.hidden && (all || !v.more) && !(shell && v.section === 'setup'))
  const sections = SECTIONS.filter(({ section }) => shown.some((v) => v.section === section))

  return [
    ...bannerOf(color),
    'ttheme alone opens Preview and Browse as tabs — Browse installs and removes palettes; tab and shift+tab move between them',
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
    `Docs: ${DOCS_URL}`,
  ].join('\n')
}
