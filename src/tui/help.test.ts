import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { shellTables } from '../cli/emit-shell.ts'
import { cells } from '../core/text.ts'
import { ROOT } from '../root.ts'
import { fit } from './ansi.ts'
import { Help, keysBox, overlay, type Topic, wrap } from './help.ts'
import { useCaps } from './keycaps.ts'
import { PREVIEW_KEYS } from './preview-keys.ts'
import { MARKS, painter } from './style.ts'
import { lifted, marking, zone } from './zones.ts'

const p = painter(false)

function topicsWithGaps(): Topic[] {
  const run = () => {}

  return [
    { group: 'First', keys: 'a', does: 'Runs', run },
    ...Array.from({ length: 12 }, (_, i) => ({ group: `Note${i}`, keys: 'b', does: 'Only words, nothing to run' })),
    { group: 'Last', keys: 'z', does: 'Runs', run },
  ]
}

test('every topic can be reached in a short help, even the ones with nothing to run', () => {
  const help = new Help(topicsWithGaps())
  const seen = new Set<string>()

  for (let i = 0; i < 20; i++) {
    const { lines, top } = help.box(p, 80, 12)
    help.scrolled(top)

    for (const line of lines) {
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

  const topics = Array.from({ length: 30 }, (_, i) => ({
    group: `T${i}`,
    keys: 'x',
    does: 'Words',
    more: 'More words',
    run,
  }))

  const legend: [string, string][] = Array.from({ length: 8 }, (_, i) => [String(i), 'a mark'])
  const help = new Help(topics, legend)

  for (const rows of [6, 8, 10, 14]) {
    assert.ok(help.box(p, 40, rows).lines.length <= rows - 1, `rows ${rows}`)
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

    return overlay(under, help.box(p, 40, 6).lines, 40, 7, 1)
  })

  const kinds = lifted(drawn, targets).zones.map((z) => [z.row, (z.target as { kind: string }).kind])
  assert.ok(!kinds.some(([row, kind]) => kind === 'key' && row !== 6))
  assert.ok(kinds.some(([row, kind]) => kind === 'key' && row === 6))
})

test("the help box blanks the column beside it only where another box's edge stands", () => {
  const under = ['abc│defgh│ijk', 'abc7defgh8ijk', 'abc─defgh─ijk', 'key bar']
  const laid = overlay(under, ['┌───┐', '│ x │', '└───┘'], 13, 4, 0)
  assert.deepEqual(laid.slice(0, 3), ['abc ┌───┐ ijk', 'abc7│ x │8ijk', 'abc └───┘ ijk'])
})

function shellFunction(file: string, name: string): string {
  const text = readFileSync(join(ROOT, 'shell', file), 'utf8')
  const found = new RegExp(`^${name}\\(\\) \\{\\n[\\s\\S]*?\\n\\}$`, 'm').exec(text)
  assert.ok(found, `${name} in shell/${file}`)

  return found[0]
}

test("preview's help wraps every line as the Node help does", () => {
  const texts = [
    'Move up or down',
    'Open or close a work',
    'Filter by name or title, in Japanese too',
    'Use it in this tab, choosing where',
    'Save the picture, then choose where to use the palette',
    'Back to the list, dropping picture changes since the last save',
    "Every palette in the system's mode, following it as it changes",
    'enter  tab  two keys  apart',
    'a word much longer than any line it could be laid on, extraordinarily so, supercalifragilistic',
    'ぼっち・ざ・ろっく けいおん! らき☆すた 葬送のフリーレン',
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

const layer = readFileSync(join(ROOT, 'shell', 'ttheme.zsh'), 'utf8')

function layerBlock(pattern: RegExp): string {
  const found = pattern.exec(layer)
  assert.ok(found, String(pattern))

  return found[0]
}

function keysBoxOnShell(cases: [number, number, string][]): string[] {
  const table = /^typeset -ga TTHEME_PREVIEW_KEYS=\(\n[\s\S]*?\n\)$/m.exec(shellTables([], []).palettes)?.[0]
  assert.ok(table, 'TTHEME_PREVIEW_KEYS in the emitted tables')
  const marks = Object.entries(MARKS).map(([key, glyph]) => `${key} ${glyph}`)

  const script = [
    `typeset -gA TTHEME_MARKS=(${marks.join(' ')})`,
    'typeset -gA TTHEME_SGR=(reset "" bold "" dim "")',
    layerBlock(/^typeset -gA TTHEME_KEYCAPS=\([\s\S]*?^\)$/m),
    layerBlock(/^typeset -ga TTHEME_KEYMODS=\(.*\)$/m),
    table,
    ...['__tt_caps', '__tt_chord', '__tt_cap', '__tt_capped', '__tt_clip'].map((name) =>
      shellFunction('ttheme.zsh', name),
    ),
    ...['__tt_pv_topics', '__tt_pv_keys', '__tt_pv_box', '__tt_pv_te_edge', '__tt_pv_te_sides'].map((name) =>
      shellFunction('preview.zsh', name),
    ),
    'typeset -i TTHEME_PALETTES_IN=1 ph=30 sbot gmenu=0 te=0 tfocus=0 hub=0 help=0 color=0 sc sw se',
    'typeset gc= pick= tune= out= REPLY=',
    'while (( $# )); do',
    '  sw=$1 sc=$2 se=$(( $2 + $1 - 1 )) tune=$3 out=',
    '  __tt_pv_keys ${${3:+panel}:-list}',
    '  print -r -- "$out"',
    '  shift 3',
    'done',
  ].join('\n')

  const ran = spawnSync(
    'zsh',
    ['-f', '-c', script, '--', ...cases.flatMap(([sw, sc, tune]) => [String(sw), String(sc), tune])],
    {
      encoding: 'utf8',
      env: { ...process.env, LC_ALL: 'C.UTF-8', TTHEME_KEYS: 'text' },
    },
  )

  assert.equal(ran.status, 0, ran.stderr)

  return ran.stdout.replace(/\n$/, '').split('\n')
}

function gridRows(out: string, sc: number, sw: number): string[] {
  const cellsAt = new Map<number, Map<number, string>>()

  for (const piece of out.split('\x1b[').slice(1)) {
    const [, row, col, text] = /^(\d+);(\d+)H([\s\S]*)$/.exec(piece) as RegExpExecArray
    const line = cellsAt.get(Number(row)) ?? new Map<number, string>()
    cellsAt.set(Number(row), line)
    let at = Number(col)

    for (const ch of text as string) {
      line.set(at, ch)

      for (let i = 1; i < cells(ch); i++) {
        line.set(at + i, '')
      }

      at += cells(ch)
    }
  }

  const rows = [...cellsAt.keys()].sort((a, b) => a - b)

  return rows.map((row) => {
    const line = cellsAt.get(row) as Map<number, string>
    assert.ok(
      [...line.keys()].every((col) => col >= sc && col < sc + sw),
      `row ${row} stays inside columns ${sc} to ${sc + sw - 1}`,
    )

    return Array.from({ length: sw }, (_, i) => line.get(sc + i) ?? ' ').join('')
  })
}

function heldAgainstKeysBox(where: 'list' | 'panel', tune: string): void {
  useCaps('text')

  const topics = PREVIEW_KEYS.filter((k) => k.where === where).map((k) => ({
    group: k.group,
    keys: k.keys,
    does: k.does,
    onBar: k.onBar ?? false,
  }))

  const cases = [30, 40, 48, 60].flatMap((sw) => [1, 50].map((sc): [number, number, string] => [sw, sc, tune]))
  const got = keysBoxOnShell(cases)
  assert.equal(got.length, cases.length)

  cases.forEach(([sw, sc], i) => {
    const want = keysBox(p, topics, sw)
    const drawn = (got[i] as string) === '' ? [] : gridRows(got[i] as string, sc, sw)
    assert.deepEqual(drawn, want, `${where} box, ${sw} wide at column ${sc}`)
  })
}

test("preview's Help box lists the keys no bar names as the Node screens do", () => {
  heldAgainstKeysBox('list', '')
})

test("preview's Help box over the tuning panel lists its keys as the Node screens do", () => {
  heldAgainstKeysBox('panel', 'dust')
})
