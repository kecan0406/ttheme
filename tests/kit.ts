import { fit } from '../src/tui/ansi.ts'
import { type Bar, barLine, type Hint, type Tone, toned } from '../src/tui/bar.ts'
import { button } from '../src/tui/browse/draw.ts'
import { Help, type Legend, type Topic } from '../src/tui/help.ts'
import { type Standing, standingLine } from '../src/tui/notice.ts'
import { boxEdge, boxed, boxTitle, buttonOf, checkOf, moreOf } from '../src/tui/parts.ts'
import { MARKS, painter, SPINNER } from '../src/tui/style.ts'

const p = painter(!process.env.NO_COLOR)
const cols = process.stdout.columns || 100
const rows = process.stdout.rows || 30
const width = cols - 2

const KEYS: Hint[] = [
  ['↑↓', 'move'],
  ['enter', 'open'],
  ['space', 'pick'],
  ['ctrl+r', 'update'],
  ['←→', 'normal or bright'],
  ['l', 'link'],
  ['?', 'keys'],
]

const BAR: Bar = { badge: 'BROWSE', keys: KEYS, right: ['esc', 'cancel'], keep: [] }

const SHORT: Bar = {
  badge: 'PREVIEW',
  keys: [
    ['→', 'open'],
    ['?', 'keys'],
  ],
  right: ['esc', 'cancel'],
}

const TOPICS: Topic[] = [
  { group: 'Move', keys: '↑↓  home  end  pgup  pgdn', does: 'Move up or down', run: () => {} },
  { group: 'Move', keys: '→  enter', does: 'Open a marketplace or a catalog', run: () => {} },
  {
    group: 'Palettes',
    keys: 'space',
    does: 'Pick or unpick',
    more: 'Apply installs what is picked and removes what is not.',
    run: () => {},
  },
  { group: 'Palettes', keys: 'type', does: 'Filter the list' },
  {
    group: 'Palettes',
    keys: 'ctrl+r',
    does: 'Take an update (⇡)',
    more: 'On a palette or a catalog marked ⇡. The update is installed when you apply.',
    run: () => {},
  },
  { group: 'Help', keys: '?  esc', does: 'Close help' },
]

const LEGEND: Legend = [
  [MARKS.on, 'picked'],
  [MARKS.off, 'not picked'],
  [MARKS.update, 'has an update'],
  [MARKS.miss, 'fails a contrast check'],
]

const TONES: Tone[] = ['info', 'ok', 'warn', 'error']
const STANDINGS: Standing[] = ['unknown', 'checking', 'current', 'newer', 'failed']

function heading(text: string): string {
  return p.dim(fit(`── ${text}`, width, false))
}

function bars(): string[] {
  return [
    heading('key bar, narrowing: notes go, then keys from the end, and any that fit come back'),
    ...[width, 72, 56, 44].map((at) => barLine(p, BAR, at)),
    '',
    heading('key bar, a notice in each tone leads it'),
    ...TONES.map((tone) => barLine(p, { ...BAR, lead: toned(p, tone, `A notice in ${tone}`) }, width)),
    '',
    heading('key bar, the release line at its right end, the first thing a narrow window drops'),
    ...STANDINGS.map((standing) =>
      barLine(p, { ...SHORT, standing: { standing, line: standingLine(standing, '1.2.50', '1.2.51') } }, width),
    ),
  ]
}

function buttons(): string[] {
  const states = ['idle', 'focus', 'off'] as const

  return [
    heading('buttonOf: idle, focus, off, and the danger chip'),
    states.map((state) => buttonOf(p, `${MARKS.search} Search marketplace`, state)).join('   '),
    states.map((state) => buttonOf(p, `${MARKS.remove} Remove marketplace`, state, true)).join('   '),
    '',
    heading('a button row: idle, focused, held while its panel has the cursor, off'),
    button(p, 0, false, '+', 'Add marketplace', `  ${p.dim('owner/repo or a folder')}`),
    button(p, 1, true, '+', 'Add marketplace', `  ${p.dim('owner/repo or a folder')}`),
    button(p, 2, false, '+', 'Add marketplace', `  ${p.dim('owner/repo or a folder')}`, { held: true }),
    button(p, 3, false, MARKS.auto, 'Update now', `  ${p.dim('Updating…')}`, { off: true }),
  ]
}

function states(): string[] {
  return [
    heading('empty: what is missing, in the plural, what was typed in single quotes'),
    p.dim("No palettes match 'zzz'"),
    p.dim('No palettes yet'),
    p.dim('No posts of kita on danbooru — tab tries yande.re'),
    '',
    heading('work under way: dim, led by the spinner where the screen turns one'),
    p.dim(`${SPINNER[0]} Fetching alice/ttheme-pastel…`),
    p.dim('Updating…'),
    '',
    heading('a failure: the error role wherever it is named'),
    p.error('Update failed'),
    p.error('github.com/ann/ttheme-pastel: the archive is more than 16 MB'),
    '',
    heading('a notice: plain when the key had nothing to do, ok, warn when refused'),
    ...TONES.map((tone) => toned(p, tone, `Nothing to undo · ${tone}`)),
    '',
    heading('cut lists and checks'),
    `${p.dim(moreOf(-1, 4))}   ${p.dim(moreOf(1, 12))}`,
    `${checkOf(p, true)} passes   ${checkOf(p, false)} fails   ${checkOf(p, undefined)} does not apply`,
  ]
}

function boxes(): string[] {
  const at = Math.min(width, 52)

  return [
    heading('a box, its title and a labelled divider'),
    p.dim(boxEdge(at, 'top', [[2, ' Base ']])),
    boxed(p, `${MARKS.gutter} Background  ${MARKS.swatch} .21 253°`, at),
    p.dim(
      boxEdge(at, 'mid', [
        [2, ' ANSI '],
        [13, ' Normal '],
      ]),
    ),
    boxed(p, '  Black      ■ .26 253°', at),
    p.dim(boxEdge(at, 'bottom')),
    '',
    boxTitle(at, ` Gate ${MARKS.miss} 5 · n next `, p.dim, p.dim),
    boxed(p, `  ${checkOf(p, false)} accent hue outside its ANSI role 41.56 ≤ 0`, at),
    boxed(p, `  ${p.dim(moreOf(1, 8))}`, at),
    p.dim(boxEdge(at, 'bottom')),
  ]
}

function help(typed = '', tall = rows): string[] {
  const shown = new Help(TOPICS, LEGEND)

  if (typed) {
    shown.paste(typed)
  }

  return shown.box(p, cols, tall)
}

const PARTS = {
  bar: bars,
  buttons,
  states,
  boxes,
  help: () => help(),
  'help-filtered': () => help('pick'),
  'help-empty': () => help('zzz'),
  'help-short': () => help('', 12),
} satisfies Record<string, () => string[]>

function isPart(name: string): name is keyof typeof PARTS {
  return Object.hasOwn(PARTS, name)
}

const part = process.argv[2] ?? ''

if (!isPart(part)) {
  process.stderr.write(`kit: no part ${part || '(none)'} — one of ${Object.keys(PARTS).join(', ')}\n`)
  process.exit(1)
}

const drawn = PARTS[part]()

process.stdout.write(`${drawn.slice(0, rows - 1).join('\n')}\n`)
