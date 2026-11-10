import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { ROOT } from '../root.ts'
import { boxEdge, boxed } from './parts.ts'
import { painter } from './style.ts'

const p = painter(false)

function shellFunction(file: string, name: string): string {
  const text = readFileSync(join(ROOT, 'shell', file), 'utf8')
  const found = new RegExp(`^${name}\\(\\) \\{\\n[\\s\\S]*?\\n\\}$`, 'm').exec(text)
  assert.ok(found, `${name} in shell/${file}`)

  return found[0]
}

function shell(script: string[], args: string[]): string[] {
  const ran = spawnSync('zsh', ['-f', '-c', script.join('\n'), '--', ...args], {
    encoding: 'utf8',
    env: { ...process.env, LC_ALL: 'C.UTF-8' },
  })

  assert.equal(ran.status, 0, ran.stderr)

  return ran.stdout.replace(/\n$/, '').split('\n')
}

test("preview draws a box's edge as the Node screens do", () => {
  const edges: [number, 'top' | 'mid' | 'bottom', [number, string][]][] = [
    [2, 'top', []],
    [3, 'bottom', []],
    [24, 'top', []],
    [24, 'mid', []],
    [24, 'bottom', []],
    [24, 'top', [[2, ' Help ']]],
    [
      40,
      'top',
      [
        [2, ' Palette '],
        [26, ' kai@dust '],
      ],
    ],
    [
      40,
      'mid',
      [
        [11, '┬'],
        [20, '┬'],
        [29, '┬'],
      ],
    ],
    [12, 'top', [[2, ' A title too long for it ']]],
    [12, 'top', [[0, 'From the corner']]],
    [12, 'top', [[9, ' end ']]],
    [12, 'top', [[40, ' past the edge ']]],
    [
      30,
      'top',
      [
        [2, ' Picture '],
        [6, ' over '],
      ],
    ],
  ]

  const args = edges.flatMap(([width, at, labels]) => {
    const plain = boxEdge(width, at)

    return [
      String(width),
      `${plain[0]}${plain.at(-1)}`,
      String(labels.length),
      ...labels.flatMap(([col, text]) => [String(col), text]),
    ]
  })

  const got = shell(
    [
      shellFunction('preview.zsh', '__tt_te_edge'),
      'while (( $# )); do',
      '  width=$1 corners=$2 count=$3',
      '  shift 3',
      '  __tt_te_edge $width $corners "${(@)@[1,2 * count]}"',
      '  print -r -- "$REPLY"',
      '  shift $(( 2 * count ))',
      'done',
    ],
    args,
  )

  assert.deepEqual(
    got,
    edges.map(([width, at, labels]) => boxEdge(width, at, labels)),
  )
})

test('preview draws a boxed row as the Node screens do', () => {
  const rows: [string, number][] = [
    ['', 12],
    [' Background', 24],
    [' Selection   ██ #2a2c3d', 24],
    [' fits exactly in it ', 22],
    [' one cell too long for', 22],
    [' A row far too long for the box it is drawn in', 20],
    [' 배경  背景  ██', 20],
    [' 日本語のとても長い行はここで切れる', 16],
    [' \x1b[1mbold\x1b[22m and plain', 28],
    ['x', 3],
    ['xy', 3],
  ]

  const got = shell(
    [
      'typeset -gA TTHEME_SGR=(reset "")',
      shellFunction('ttheme.zsh', '__tt_clip'),
      shellFunction('preview.zsh', '__tt_te_boxed'),
      'd= dx=',
      'while (( $# )); do __tt_te_boxed "$1" $2; print -r -- "$REPLY"; shift 2; done',
    ],
    rows.flatMap(([text, width]) => [text, String(width)]),
  )

  assert.deepEqual(
    got,
    rows.map(([text, width]) => boxed(p, text, width)),
  )
})
