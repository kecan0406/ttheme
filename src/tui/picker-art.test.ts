import assert from 'node:assert/strict'
import { test } from 'node:test'
import { grow, SEEDS } from '../core/seeds.ts'
import { pieces } from './ansi.ts'
import { drawEditor } from './editor-screen.ts'
import { PaletteEditor } from './palette-editor.ts'
import { type Chart, type Drawn, PickerLayer } from './picker-art.ts'
import { MARKS } from './style.ts'

const sent = (out: string) => [...out.matchAll(/a=t,f=100,i=(\d+)/g)].map((m) => Number(m[1]))
const placed = (out: string) => [...out.matchAll(/a=p,i=(\d+)/g)].map((m) => Number(m[1]))
const released = (out: string) => [...out.matchAll(/a=d,d=I,i=(\d+)/g)].map((m) => Number(m[1]))

test('the picker layer sends a picture only when it changes, under a spare id, and lets go of the old one after', () => {
  const e = new PaletteEditor({
    title: 'Edit palette',
    name: 'kai@dust/dusk',
    colors: grow(SEEDS),
    signature: ['background', 'foreground', 'cursor'],
    check: () => undefined,
  })

  e.viewport(140, 40)
  const layer = PickerLayer.of({ TERM_PROGRAM: 'ghostty' }, ['ghostty'])
  assert.ok(layer)
  const art = () => drawEditor(e, 140, 40, true, { art: true }).art
  assert.equal(art(), undefined)
  assert.equal(layer.draw(undefined), '')
  layer.measured({ w: 8, h: 16 })

  for (const key of ['down', 'down', 'down', 'down', 'down', 'enter', 'up']) {
    e.press(key)
  }

  const first = layer.draw(art())
  assert.equal(sent(first).length, 10)
  assert.deepEqual(placed(first), sent(first))
  assert.equal(layer.draw(art()), '')
  e.press('up')
  const step = layer.draw(art())
  assert.ok(sent(step).length > 0 && sent(step).length < 10)
  assert.equal(released(step).length, sent(step).length)
  assert.ok(sent(step).every((id) => !sent(first).includes(id)))
  assert.ok(released(step).every((id) => sent(first).includes(id)))
  const shown = [...sent(first).filter((id) => !released(step).includes(id)), ...sent(step)]
  e.press('enter')
  assert.equal(art(), undefined)
  assert.deepEqual(released(layer.draw(art())).sort(), shown.sort())
  assert.equal(layer.draw(art()), '')
})

function plotOf(line: string, from: number, to: number): string {
  let col = 0
  let out = ''

  for (const piece of pieces(line)) {
    if (!piece.sequence) {
      out += col >= from && col < to ? piece.text : ''
      col += piece.width
    }
  }

  return out
}

test('the relations charts go out as pictures over blank cells, again only when they change, and go with the view', () => {
  const e = new PaletteEditor({
    title: 'Edit palette',
    name: 'kai@dust/dusk',
    colors: grow(SEEDS),
    signature: ['background', 'foreground', 'cursor'],
    check: () => undefined,
  })

  const layer = PickerLayer.of({ TERM_PROGRAM: 'ghostty' }, ['ghostty'])
  assert.ok(layer)
  layer.measured({ w: 8, h: 16 })
  const seeded = grow(SEEDS)
  const chrome = [seeded.background, seeded.foreground, seeded.cursor, seeded.selection, ...seeded.ansi]
  const frame = (art: boolean) => drawEditor(e, 140, 40, true, { art, chrome })

  const plots = (drawn: Drawn, charts: Chart[]) =>
    charts.flatMap((c) =>
      Array.from({ length: c.box.rows }, (_, r) =>
        plotOf(drawn.lines[c.box.row + r] as string, c.box.col, c.box.col + c.box.cols),
      ),
    )

  e.press('g')
  const drawn = frame(true)
  const charts = drawn.charts ?? []
  assert.deepEqual(
    charts.map((c) => c.name),
    ['lightness', 'chroma', 'hue'],
  )
  assert.ok(plots(drawn, charts).every((cells) => cells.trim() === ''))
  assert.equal(frame(false).charts, undefined)
  assert.ok(plots(frame(false), charts).join('').includes(MARKS.off))

  const first = layer.draw(undefined, undefined, charts)
  assert.equal(sent(first).length, 6)
  assert.equal(layer.draw(undefined, undefined, frame(true).charts), '')

  for (const key of ['down', 'down', 'down', 'down']) {
    e.press(key)
  }

  const lit = layer.draw(undefined, undefined, frame(true).charts)
  assert.equal(sent(lit).length, 2)
  assert.equal(released(lit).length, 0)
  e.press('down')
  const along = layer.draw(undefined, undefined, frame(true).charts)
  assert.equal(sent(along).length, 0)
  assert.equal(placed(along).length, 2)
  e.press('g')
  assert.equal(frame(true).charts, undefined)
  assert.equal(released(layer.draw(undefined, undefined, frame(true).charts)).length, 8)
})

test('a terminal with no layers under its cells keeps the text picker', () => {
  assert.equal(PickerLayer.of({ WEZTERM_PANE: '1' }, ['wezterm']), undefined)
  assert.equal(PickerLayer.of({ TERM_PROGRAM: 'ghostty', TMUX: '/tmp/x' }, ['ghostty']), undefined)
  assert.equal(PickerLayer.of({ TERM_PROGRAM: 'ghostty', NO_COLOR: '1' }, ['ghostty']), undefined)
})
