import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, test } from 'node:test'
import { ROOT } from '../root.ts'
import { cap, capped, capsFor, KEYCAPS, MODIFIERS, useCaps } from './keycaps.ts'
import { MARKS } from './style.ts'

afterEach(() => useCaps('text'))

const layer = readFileSync(join(ROOT, 'shell', 'ttheme.zsh'), 'utf8')

function shellFunction(name: string): string {
  const found = new RegExp(`^${name}\\(\\) \\{\\n[\\s\\S]*?\\n\\}$`, 'm').exec(layer)
  assert.ok(found, `${name} in shell/ttheme.zsh`)

  return found[0]
}

test('Mac key symbols only where ttheme runs on a Mac outside ssh, unless TTHEME_KEYS says otherwise', () => {
  assert.equal(capsFor({}, 'darwin'), 'mac')
  assert.equal(capsFor({ TTHEME_KEYS: 'auto' }, 'darwin'), 'mac')
  assert.equal(capsFor({ SSH_CONNECTION: '10.0.0.2 51234 10.0.0.1 22' }, 'darwin'), 'text')
  assert.equal(capsFor({ SSH_TTY: '/dev/ttys004' }, 'darwin'), 'text')
  assert.equal(capsFor({ SSH_CLIENT: '10.0.0.2 51234 22' }, 'darwin'), 'text')
  assert.equal(capsFor({}, 'linux'), 'text')
  assert.equal(capsFor({ TTHEME_KEYS: 'mac' }, 'linux'), 'mac')
  assert.equal(capsFor({ TTHEME_KEYS: 'text' }, 'darwin'), 'text')
})

test('a key is drawn with the symbols on a Mac, modifiers in Control, Option, Shift order, and as typed elsewhere', () => {
  const keys = [
    'ctrl+r',
    'alt+u',
    'shift+tab',
    'alt+shift+ctrl+a',
    '⇧enter',
    '? esc',
    'bksp',
    'pgup',
    '⇧←→',
    '0-9',
    'R',
  ]

  assert.deepEqual(keys.map(cap), keys)
  useCaps('mac')
  assert.deepEqual(keys.map(cap), ['⌃R', '⌥U', '⇧⇥', '⌃⌥⇧A', '⇧↩', '? ⎋', '⌫', '⇞', '⇧←→', '0-9', 'R'])
})

test('in a line of help, a named key turns into its symbol only where a key stands, a chord anywhere', () => {
  useCaps('mac')
  assert.equal(capped('enter  tab  opens the picker under the slot'), '↩  ⇥  opens the picker under the slot')
  assert.equal(capped('⇧←→  another tab  ·  home  end  the ends'), '⇧←→  another tab  ·  ↖  ↘  the ends')
  assert.equal(capped('Any text  ·  bksp  ·  ctrl+u clears'), 'Any text  ·  ⌫  ·  ⌃U clears')
  assert.equal(capped('space adds it, enter adds it and goes back'), 'space adds it, ↩ adds it and goes back')
  assert.equal(capped('they pass the gate. enter moves on'), 'they pass the gate. ↩ moves on')
  assert.equal(capped('drop a picture or ctrl+v — esc leaves'), 'drop a picture or ⌃V — ⎋ leaves')
  assert.equal(capped('Reset? enter again'), 'Reset? ↩ again')
  assert.equal(capped('the end of the tab'), 'the end of the tab')
})

test('the shell layer decides as the CLI does, on this machine, with and without ssh', () => {
  const { SSH_CONNECTION, SSH_CLIENT, SSH_TTY, TTHEME_KEYS, ...bare } = process.env
  const script = `${shellFunction('__tt_caps')}\n__tt_caps && print mac || print text`

  for (const env of [
    {},
    { SSH_TTY: '/dev/ttys004' },
    { SSH_CONNECTION: '10.0.0.2 1 10.0.0.1 22' },
    { TTHEME_KEYS: 'mac' },
    { TTHEME_KEYS: 'text' },
  ]) {
    const shell = spawnSync('zsh', ['-f', '-c', script], { encoding: 'utf8', env: { ...bare, ...env } })
    assert.equal(shell.stdout.trim(), capsFor(env, process.platform), JSON.stringify(env))
  }
})

test("the shell layer's key tables are the TypeScript ones", () => {
  const caps = /^typeset -gA TTHEME_KEYCAPS=\(\n([\s\S]*?)^\)$/m.exec(layer)?.[1] ?? ''
  const words = caps.split(/\s+/).filter(Boolean)
  const table = Object.fromEntries(words.flatMap((word, i) => (i % 2 ? [] : [[word, words[i + 1]]])))
  assert.deepEqual(table, Object.fromEntries(KEYCAPS))
  const mods = /^typeset -ga TTHEME_KEYMODS=\(([^)]*)\)$/m.exec(layer)?.[1] ?? ''
  assert.deepEqual(mods.split(' '), MODIFIERS.flat())
})

test('the shell layer draws every key and line of help as the Node screens do', () => {
  const lines = [
    'enter  tab  opens the picker under the slot',
    '↑↓  lightness  ·  ←→  chroma  ·  ⇧←→  hue by 5  ·  pgup  pgdn  lightness ×5  ·  home  end  the ends',
    'esc  ctrl+c  leaves, asking first when something changed: y saves, n discards, esc keeps editing',
    'Any text  ·  bksp  ·  ctrl+u clears',
    'enter on Apply, or ⇧enter anywhere  ·  saves, asks where',
    'alt+c  ·  ↑↓ setting  ←→ value',
    'shift+tab  ·  tab on a work',
    'space adds it, enter adds it and goes back',
    'drop a picture or ctrl+v — esc leaves',
    'Reset? enter again',
    '←→ choose · enter unpin · esc keep',
    'the end of the tab',
    '  leading  and trailing  ',
    'a+b  ctrl+  +  ctrl++x  ⌃+r  ctrl+[  end.',
    'ぼっち・ざ・ろっく  ·  enter  ·  けいおん!',
  ]

  const keys = ['ctrl+r', 'alt+u', 'shift+tab', 'alt+shift+ctrl+a', '⇧enter', '? esc', 'bksp', '⇧←→', 'a  b', '']

  const script = [
    `typeset -gA TTHEME_MARKS=(sep ${MARKS.sep})`,
    /^typeset -gA TTHEME_KEYCAPS=\([\s\S]*?^\)$/m.exec(layer)?.[0] ?? '',
    /^typeset -ga TTHEME_KEYMODS=\(.*\)$/m.exec(layer)?.[0] ?? '',
    shellFunction('__tt_caps'),
    shellFunction('__tt_chord'),
    shellFunction('__tt_cap'),
    shellFunction('__tt_capped'),
    'local REPLY',
    'for one in "$@"; do',
    '  if [[ $one == line:* ]]; then __tt_capped "${one#line:}"; else __tt_cap "${one#key:}"; fi',
    '  print -r -- "$REPLY"',
    'done',
  ].join('\n')

  const args = [...lines.map((line) => `line:${line}`), ...keys.map((key) => `key:${key}`)]

  for (const caps of ['mac', 'text'] as const) {
    const shell = spawnSync('zsh', ['-f', '-c', script, '--', ...args], {
      encoding: 'utf8',
      env: { ...process.env, LC_ALL: 'C.UTF-8', TTHEME_KEYS: caps },
    })

    assert.equal(shell.status, 0, shell.stderr)
    useCaps(caps)
    assert.deepEqual(shell.stdout.replace(/\n$/, '').split('\n'), [...lines.map(capped), ...keys.map(cap)], caps)
  }
})
