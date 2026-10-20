import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { ROOT } from '../root.ts'
import { fit } from './ansi.ts'
import { Help, overlay, type Topic, wrap } from './help.ts'
import { MARKS, painter } from './style.ts'
import { lifted, marking, zone } from './zones.ts'

const p = painter(false)

function topicsWithGaps(): Topic[] {
  const run = () => {}

  return [
    { label: 'First', text: 'a  runs', run },
    ...Array.from({ length: 12 }, (_, i) => ({ label: `Note${i}`, text: 'only words, nothing to run' })),
    { label: 'Last', text: 'z  runs', run },
  ]
}

test('every topic can be reached in a short help, even the ones with nothing to run', () => {
  const help = new Help(topicsWithGaps())
  const seen = new Set<string>()

  for (let i = 0; i < 20; i++) {
    for (const line of help.box(p, 80, 12)) {
      for (const match of line.matchAll(/(First|Last|Note\d+)/g)) {
        seen.add(match[1] as string)
      }
    }

    help.key('down')
  }

  assert.equal(seen.size, 14)
})

test('the help is never taller than the rows it was given, dropping its marks first', () => {
  const run = () => {}
  const topics = Array.from({ length: 30 }, (_, i) => ({ label: `T${i}`, text: 'x  words', run }))
  const legend: [string, string][] = Array.from({ length: 8 }, (_, i) => [String(i), 'a mark'])
  const help = new Help(topics, legend)

  for (const rows of [6, 8, 10, 14]) {
    assert.ok(help.box(p, 40, rows).length <= rows - 1, `rows ${rows}`)
  }
})

test('the screen under the help keeps no click zones but on its last row, the key bar', () => {
  const help = new Help(topicsWithGaps())

  const { drawn, targets } = marking(() => {
    const under = [
      zone({ kind: 'key', key: 's' }, 'Save'),
      'text',
      '',
      '',
      '',
      '',
      zone({ kind: 'key', key: '?' }, '? keys'),
    ]

    return overlay(under, help.box(p, 40, 6), 40, 7, 1)
  })

  const kinds = lifted(drawn, targets).zones.map((z) => [z.row, (z.target as { kind: string }).kind])
  assert.ok(!kinds.some(([row, kind]) => kind === 'key' && row !== 6))
  assert.ok(kinds.some(([row, kind]) => kind === 'key' && row === 6))
})

function shellFunction(file: string, name: string): string {
  const text = readFileSync(join(ROOT, 'shell', file), 'utf8')
  const found = new RegExp(`^${name}\\(\\) \\{\\n[\\s\\S]*?\\n\\}$`, 'm').exec(text)
  assert.ok(found, `${name} in shell/${file}`)

  return found[0]
}

test("preview's help wraps every topic as the Node help does", () => {
  const texts = [
    '↑↓  home  end  pgup  pgdn',
    '←→  ·  enter or space on a catalog',
    'Any text  ·  bksp  ·  ctrl+u clears',
    'enter  applies  ·  esc restores the tab',
    '→  enter  ·  a marketplace into the panel, a catalog',
    '↓  below its palettes, to its own actions  ·  enter  updates it, turns auto-update on or off, removes it',
    'ctrl+r  on a palette marked ⇡  ·  takes what its marketplace gives now',
    'pgup pgdn lightness ×5  ·  home end the ends  ·  0-9 jump to a tenth of the way',
    'a word much longer than any line it could be laid on, extraordinarily so, supercalifragilistic',
    'ぼっち・ざ・ろっく  ·  けいおん!  ·  らき☆すた  ·  葬送のフリーレン',
  ]

  const widths = [6, 10, 14, 20, 26, 33, 41, 56, 72]
  const pairs = texts.flatMap((text) => widths.map((width) => [text, width] as const))
  const marks = Object.entries(MARKS).map(([key, glyph]) => `${key} ${glyph}`)

  const script = [
    `typeset -gA TTHEME_MARKS=(${marks.join(' ')})`,
    'typeset -gA TTHEME_SGR=(reset "")',
    shellFunction('ttheme.zsh', '__tt_clip'),
    shellFunction('preview.zsh', '__tt_pv_wrap'),
    'local -a reply',
    'while (( $# )); do __tt_pv_wrap "$2" $1; print -r -- "${(pj:\\x1e:)reply}"; shift 2; done',
  ].join('\n')

  const shell = spawnSync(
    'zsh',
    ['-f', '-c', script, '--', ...pairs.flatMap(([text, width]) => [String(width), text])],
    {
      encoding: 'utf8',
      env: { ...process.env, LC_ALL: 'C.UTF-8' },
    },
  )

  assert.equal(shell.status, 0, shell.stderr)
  const got = shell.stdout.replace(/\n$/, '').split('\n')
  assert.equal(got.length, pairs.length)

  pairs.forEach(([text, width], i) => {
    const drawn = wrap(text, width).map((line) => fit(line, width, false))
    assert.deepEqual((got[i] as string).split('\x1e'), drawn, `${width} columns: ${text}`)
  })
})
