import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { type PictureSize, resized, stripShown, TUNE } from '../../core/picture-panel.ts'
import { ROOT } from '../../root.ts'
import { drawnFrameSpinner, drawnPictureStrip, drawnTuneRows } from '../../tui/find/screen.ts'
import { MARKS } from '../../tui/style.ts'
import { panelTables } from '../emit-shell.ts'

const BG = readFileSync(join(ROOT, 'shell', 'adapters', '_bg.zsh'), 'utf8')
const ROWS = 12
const COLS = 100
const R0 = 2
const COL = 10
const UNTUNED = { size: 'fill' as const, at: 3, opacity: 0.18 }
const ESC = String.fromCharCode(27)
const BEL = String.fromCharCode(7)

const TOKEN = new RegExp(
  `${ESC}\\[(?<params>[0-9;:?]*)(?<final>[A-Za-z])|${ESC}\\]8;[^${BEL}${ESC}]*(?:${BEL}|${ESC}\\\\)|(?<glyph>[^${ESC}])`,
  'gu',
)

const PICTURE = new RegExp(`${ESC}_G[^${ESC}]*${ESC}\\\\`, 'g')
const LIT = new RegExp(`${ESC}\\[1m(?:${ESC}\\[[0-9;]*m)*(?=\\P{Cc}).`, 'gu')

const SHELL_FIELD = new Map<number | undefined, number>([
  [undefined, 0],
  [TUNE.size, 1],
  [TUNE.position, 2],
  [TUNE.opacity, 3],
  [TUNE.colors, 4],
])

function shellFunction(name: string): string {
  const found = new RegExp(`^${name}\\(\\) \\{\\n[\\s\\S]*?\\n\\}$`, 'm').exec(BG)
  assert.ok(found, name)

  return found[0]
}

function cellsOf(drawn: string): string[] {
  const grid = Array.from({ length: ROWS }, () => Array<string>(COLS).fill(' '))
  let row = 0
  let col = 0

  for (const token of drawn.matchAll(TOKEN)) {
    const { params, final, glyph } = token.groups as { params?: string; final?: string; glyph?: string }

    if (glyph !== undefined) {
      const at = grid[row]

      if (at && col < COLS) {
        at[col] = glyph
      }

      col++
    } else if (final === 'H') {
      const [r = '1', c = '1'] = (params ?? '').split(';')
      row = Number(r) - 1
      col = Number(c) - 1
    } else if (final === 'G') {
      col = Number(params) - 1
    }
  }

  return grid.map((cells) => cells.join('').trimEnd())
}

function shellScript(body: string[]): string {
  return [
    `typeset -gA TTHEME_MARKS=(${Object.entries(MARKS)
      .map(([key, glyph]) => `${key} ${glyph}`)
      .join(' ')})`,
    'typeset -gA TTHEME_SGR=(reset "" bold "" dim "" chip "" /chip "")',
    'typeset -gi TTHEME_PALETTES_IN=1 tf FS',
    /^typeset -ga TTHEME_BG_POSITIONS=.*$/m.exec(BG)?.[0] ?? '',
    ...panelTables(),
    'typeset -gA bgoff bgpos bgsize bgop bgdef bgcolors bgact',
    'typeset -ga pvz',
    'typeset -g out color=1 mhov="" ac="" pl=""',
    '__tt_palettes() { : }',
    '__tt_pv_bg_fs() { REPLY=$FS; (( FS > 0 )) }',
    shellFunction('__tt_bg_coloring'),
    shellFunction('__tt_pv_bg_tuned'),
    shellFunction('__tt_pv_bg_panel'),
    shellFunction('__tt_bg_resized'),
    ...body,
  ].join('\n')
}

function runShell(script: string, args: string[]): string {
  const shell = spawnSync('zsh', ['-f', '-c', script, '--', ...args], {
    encoding: 'utf8',
    env: { ...process.env, LC_ALL: 'C.UTF-8' },
    maxBuffer: 2 ** 26,
  })

  assert.equal(shell.status, 0, shell.stderr)

  return shell.stdout
}

test("preview's picture rows draw what find's do", () => {
  const states = [41, 61].flatMap((end) =>
    (['fill', 20, 73, 140] as PictureSize[]).flatMap((size) =>
      [1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap((at) =>
        ['0.00', '0.18', '1.00'].flatMap((opacity) =>
          (['original', 'tone'] as const).flatMap((coloring) =>
            [undefined, TUNE.colors, TUNE.size, TUNE.position, TUNE.opacity].flatMap((field) =>
              [0, 120].map((fill) => ({ end, size, at, opacity, coloring, field, fill })),
            ),
          ),
        ),
      ),
    ),
  )

  const script = shellScript([
    'bgoff[p]=0 bgact[p]=k bgdef[p]="fill 3 0.18"',
    'while (( $# )); do',
    '  bgsize[p]=$1 bgpos[p]=$2 bgop[p]=$3 bgcolors[p:k]=$4 tf=$5 FS=$6 out=""',
    '  __tt_pv_bg_panel p $7 $8 $9',
    '  print -rn -- "$out"$\'\\x1e\'',
    '  shift 9',
    'done',
  ])

  const drawn = runShell(
    script,
    states.flatMap(({ end, size, at, opacity, coloring, field, fill }) => [
      String(size),
      String(at),
      opacity,
      coloring,
      String(SHELL_FIELD.get(field)),
      String(fill),
      String(R0 + 1),
      String(COL + 1),
      String(end + 1),
    ]),
  ).split('\x1e')

  states.forEach(({ end, size, at, opacity, coloring, field, fill }, i) => {
    const rows = drawnTuneRows(
      {
        tune: { size, at, opacity: Number(opacity) },
        untuned: UNTUNED,
        coloring,
        fill,
        ...(field === undefined ? {} : { tuning: { field } }),
      },
      COLS,
      ROWS,
      R0,
      COL,
      end,
    )

    assert.deepEqual(
      cellsOf(drawn[i] as string),
      cellsOf(rows.map((row, at) => `\x1b[${at + 1};1H${row}`).join('')),
      JSON.stringify(states[i]),
    )
  })
})

test("preview's strip of pictures frames what find's does", () => {
  const states = [4, 7, 11, 16].flatMap((thumb) =>
    [40, 50, 60].flatMap((end) =>
      Array.from({ length: 8 }, (_, n) => n + 1).flatMap((count) =>
        Array.from({ length: count }, (_, focus) => ({ thumb, end, count, focus })).filter(({ focus }) => {
          const show = stripShown(count, thumb, end - COL)
          const first = focus - Math.floor(show / 2)

          return count <= show || (first >= 0 && first + show <= count)
        }),
      ),
    ),
  )

  const script = shellScript([
    'typeset -gA bgpics bgpic bgdim bgthumb',
    'typeset -gi bgcw=1 bgch=1 ph=60',
    'typeset -g TTHEME_CONFIG=/x/config',
    '__tt_bg_dim() { : }',
    '__tt_pv_bg_strip_off() { : }',
    shellFunction('__tt_pv_bg_strip'),
    'while (( $# )); do',
    '  bgdim[/x/backgrounds/f]="$1 3"',
    '  bgpics[p]=""',
    '  for (( i = 1; i <= $2; i++ )); do bgpics[p]+="k$i "; bgpic[p:k$i]="s f"; done',
    '  __tt_pv_bg_strip $4 $5 $6 p p:k$3',
    "  print -rn -- $'\\x1e'",
    '  shift 6',
    'done',
  ])

  const drawn = runShell(
    script,
    states.flatMap(({ thumb, end, count, focus }) => [
      String(thumb),
      String(count),
      String(focus + 1),
      String(R0 + 1),
      String(COL + 1),
      String(end + 1),
    ]),
  ).split('\x1e')

  states.forEach(({ thumb, end, count, focus }, i) => {
    const rows = drawnPictureStrip(count, focus, thumb, COLS, ROWS, R0, COL, end)

    assert.deepEqual(
      cellsOf((drawn[i] as string).replace(PICTURE, '')),
      cellsOf(rows.map((row, at) => `\x1b[${at + 1};1H${row}`).join('')),
      JSON.stringify(states[i]),
    )
  })
})

test("preview's spinner lights the frame where find's does", () => {
  const states = [4, 7, 11, 16].flatMap((thumb) => Array.from({ length: 30 }, (_, tick) => ({ thumb, tick })))

  const script = shellScript([
    "TTHEME_SGR[bold]=$'\\e[1m' TTHEME_SGR[dim]=$'\\e[2m' TTHEME_SGR[accent]=$'\\e[36m'",
    'typeset -g bgframe',
    shellFunction('__tt_pv_bg_orbit'),
    'while (( $# )); do',
    '  bgframe="$3 $4 $1"',
    '  __tt_pv_bg_orbit $2',
    "  print -rn -- $'\\x1e'",
    '  shift 4',
    'done',
  ])

  const drawn = runShell(
    script,
    states.flatMap(({ thumb, tick }) => [String(thumb), String(tick), String(R0 + 1), String(COL + 1)]),
  ).split('\x1e')

  const lit = (text: string): string[] => cellsOf(text.replace(LIT, '@'))

  states.forEach(({ thumb, tick }, i) => {
    const rows = drawnFrameSpinner(thumb, tick, COLS, ROWS, R0, COL)

    assert.deepEqual(
      lit(drawn[i] as string),
      lit(rows.map((row, at) => `\x1b[${at + 1};1H${row}`).join('')),
      JSON.stringify(states[i]),
    )
  })
})

test("preview's size steps land where find's do", () => {
  const cases = (['fill', 20, 21, 73, 100, 119, 140] as PictureSize[]).flatMap((size) =>
    [-10, -1, 1, 10].flatMap((step) => [0, 100, 120, 350].map((fill) => ({ size, step, fill }))),
  )

  const script = shellScript([
    'local REPLY',
    'while (( $# )); do',
    '  if __tt_bg_resized $1 $2 $3; then print -r -- $REPLY; else print -r -- $1; fi',
    '  shift 3',
    'done',
  ])

  const got = runShell(
    script,
    cases.flatMap(({ size, step, fill }) => [String(size), String(step), String(fill)]),
  )
    .trimEnd()
    .split('\n')

  cases.forEach(({ size, step, fill }, i) => {
    assert.equal(got[i], String(resized(size, step, fill)), `${size} ${step} ${fill}`)
  })
})
