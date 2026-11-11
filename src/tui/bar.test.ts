import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { cells } from '../core/text.ts'
import { ROOT } from '../root.ts'
import { barLine } from './bar.ts'
import { useCaps } from './keycaps.ts'
import type { ReleaseLine } from './notice.ts'
import { painter } from './style.ts'
import { lifted, marking } from './zones.ts'

test('a key dropped for room comes back in its place once a later drop leaves room for it', () => {
  const bar = {
    badge: 'EDIT',
    keys: [
      ['↑↓', 'slot'],
      ['enter', 'tune'],
      ['←→', 'normal or bright'],
      ['l', 'link'],
      ['s', 'save'],
    ] as [string, string][],
    right: ['esc', 'cancel'] as [string, string],
    keep: ['s'],
  }

  const line = barLine(painter(false), bar, 60)
  assert.match(line, /↑↓ slot {3}enter tune {3}l link {3}s save/)
  assert.doesNotMatch(line, /normal or bright/)
  assert.match(line, /esc cancel$/)
})

test('a question gives up its long lead, its other keys and then its badge before an answer is cut', () => {
  const bar = {
    badge: 'BROWSE',
    lead: 'Apply 12 changes before you leave?',
    short: 'Apply 12?',
    keys: [
      ['y', 'apply'],
      ['n', 'discard'],
    ] as [string, string][],
    right: ['esc', 'stay'] as [string, string],
    keep: ['y', 'n'],
  }

  const line = (width: number) => barLine(painter(false), bar, width)
  assert.match(line(80), /^\[BROWSE\] Apply 12 changes before you leave\? {3}y apply {3}n discard +esc stay$/)
  assert.match(line(60), /^\[BROWSE\] Apply 12\? {3}y apply {3}n discard +esc stay$/)
  assert.equal(line(42), '[BROWSE] Apply 12?   y apply   n discard')
  assert.equal(line(39), 'Apply 12?   y apply   n discard')
})

function shellFunction(file: string, name: string): string {
  const text = readFileSync(join(ROOT, 'shell', file), 'utf8')
  const found = new RegExp(`^${name}\\(\\) \\{\\n[\\s\\S]*?\\n\\}$`, 'm').exec(text)
  assert.ok(found, `${name} in shell/${file}`)

  return found[0]
}

interface Held {
  badge: string
  pre?: string
  lead?: string
  note?: string
  keys: [string, string][]
  right?: [string, string]
  standing?: ReleaseLine
}

interface Drawn {
  out: string
  zones: string[]
}

function previewBars(bars: readonly Held[], ends: readonly number[]): Drawn[] {
  const layer = readFileSync(join(ROOT, 'shell', 'ttheme.zsh'), 'utf8')

  const script = [
    /^typeset -gA TTHEME_KEYCAPS=\([\s\S]*?^\)$/m.exec(layer)?.[0] ?? '',
    /^typeset -ga TTHEME_KEYMODS=\(.*\)$/m.exec(layer)?.[0] ?? '',
    'typeset -gA TTHEME_SGR=(reset "")',
    ...['__tt_caps', '__tt_chord', '__tt_cap', '__tt_clip'].map((name) => shellFunction('ttheme.zsh', name)),
    shellFunction('preview.zsh', '__tt_pv_barfit'),
    shellFunction('preview.zsh', '__tt_pv_barline'),
    'typeset -i color=0 ph=1',
    'typeset mhov= pick= on= b= d= z= hl= hx=',
    'typeset -a plabel=() pvz=()',
    'one() {',
    '  local out="" badge=$2 pre=$3 lead=$4 note=$5 right=$6 rk=$7 ver=$8',
    '  local -i end=$1 bw=$(( $1 - 1 )) vnew=$9 count=${10}',
    '  local -a kk=() kl=() pvz=()',
    '  shift 10',
    '  while (( count-- > 0 )); do kk+=("$1") kl+=("$2"); shift 2; done',
    '  __tt_pv_barline',
    '  print -r -- "$out"',
    '  print -r -- "${(pj:\\x1e:)pvz}"',
    '}',
    'while (( $# )); do',
    '  one "${(@)@[1,10 + 2 * ${10}]}"',
    '  shift $(( 10 + 2 * ${10} ))',
    'done',
  ]

  const args = bars.flatMap((bar) =>
    ends.flatMap((end) => [
      String(end),
      bar.badge,
      bar.pre ?? '',
      bar.lead ?? '',
      bar.note ?? '',
      bar.right ? bar.right.join(' ') : '',
      bar.right?.[0] ?? '',
      bar.standing ? `${bar.standing.standing === 'newer' ? 'alt+u update   ' : ''}${bar.standing.line}` : '',
      bar.standing?.standing === 'newer' ? '1' : '0',
      String(bar.keys.length),
      ...bar.keys.flat(),
    ]),
  )

  const ran = spawnSync('zsh', ['-f', '-c', script.join('\n'), '--', ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, LC_ALL: 'C.UTF-8', TTHEME_KEYS: 'text' },
  })

  assert.equal(ran.status, 0, ran.stderr)
  const printed = ran.stdout.replace(/\n$/, '').split('\n')

  return Array.from({ length: printed.length / 2 }, (_, i) => ({
    out: printed[2 * i] as string,
    zones: (printed[2 * i + 1] as string).split('\x1e').filter(Boolean),
  }))
}

function onCells(out: string): string[] {
  const line: string[] = []
  const pieces = out.split('\x1b[')
  let at = 0

  pieces.forEach((piece, n) => {
    const move = n === 0 ? undefined : /^(\d*)([KG])/.exec(piece)

    if (move?.[2] === 'G') {
      at = Number(move[1]) - 1
    } else if (move?.[2] === 'K') {
      line.length = Math.min(line.length, at)
    }

    for (const ch of piece.slice(move?.[0].length ?? 0)) {
      line[at] = ch

      for (let i = 1; i < cells(ch); i++) {
        line[at + i] = ''
      }

      at += cells(ch)
    }
  })

  return Array.from(line, (cell) => cell ?? ' ')
}

function onLine(out: string): string {
  return onCells(out).join('').trimEnd()
}

function nodeDrawn(bar: Held, end: number) {
  useCaps('text')

  const { drawn, targets } = marking(() =>
    barLine(
      painter(false),
      {
        badge: bar.badge,
        keys: bar.keys,
        ...(bar.lead ? { lead: `${bar.pre ?? ''}${bar.lead}` } : {}),
        ...(bar.pre ? { short: bar.lead } : {}),
        ...(bar.note ? { note: bar.note } : {}),
        ...(bar.right ? { right: bar.right } : {}),
        ...(bar.standing ? { standing: bar.standing } : {}),
      },
      end - 1,
    ),
  )

  const { lines, zones } = lifted([drawn], targets)

  return { line: ` ${lines[0] ?? ''}`.trimEnd(), zones }
}

function nodeBar(bar: Held, end: number): string {
  return nodeDrawn(bar, end).line
}

function badged(bar: Held, line: string): boolean {
  return !bar.pre || line.startsWith(` [${bar.badge}]`)
}

const BARS: Held[] = [
  {
    badge: 'LIST',
    keys: [
      ['↑↓', 'move'],
      ['enter', 'open'],
      ['x', 'remove'],
      ['tab', 'the next thing'],
      ['?', 'keys'],
    ],
    right: ['esc', 'back'],
  },
  {
    badge: 'FORM',
    keys: [
      ['a', 'add'],
      ['enter', 'save'],
      ['d', 'delete'],
      ['z', 'undo the last one'],
    ],
    right: ['esc', 'cancel'],
  },
  {
    badge: 'PICK',
    note: 'three of nine picked',
    keys: [
      ['space', 'pick'],
      ['r', 'reset'],
      ['?', 'keys'],
    ],
    right: ['esc', 'close'],
  },
  {
    badge: 'ASK',
    pre: 'kai@dust/dusk → ',
    lead: 'here  there  everywhere',
    note: 'Until this tab closes',
    keys: [
      ['←→', 'choose'],
      ['enter', 'confirm'],
    ],
    right: ['esc', 'back'],
  },
  {
    badge: 'HUB',
    keys: [
      ['enter', 'use'],
      ['→', 'edit'],
      ['tab', 'sample'],
      ['?', 'keys'],
    ],
    right: ['esc', 'cancel'],
    standing: { standing: 'newer', line: '⇡ v1.2.4' },
  },
  {
    badge: 'HUB',
    keys: [
      ['enter', 'use'],
      ['→', 'edit'],
      ['?', 'keys'],
    ],
    right: ['esc', 'cancel'],
    standing: { standing: 'unknown', line: 'v1.2.3' },
  },
  {
    badge: '見本',
    keys: [
      ['enter', '使う'],
      ['tab', '見本を開く'],
      ['s', '保存'],
      ['?', 'キー'],
    ],
    right: ['esc', '戻る'],
  },
  {
    badge: 'EDIT',
    keys: [
      ['↑↓', 'move'],
      ['←→', 'change'],
      ['s', 'save'],
      ['f', 'find'],
      ['1-9', 'place'],
      ['c', 'colors'],
      ['=', 'reset'],
      ['+', 'reset all'],
      ['space', 'show'],
      ['D', 'remove'],
      ['shift+enter', 'apply'],
      ['?', 'keys'],
    ],
    right: ['esc', 'cancel'],
  },
  { badge: 'BARE', keys: [] },
]

const ENDS = Array.from({ length: 149 }, (_, i) => 150 - i)

test('preview fits its key bar as the Node screens fit theirs, at every width', () => {
  const got = previewBars(BARS, ENDS)
  assert.equal(got.length, BARS.length * ENDS.length)

  BARS.forEach((bar, at) => {
    ENDS.forEach((end, i) => {
      const node = nodeBar(bar, end)

      if (badged(bar, node)) {
        assert.equal(onLine((got[at * ENDS.length + i] as Drawn).out), node, `${bar.badge} at ${end} columns`)
      }
    })
  })
})

test('preview keeps its badge where a Node question gives its own up', () => {
  const asking = BARS.filter((bar) => bar.pre)
  const got = previewBars(asking, ENDS)
  let gaveUp = 0

  asking.forEach((bar, at) => {
    ENDS.forEach((end, i) => {
      if (!badged(bar, nodeBar(bar, end)) && end > bar.badge.length + 4) {
        gaveUp++
        assert.ok(
          onLine((got[at * ENDS.length + i] as Drawn).out).startsWith(` [${bar.badge}]`),
          `${bar.badge} at ${end} columns`,
        )
      }
    })
  })

  assert.ok(gaveUp > 0)
})

test("preview's click zones sit on the keys its bar shows, where the Node screens put theirs", () => {
  const got = previewBars(BARS, ENDS)

  BARS.forEach((bar, at) => {
    const hints = new Map(
      [...bar.keys, ...(bar.right ? [bar.right] : [])].map(([key, label]) => [key, `${key} ${label}`]),
    )

    ENDS.forEach((end, i) => {
      const { out, zones } = got[at * ENDS.length + i] as Drawn
      const node = nodeDrawn(bar, end)

      if (node.line.endsWith('…') || !badged(bar, node.line)) {
        return
      }

      const shown = onCells(out)
      const spans = new Set<string>()

      for (const zone of zones) {
        const [, from, to, , key] = zone.split(' ')

        if (key === 'alt+u') {
          continue
        }

        spans.add(`${from} ${to}`)
        assert.equal(
          shown.slice(Number(from) - 1, Number(to)).join(''),
          hints.get(key as string),
          `${bar.badge} at ${end} columns: the zone of ${key}`,
        )
      }

      const drawn = onCells(node.line)
      const texts = new Set(hints.values())

      for (const zone of node.zones) {
        const from = zone.col + 2
        const to = zone.col + zone.width + 1
        const text = drawn.slice(from - 1, to).join('')

        if (texts.has(text)) {
          assert.ok(spans.has(`${from} ${to}`), `${bar.badge} at ${end} columns: a zone over ${text}`)
        }
      }
    })
  })
})
