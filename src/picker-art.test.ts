import assert from 'node:assert/strict'
import { test } from 'node:test'
import { drawEditor } from './editor-screen.ts'
import { PaletteEditor } from './palette-editor.ts'
import { PickerLayer } from './picker-art.ts'
import { grow, SEEDS } from './seeds.ts'

const sent = (out: string) => [...out.matchAll(/a=t,f=100,i=(\d+)/g)].map((m) => Number(m[1]))
const placed = (out: string) => [...out.matchAll(/a=p,i=(\d+)/g)].map((m) => Number(m[1]))
const released = (out: string) => [...out.matchAll(/a=d,d=I,i=(\d+)/g)].map((m) => Number(m[1]))

test('the picker layer sends a picture only when it changes, under a spare id, and lets go of the old one after', () => {
  const e = new PaletteEditor({
    title: 'Edit palette',
    name: 'kec@dust/dusk',
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
  for (const key of ['down', 'down', 'down', 'down', 'down', 'enter']) {
    e.press(key)
  }
  const first = layer.draw(art())
  assert.equal(sent(first).length, 7)
  assert.deepEqual(placed(first), sent(first))
  assert.equal(layer.draw(art()), '')
  e.press('up')
  const step = layer.draw(art())
  assert.ok(sent(step).length > 0 && sent(step).length < 7)
  assert.equal(released(step).length, sent(step).length)
  assert.ok(sent(step).every((id) => !sent(first).includes(id)))
  assert.ok(released(step).every((id) => sent(first).includes(id)))
  const shown = [...sent(first).filter((id) => !released(step).includes(id)), ...sent(step)]
  e.press('enter')
  assert.equal(art(), undefined)
  assert.deepEqual(released(layer.draw(art())).sort(), shown.sort())
  assert.equal(layer.draw(art()), '')
})

test('a terminal with no layers under its cells keeps the text picker', () => {
  assert.equal(PickerLayer.of({ WEZTERM_PANE: '1' }, ['wezterm']), undefined)
  assert.equal(PickerLayer.of({ TERM_PROGRAM: 'ghostty', TMUX: '/tmp/x' }, ['ghostty']), undefined)
  assert.equal(PickerLayer.of({ TERM_PROGRAM: 'ghostty', NO_COLOR: '1' }, ['ghostty']), undefined)
})
