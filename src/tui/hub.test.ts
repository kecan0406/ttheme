import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { ROOT } from '../root.ts'
import { HUB_TABS, hubBar } from './hub.ts'
import { useCaps } from './keycaps.ts'
import { lifted, marking } from './zones.ts'

function shellFunction(file: string, name: string): string {
  const text = readFileSync(join(ROOT, 'shell', file), 'utf8')
  const found = new RegExp(`^${name}\\(\\) \\{\\n[\\s\\S]*?\\n\\}$`, 'm').exec(text)
  assert.ok(found, `${name} in shell/${file}`)

  return found[0]
}

const layer = readFileSync(join(ROOT, 'shell', 'ttheme.zsh'), 'utf8')

interface Drawn {
  line: string
  zones: string[]
}

function shellBars(widths: number[]): Drawn[] {
  const script = [
    /^typeset -gA TTHEME_KEYCAPS=\([\s\S]*?^\)$/m.exec(layer)?.[0] ?? '',
    /^typeset -ga TTHEME_KEYMODS=\(.*\)$/m.exec(layer)?.[0] ?? '',
    `typeset -ga TTHEME_HUB_TABS=(${HUB_TABS.map((tab) => tab.name).join(' ')})`,
    `typeset -ga TTHEME_HUB_TITLES=(${HUB_TABS.map((tab) => tab.title).join(' ')})`,
    'typeset -gA TTHEME_SGR=(reset "" dim "" bold "" chip "" /chip "" /fg "" /bold "" /accent "")',
    'typeset -gA TTHEME_MARK_INKS=()',
    'TTHEME_PALETTES_IN=1',
    shellFunction('ttheme.zsh', '__tt_caps'),
    shellFunction('ttheme.zsh', '__tt_chord'),
    shellFunction('ttheme.zsh', '__tt_cap'),
    shellFunction('ttheme.zsh', '__tt_capped'),
    shellFunction('preview.zsh', '__tt_pv_bar'),
    'local -i color=0 cur=1 mhp=0',
    'local -a rtype=(row) pvz',
    'local applied= mhov= pl= ac=',
    'for width in "$@"; do',
    '  pvz=()',
    '  __tt_pv_bar $width',
    '  print -r -- "$REPLY"',
    '  print -r -- "${(pj:\\x1e:)pvz}"',
    'done',
  ].join('\n')

  const ran = spawnSync('zsh', ['-f', '-c', script, '--', ...widths.map(String)], {
    encoding: 'utf8',
    env: { ...process.env, LC_ALL: 'C.UTF-8', TTHEME_KEYS: 'text' },
  })

  assert.equal(ran.status, 0, ran.stderr)
  const out = ran.stdout.replace(/\n$/, '').split('\n')

  return widths.map((_, i) => ({
    line: out[2 * i] ?? '',
    zones: (out[2 * i + 1] ?? '').split('\x1e').filter(Boolean),
  }))
}

interface Spot {
  kind: string
  tab?: string
}

function nodeBar() {
  useCaps('text')
  const { drawn, targets } = marking(() => hubBar('preview', false))
  const { lines, zones } = lifted([drawn], targets)

  const spans = zones.map((zone) => {
    const target = zone.target as Spot
    const what = target.kind === 'hub' ? `hub ${HUB_TABS.findIndex((tab) => tab.name === target.tab) + 1}` : 'key tab'

    return `${zone.row + 1} ${zone.col + 1} ${zone.col + zone.width} ${what}`
  })

  return { line: lines[0] ?? '', spans }
}

test('preview draws the hub bar as the Node screens do', () => {
  const [shell] = shellBars([80])
  assert.equal(shell?.line, nodeBar().line)
})

test("preview's click zones for the hub bar cover the cells the Node ones do", () => {
  const [shell] = shellBars([80])
  assert.deepEqual(shell?.zones, nodeBar().spans)
})

test('preview leaves the hub bar hint off when the window is too narrow for it', () => {
  const node = nodeBar()
  const tabs = node.line.replace(/ {2}tab \w+$/, '')
  const [fits, tight, narrow] = shellBars([node.line.length, node.line.length - 1, 10])

  assert.equal(fits?.line, node.line)
  assert.equal(tight?.line, tabs)
  assert.equal(narrow?.line, tabs)
  assert.deepEqual(
    tight?.zones,
    node.spans.filter((span) => span.endsWith(' key tab') === false),
  )
})
