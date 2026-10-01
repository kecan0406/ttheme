import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

import type { PaletteEntry } from './manifest.ts'
import { CLEAR, detectTerminal, livePaint, type Terminal, TRAITS } from './terminal.ts'

const root = join(import.meta.dirname, '..')
const read = (...path: string[]) => readFileSync(join(root, ...path), 'utf8')

const miku: PaletteEntry = {
  name: 'miku',
  group: 'Vocaloid',
  ansiSource: 'Test',
  background: '#0e2124',
  foreground: '#e0f4f2',
  cursor: '#39c5bb',
  selection: '#1b3b3e',
  order: 2,
  signature: ['#39c5bb', '#ff91c7', '#aab0ff'],
  signatureSlots: ['cursor', 'ansi1', 'ansi12'],
  ansi: Array.from({ length: 16 }, (_, i) => `#0000${i.toString(16).padStart(2, '0')}`),
  gate: [11.92, 8.03, 0, 11.92, 1.88],
  backdrop: { slot: 'cursor', color: '#7cc1d6', opacity: 0.2 },
}

const ENVS: Record<string, string>[] = [
  {},
  { GHOSTTY_RESOURCES_DIR: '/x' },
  { TERM_PROGRAM: 'ghostty' },
  { KITTY_WINDOW_ID: '1' },
  { WEZTERM_PANE: '0' },
  { ALACRITTY_WINDOW_ID: '2' },
  { ITERM_SESSION_ID: 'w0' },
  { TERM_PROGRAM: 'iTerm.app' },
  { TERM: 'foot-extra' },
  { TERM_PROGRAM: 'WarpTerminal', GHOSTTY_RESOURCES_DIR: '/x' },
  { WT_SESSION: 'a-b' },
  { WT_SESSION: 'a-b', TERM_PROGRAM: 'vscode' },
  { TERM_PROGRAM: 'Apple_Terminal' },
  { GHOSTTY_RESOURCES_DIR: '/x', KITTY_WINDOW_ID: '1' },
  { KITTY_WINDOW_ID: '1', WEZTERM_PANE: '0' },
  { ITERM_SESSION_ID: 'w0', TERM_PROGRAM: 'tmux', TERM: 'foot' },
  { KONSOLE_VERSION: '230805' },
  { KONSOLE_VERSION: '230805', WT_SESSION: 'a-b' },
  { KONSOLE_VERSION: '230805', ITERM_SESSION_ID: 'w0' },
  { ALACRITTY_WINDOW_ID: '2', KONSOLE_VERSION: '230805' },
  { NVIM: '/tmp/nvim.sock', TERM_PROGRAM: 'ghostty', GHOSTTY_RESOURCES_DIR: '/x' },
  { VIM_TERMINAL: '901', KITTY_WINDOW_ID: '1' },
  { INSIDE_EMACS: 'vterm', ITERM_SESSION_ID: 'w0', TERM_PROGRAM: 'iTerm.app' },
  { TERM_PROGRAM: 'vscode', GHOSTTY_RESOURCES_DIR: '/x' },
  { WT_SESSION: 'a-b', TERM_PROGRAM: 'Hyper' },
]

test('detectTerminal answers what the shell layer detects, for every terminal and their overlaps', () => {
  const layer = read('shell', 'ttheme.zsh')
  const from = layer.indexOf('if [[ -n $NVIM ')
  const indent = layer.slice(layer.lastIndexOf('\n', from) + 1, from)
  const block = layer.slice(from, layer.indexOf(`\n${indent}fi\n`, from) + indent.length + 3)
  assert.ok(from >= 0 && block.endsWith(`\n${indent}fi`), 'the adapter detection block moved')
  for (const env of ENVS) {
    const shell = spawnSync('zsh', ['-f', '-c', `${block}\nprint -rn -- $TTHEME_ADAPTER`], {
      env: { PATH: process.env.PATH, ...env },
      encoding: 'utf8',
    })
    assert.equal(shell.stdout, detectTerminal(env), JSON.stringify(env))
  }
  assert.equal(detectTerminal({ TERM_PROGRAM: 'WarpTerminal', GHOSTTY_RESOURCES_DIR: '/x' }), 'warp')
  assert.equal(detectTerminal({ WT_SESSION: 'a-b', TERM_PROGRAM: 'Hyper' }), 'unknown')
  assert.equal(
    detectTerminal({ NVIM: '/tmp/nvim.sock', TERM_PROGRAM: 'ghostty', GHOSTTY_RESOURCES_DIR: '/x' }),
    'editor',
  )
})

test('the shell adapters open find and repaint in part exactly where TRAITS says', () => {
  const adapters = readdirSync(join(root, 'shell', 'adapters'))
    .filter((file) => !file.startsWith('_'))
    .map((file) => file.replace(/\.zsh$/, ''))
  for (const adapter of adapters) {
    assert.ok(adapter in TRAITS, `shell/adapters/${adapter}.zsh has no TRAITS entry`)
  }
  const code = (adapter: string) => read('shell', 'adapters', `${adapter}.zsh`)
  const having = (trait: (terminal: Terminal) => boolean) =>
    (Object.keys(TRAITS) as Terminal[]).filter((terminal) => adapters.includes(terminal) && trait(terminal)).sort()
  assert.deepEqual(
    adapters
      .filter(
        (a) =>
          code(a).includes('source $TTHEME_HOME/adapters/_bg.zsh') &&
          !/^__tt_pv_bg_findable\(\) \{ return 1 \}$/m.test(code(a)),
      )
      .sort(),
    having((t) => TRAITS[t].pictures),
  )
  assert.deepEqual(
    adapters.filter((a) => /^__tt_pv_paint\(\)/m.test(code(a))).sort(),
    having((t) => TRAITS[t].repaint !== undefined && !TRAITS[t].schemes),
  )
  assert.deepEqual(
    adapters.filter((a) => code(a).includes(String.raw`$'\e]50;'$REPLY`)).sort(),
    having((t) => TRAITS[t].schemes === true),
  )
})

test('the shared layer names a terminal only to detect it, and an adapter names only itself', () => {
  const terminals = Object.keys(TRAITS).filter((t) => t !== 'unknown')
  const named = (text: string) => terminals.filter((t) => new RegExp(String.raw`(?<![\w-])${t}(?![\w-])`).test(text))
  const layer = read('shell', 'ttheme.zsh')
  const from = layer.indexOf('if [[ -n $NVIM ')
  const to = layer.indexOf('typeset -g TTHEME_ADAPTER=unknown')
  assert.deepEqual(named(layer.slice(0, from) + layer.slice(to) + read('shell', 'preview.zsh')), [])
  for (const shared of ['_osc.zsh', '_bg.zsh']) {
    assert.deepEqual(named(read('shell', 'adapters', shared)), [], shared)
  }
  for (const file of readdirSync(join(root, 'shell', 'adapters')).filter((f) => !f.startsWith('_'))) {
    const self = file.replace(/\.zsh$/, '')
    assert.deepEqual(
      named(read('shell', 'adapters', file)).filter((t) => t !== self),
      [],
      file,
    )
  }
})

test('Konsole is restored in #rrggbb, the only spelling its OSC 10 and 11 read', () => {
  const live = livePaint({ KONSOLE_VERSION: '230805' }, true)
  assert.ok(live)
  assert.deepEqual(live.slots, [0, 1])
  assert.equal(
    live.restore(
      new Map([
        ['11', 'rgb:2323/2626/2727'],
        ['10', 'rgb:fcfc/fcfc/fcfc'],
      ]),
    ),
    '\x1b]11;#232627\x1b\\\x1b]10;#fcfcfc\x1b\\',
  )
})

test('a palette is worn whole by its color scheme in a wired Konsole, and not at all in an unwired one', () => {
  const live = livePaint({ KONSOLE_VERSION: '230805' }, true)
  assert.ok(live)
  assert.equal(
    live.wear(miku, ['konsole']),
    '\x1b]50;ColorScheme=ttheme-miku;UseCustomCursorColor=true;customCursorColor=#39c5bb\x07',
  )
  assert.equal(live.wear(miku, ['ghostty']), undefined)
  assert.ok(livePaint({ GHOSTTY_RESOURCES_DIR: '/x' }, true)?.wear(miku, [])?.includes('\x1b]4;15;'))
})

test('a live repaint goes nowhere the shell layer keeps its colors off', () => {
  assert.equal(livePaint({ GHOSTTY_RESOURCES_DIR: '/x' }, false), undefined)
  assert.equal(livePaint({ GHOSTTY_RESOURCES_DIR: '/x', NO_COLOR: '1' }, true), undefined)
  assert.equal(livePaint({ GHOSTTY_RESOURCES_DIR: '/x', TMUX: '/tmp/tmux-501/default,1,0' }, true), undefined)
  assert.equal(livePaint({ TERM_PROGRAM: 'WarpTerminal' }, true), undefined)
})

test('iTerm2 is repainted and restored in its background and foreground alone, each OSC color being a profile change', () => {
  const live = livePaint({ ITERM_SESSION_ID: 'w0' }, true)
  assert.ok(live)
  assert.equal(live.paint(miku), '\x1b]11;#0e2124\x1b\\\x1b]10;#e0f4f2\x1b\\')
  const saved = new Map([
    ['11', 'rgb:1111/1111/1111'],
    ['10', 'rgb:eeee/eeee/eeee'],
  ])
  assert.equal(live.restore(saved), '\x1b]11;rgb:1111/1111/1111\x1b\\\x1b]10;rgb:eeee/eeee/eeee\x1b\\')
})

test('a restore puts back every color a repaint sent, resetting the ones the terminal never reported', () => {
  const live = livePaint({ GHOSTTY_RESOURCES_DIR: '/x' }, true)
  assert.ok(live)
  assert.equal(live.slots.length, 20)
  const restore = live.restore(new Map([['11', 'rgb:1111/1111/1111']]))
  assert.ok(restore.startsWith('\x1b]11;rgb:1111/1111/1111\x1b\\\x1b]110\x1b\\\x1b]112\x1b\\\x1b]117\x1b\\'))
  assert.ok(restore.endsWith('\x1b]104;15\x1b\\'))
})

test('every screen clear goes through CLEAR, which iTerm2 does not push into its scrollback', () => {
  assert.ok(!CLEAR.includes('\x1b[2J') && !CLEAR.includes('\x1b[H\x1b[J'))
  const sources = [
    ...readdirSync(join(root, 'src'))
      .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
      .map((file) => join('src', file)),
    ...['ttheme.zsh', 'preview.zsh', 'launch-tab.zsh'].map((file) => join('shell', file)),
    ...readdirSync(join(root, 'shell', 'adapters')).map((file) => join('shell', 'adapters', file)),
  ]
  const clears = /(?:\\x1b|\\e|\\033)\[2J|(?:\\x1b|\\e|\\033)\[H(?:\\x1b|\\e|\\033)\[J/
  assert.deepEqual(
    sources.filter((file) => clears.test(read(file))),
    [],
  )
})

test('every function the shell calls on its own runs under zsh defaults, whatever options a .zshrc set', () => {
  const layer = [
    read('shell', 'ttheme.zsh'),
    read('shell', 'preview.zsh'),
    ...readdirSync(join(root, 'shell', 'adapters')).map((file) => read('shell', 'adapters', file)),
  ].join('\n')
  const called = [
    'ttheme',
    ...[...layer.matchAll(/(?:add-zsh-hook [a-z]+|zle -N|add-zle-hook-widget [a-z-]+|compdef) (__tt_\w+)/g)].map(
      ([, name]) => name ?? '',
    ),
  ]
  assert.ok(called.length > 8)
  for (const name of new Set(called)) {
    const first = new RegExp(`^\\s*${name}\\(\\) \\{\\n\\s*(.*)$`, 'm').exec(layer)?.[1]
    assert.equal(first, 'emulate -L zsh ${=${options[xtrace]:#off}:+-o xtrace}', name)
  }
})

test('a terminal shows pictures only where mise run compat never saw kitty graphics fail, and layers them under cells only where it saw that work', () => {
  const [head = [], ...rows] = read('tests', 'compat', 'expect.tsv')
    .trim()
    .split('\n')
    .map((line) => line.split('\t'))
  const measured = (terminal: Terminal, id: string) => rows.find((row) => row[0] === id)?.[head.indexOf(terminal)]
  for (const terminal of Object.keys(TRAITS) as Terminal[]) {
    const { pictures, bands, layers } = TRAITS[terminal]
    if (!pictures) {
      continue
    }
    for (const id of ['kitty-graphics', 'kitty-el']) {
      assert.notEqual(
        measured(terminal, id),
        'fail',
        `${terminal} shows pictures, but compat measured ${id} failing there`,
      )
    }
    const under = measured(terminal, 'kitty-under-bg')
    if (under === 'pass' || under === 'fail') {
      assert.equal(layers, under === 'pass', `${terminal}: compat measured kitty-under-bg ${under}`)
    }
    const crop = measured(terminal, 'kitty-crop')
    if (crop === 'pass' || crop === 'fail') {
      assert.equal(bands, crop === 'fail', `${terminal}: compat measured kitty-crop ${crop}`)
    }
  }
})
