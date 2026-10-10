import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { contrast } from '../color.ts'
import { loadThemes } from '../theme.ts'
import {
  ansiBar,
  ansiFg,
  ansiSquares,
  BG_RESET,
  close,
  closing,
  FG_RESET,
  INK_RESET,
  MARKS,
  open,
  RESET,
  ROLES,
  type Role,
  SURFACES,
  type Surface,
  slotFg,
  surfaceOf,
} from './style.ts'

const root = join(import.meta.dirname, '..', '..')
const TABLE = /^typeset -gA TTHEME_SGR=\([\s\S]*?^\)$/m

function read(...parts: string[]): string {
  return readFileSync(join(root, ...parts), 'utf8')
}

test('ansiFg opens a truecolor foreground without resetting', () => {
  assert.equal(ansiFg('#ff0080'), '\x1b[38;2;255;0;128m')
})

test('ansiBar opens a background and a foreground without resetting', () => {
  assert.equal(ansiBar('#102030', '#ffffff'), '\x1b[48;2;16;32;48;38;2;255;255;255m')
})

test('ansiSquares spaces one square per color and hands the foreground back', () => {
  assert.equal(ansiSquares(['#ff0000', '#00ff00']), '\x1b[38;2;255;0;0m■ \x1b[38;2;0;255;0m■\x1b[39m')
})

test('every screen takes its SGR from style.ts, and the shell layer from TTHEME_SGR', () => {
  const sgr = /\\(?:x1b|u001b|033|e)\[(?:[0-9;]|\$\{[^}]*\})*m/
  const sources = [
    ...readdirSync(join(root, 'src'), { recursive: true, encoding: 'utf8' })
      .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts') && file !== join('tui', 'style.ts'))
      .map((file) => join('src', file)),
    ...['ttheme.zsh', 'preview.zsh', 'launch-tab.zsh'].map((file) => join('shell', file)),
    ...readdirSync(join(root, 'shell', 'adapters')).map((file) => join('shell', 'adapters', file)),
  ]
  const raw = sources.flatMap((file) =>
    read(file)
      .replace(TABLE, '')
      .split('\n')
      .flatMap((line, i) => (sgr.test(line) ? [`${file}:${i + 1} ${line.trim()}`] : [])),
  )
  assert.deepEqual(raw, [])
})

test('the shell layer gives each role the SGR style.ts gives it', () => {
  const block = read('shell', 'ttheme.zsh').match(TABLE)?.[0] ?? ''
  const table = Object.fromEntries(
    [...block.matchAll(/(\S+) \$'\\e\[([0-9;]*)m'/g)].map(([, key, params]) => [key, `\x1b[${params}m`]),
  )
  const roles = Object.keys(ROLES) as Role[]
  assert.deepEqual(table, {
    reset: RESET,
    '/fg': FG_RESET,
    '/bg': BG_RESET,
    '/ink': INK_RESET,
    ...Object.fromEntries(
      roles.flatMap((role) => [
        [role, open(role)],
        [`/${role}`, close(role)],
      ]),
    ),
    ...Object.fromEntries(Array.from({ length: 8 }, (_, slot) => [`fg${slot}`, slotFg(slot)])),
  })
})

test('a role closes exactly what it opens, so it never ends a painted row early', () => {
  for (const role of Object.keys(ROLES) as Role[]) {
    assert.equal(closing(open(role)), close(role), role)
  }
})

test('the accent slot, the chip’s slot 8 and the danger slot 1 read on every official background, and the surfaces step away from the accent in order', () => {
  const names = Object.keys(SURFACES) as Surface[]
  for (const theme of loadThemes(join(root, 'themes'))) {
    assert.ok(contrast(theme.ansi[6] as string, theme.background) >= 3, theme.name)
    assert.ok(contrast(theme.ansi[8] as string, theme.background) >= 3, theme.name)
    assert.ok(contrast(theme.foreground, theme.ansi[8] as string) >= 3, theme.name)
    assert.ok(contrast(theme.ansi[1] as string, theme.background) >= 3, theme.name)
    const steps = names.map((name) => contrast(surfaceOf(theme.background, theme.foreground, name), theme.background))
    assert.deepEqual(
      steps,
      [...steps].sort((a, b) => a - b),
      theme.name,
    )
  }
})

test('a mark means one thing', () => {
  const glyphs = Object.values(MARKS)
  assert.equal(new Set(glyphs).size, glyphs.length)
})
