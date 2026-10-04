import assert from 'node:assert/strict'
import { test } from 'node:test'
import { oklch, rgb } from './color.ts'
import { renderEditor } from './editor-screen.ts'
import { CONTRAST, type EditorOptions, listOf, PaletteEditor, parseColor } from './palette-editor.ts'
import { type Colors, grow, SEEDS } from './seeds.ts'

const start: Colors = grow(SEEDS)
const other: Colors = grow({ ...SEEDS, hue: 20, background: 0.15 })

function editor(opts: Partial<EditorOptions> = {}): PaletteEditor {
  return new PaletteEditor({
    title: 'Edit palette',
    name: 'kec@dust/dusk',
    colors: start,
    signature: ['background', 'foreground', 'cursor'],
    palettes: [{ name: 'kec@dust/dawn', colors: other }],
    check: () => undefined,
    ...opts,
  })
}

function press(e: PaletteEditor, ...keys: string[]): PaletteEditor {
  for (const key of keys) {
    e.press(key)
  }
  return e
}

function screen(e: PaletteEditor, cols = 95, rows = 30): string {
  return renderEditor(e, cols, rows, false).join('\n')
}

const RED = ['down', 'down', 'down', 'down', 'down']

test('new starts on the seeds, enter leaves them for the slots for good, and s saves', () => {
  const e = editor({ title: 'New palette', colors: undefined })
  assert.match(screen(e), /\[EDIT \(SEEDS\)\]/)
  press(e, 'down', 'right', 'enter')
  assert.equal(e.mode, 'list')
  assert.deepEqual(e.colors(), grow({ ...SEEDS, foreground: 0.89 }))
  press(e, 'enter')
  assert.equal(e.mode, 'tune')
  press(e, 'esc', 's')
  assert.equal(e.mode, 'list')
  assert.equal(e.result, 'saved')
})

test('edit opens on the slots and no key takes it back to the seeds', () => {
  const e = press(editor(), 'right', 'g', 'right')
  assert.equal(e.mode, 'list')
  assert.deepEqual(e.colors(), start)
  press(e, 's')
  assert.equal(e.result, 'saved')
})

test('tab tunes a slot and the bright linked to it, enter keeps them, and u takes the whole tune back', () => {
  const e = press(editor(), ...RED, 'tab', 'shift-right', 'shift-right', '.', 'enter')
  const changed = listOf(e.colors()).flatMap((c, i) => (c === listOf(start)[i] ? [] : [i]))
  assert.deepEqual(changed, [5, 13])
  assert.equal(Math.round(e.lch[5]?.h ?? 0), Math.round(oklch(start.ansi[1] as string).h) + 11)
  assert.equal(Math.round(e.lch[13]?.h ?? 0), Math.round(oklch(start.ansi[9] as string).h) + 11)
  press(e, 'u')
  assert.deepEqual(e.colors(), start)
})

test('esc in tune puts the slot back as it was', () => {
  const e = press(editor(), ...RED, 'tab', '9', 'esc')
  assert.equal(e.mode, 'list')
  assert.deepEqual(e.colors(), start)
})

test('# takes hex, rgb() or oklch(), and a paste sets the focused slot', () => {
  assert.equal(parseColor('#F00'), '#ff0000')
  assert.equal(parseColor('rgb(0 128 255)'), '#0080ff')
  assert.match(parseColor('oklch(70% 0.1 250)') ?? '', /^#[0-9a-f]{6}$/)
  assert.equal(parseColor('red'), undefined)
  const e = press(editor(), ...RED, 'right', '#', ...'ff0000', 'enter')
  assert.equal(e.colors().ansi[9], '#ff0000')
  e.paste('rgb(0 0 255)')
  assert.equal(e.colors().ansi[9], '#0000ff')
})

test('c and v copy a slot, = makes the bright follow its normal, r puts a slot back', () => {
  const e = press(editor(), ...RED, 'c', 'right', 'v')
  assert.equal(e.colors().ansi[9], start.ansi[1])
  press(e, 'r')
  assert.equal(e.colors().ansi[9], start.ansi[9])
  press(e, 'left', 'tab', 'shift-right', '5', 'enter', '=')
  assert.equal(e.col, 1)
  assert.ok(Math.abs((e.lch[13]?.h ?? 0) - (e.lch[5]?.h ?? 0)) < 1)
})

test('* marks a signature color, keeping the last three and saying which one went', () => {
  const e = press(editor(), ...RED, '*')
  assert.deepEqual(e.signature, ['foreground', 'cursor', 'ansi1'])
  assert.match(e.notice ?? '', /background dropped/)
  press(e, '*')
  assert.deepEqual(e.signature, ['foreground', 'cursor'])
  assert.match(e.notice ?? '', /needs three/)
})

test('o takes another palette’s colors, filtered by what is typed', () => {
  const e = press(editor(), 'o', 'd', 'a', 'w')
  assert.match(screen(e), /Take colors from {2}daw▏/)
  press(e, 'enter')
  assert.deepEqual(e.colors(), other)
  assert.match(e.notice ?? '', /kec@dust\/dawn/)
})

test('space shows the colors you started from without touching yours', () => {
  const e = press(editor(), ...RED, 'tab', '9', 'enter', ' ')
  assert.deepEqual(e.shown(), listOf(start))
  assert.notDeepEqual(e.colors(), start)
  assert.match(screen(e), /\[EDIT \(BEFORE\)\]/)
})

test('f moves the colors the gate misses', () => {
  const dim = { ...start, ansi: start.ansi.map((c, i) => (i === 1 ? '#301010' : c)) }
  const e = press(editor({ colors: dim }), 'f')
  assert.notEqual(e.colors().ansi[1], '#301010')
  assert.match(e.notice ?? '', /Moved \d+ colors? — passes the gate/)
})

test('esc asks before throwing changes away, and a palette that cannot be read is not saved', () => {
  const e = press(editor({ check: () => 'meta.signature slots must resolve to three different colors' }), 'tab', '9')
  press(e, 'enter', 's')
  assert.equal(e.result, undefined)
  assert.match(e.notice ?? '', /signature/)
  press(e, 'esc')
  assert.match(screen(e), /\[EDIT \(QUIT\)\] Discard changes\?/)
  press(e, 'n')
  assert.equal(e.result, undefined)
  press(e, 'esc', 'y')
  assert.equal(e.result, 'cancelled')
})

test('the screen fits 80×24 and says what it needs below that', () => {
  const lines = renderEditor(press(editor(), ...RED), 80, 24, true)
  assert.equal(lines.length, 24)
  assert.match(renderEditor(editor(), 70, 20, false).join('\n'), /Needs 80×24 — now 70×20/)
  const red = screen(press(editor(), ...RED))
  assert.match(red, /Red {2}ANSI 1/)
  assert.match(red, /Hue 19° · in red 19±25°/)
})

test('p, ctrl+v, an empty paste and a pasted path or link each ask find for a picture', () => {
  const find = async () => ({ count: 1 })
  assert.deepEqual(press(editor({ find }), 'p').wants, {})
  assert.deepEqual(press(editor({ find }), 'ctrl-v').wants, { start: { clipboard: true } })
  const empty = editor({ find })
  empty.paste('')
  assert.deepEqual(empty.wants, { start: { clipboard: true } })
  const link = editor({ find })
  link.paste('https://example.com/a.png')
  assert.deepEqual(link.wants, { start: { paste: 'https://example.com/a.png' } })
  const color = editor({ find })
  color.paste('#ff0000')
  assert.equal(color.wants, undefined)
  assert.equal(color.colors().background, '#ff0000')
  assert.match(press(editor(), 'p').notice ?? '', /Pictures need/)
})

test('a picture find added counts as a change, and esc says it goes too', () => {
  const e = editor({ find: async () => ({ count: 1 }), pictures: 0 })
  e.found({ count: 1, note: 'Background · kec@dust/dusk ← danbooru 1' })
  assert.equal(e.added, 1)
  assert.match(screen(e), /▣ 1 picture/)
  press(e, 'esc')
  assert.match(screen(e), /Discard changes and 1 picture\?/)
})

test('the footer keeps enter and s at 80 columns, and names the tune', () => {
  const e = editor()
  const foot = renderEditor(e, 80, 24, false).at(-1) ?? ''
  assert.match(foot, /^\[EDIT\] /)
  assert.match(foot, /enter tune/)
  assert.match(foot, /s save/)
  assert.match(renderEditor(press(e, 'tab'), 80, 24, false).at(-1) ?? '', /^\[EDIT \(TUNE\)\] /)
})

test('←→ on a base row leaves the column alone, and ↑↓ through the base rows keep it', () => {
  const e = press(editor(), 'right', 'down', 'down', 'down', 'down')
  assert.equal(e.slot(), 4)
  press(e, 'right', 'up', 'down')
  assert.equal(e.slot(), 12)
})

test('chroma stops at the sRGB edge, and what lightness took comes back only while the tune lasts', () => {
  const e = press(editor(), ...RED, 'tab', 'right', 'end')
  const top = e.lch[5]?.c ?? 0
  const red = e.colors().ansi[1]
  press(e, 'right')
  assert.equal(e.colors().ansi[1], red)
  assert.match(e.notice ?? '', /sRGB edge/)
  press(e, 'pgup', 'pgup', 'pgup', 'pgup')
  assert.ok((e.lch[5]?.c ?? 0) < top)
  assert.equal(e.held, top)
  assert.match(screen(e), /○/)
  press(e, 'pgdn', 'pgdn', 'pgdn', 'pgdn')
  assert.equal(e.lch[5]?.c, top)
  press(e, 'pgup', 'pgup', 'pgup', 'pgup', 'enter')
  const kept = e.lch[5]?.c ?? 0
  assert.equal(e.held, undefined)
  press(e, 'tab')
  for (let i = 0; i < 10; i++) {
    press(e, 'shift-right')
  }
  assert.ok((e.lch[5]?.c ?? 0) <= kept)
})

test('a grey slot takes its hue from the background, so chroma grows toward the palette', () => {
  const grey = { ...start, foreground: '#d0d0d0' }
  const e = press(editor({ colors: grey }), 'down', 'tab')
  for (let i = 0; i < 10; i++) {
    press(e, 'right')
  }
  const hue = oklch(start.background).h
  assert.ok(Math.abs((oklch(e.colors().foreground).h ?? 0) - hue) < 5)
  const flat = press(editor({ colors: grey }), 'down', 'tab', 'shift-right')
  assert.match(flat.notice ?? '', /grey shows no hue/)
})

test('✗ falls on every slot whose own checks miss, the background too', () => {
  const light = editor({ colors: { ...start, background: '#8a8f9a' } })
  assert.ok(light.misses().has(0))
  assert.ok(light.misses().has(1))
  const moved = editor({ colors: { ...start, ansi: start.ansi.map((c, i) => (i === 1 ? '#c08a2a' : c)) } })
  assert.ok(moved.misses().has(5))
  assert.ok(moved.misses().has(13))
})

const drifted = { ...start, ansi: start.ansi.map((c, i) => (i === 3 ? '#e4af75' : i === 11 ? '#e7df91' : c)) }

test('◐ moves lightness until the ratio changes: home goes to the floor, a digit to that ratio', () => {
  const e = press(editor(), ...RED, 'tab', 'tab')
  assert.equal(e.channel, CONTRAST)
  press(e, 'home')
  assert.ok(e.ratio() >= 3 && e.ratio() < 3.1)
  press(e, '7')
  assert.ok(e.ratio() >= 7 && e.ratio() < 7.1)
  press(e, 'end')
  assert.match(e.notice ?? '', /stops at/)
  assert.match(screen(e), /▸◐/)
})

test('a scope moves every slot in it by the same step, and esc puts them all back', () => {
  const e = press(editor({ colors: drifted }), ...RED, 'tab', 'a', 'a', 'a')
  assert.equal(e.scope, 'accents')
  assert.equal(e.scoped().length, 12)
  const before = listOf(e.colors())
  const lights = e.lch.map((o) => o.l)
  press(e, 'up')
  const moved = listOf(e.colors()).flatMap((c, i) => (c === before[i] ? [] : [i]))
  assert.deepEqual(moved, [5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 17, 18])
  assert.ok(Math.abs((e.lch[9]?.l ?? 0) - (lights[9] ?? 0) - 0.01) < 0.0001)
  press(e, 'esc')
  assert.deepEqual(listOf(e.colors()), before)
  assert.match(press(editor(), 'tab', 'a').notice ?? '', /base color moves alone/)
})

test('n and N walk the slots the gate misses, and each gate miss names its slots', () => {
  const e = press(editor({ colors: drifted }), 'n')
  assert.equal(e.slot(), 7)
  press(e, 'n')
  assert.equal(e.slot(), 15)
  press(e, 'N')
  assert.equal(e.slot(), 7)
  assert.match(screen(e), /Yellow · Bright yellow/)
  assert.match(press(editor(), 'n').notice ?? '', /gate passes/)
})

test('g shows every ANSI color’s lightness, chroma and hue beside the slots', () => {
  const e = press(editor({ colors: drifted }), 'g')
  assert.equal(e.view, 'relations')
  const shown = screen(e)
  assert.match(shown, /Lightness/)
  assert.match(shown, /Chroma/)
  assert.match(shown, /Yellow 68° → bright 103°/)
})

test('a bright follows its normal until it is tuned on its own, and l links it again', () => {
  const e = press(editor(), ...RED, 'tab', 'up', 'up', 'enter')
  const lift = (e.lch[5]?.l ?? 0) - oklch(start.ansi[1] as string).l
  assert.ok(Math.abs(lift - 0.02) < 0.0005)
  assert.ok(Math.abs((e.lch[13]?.l ?? 0) - oklch(start.ansi[9] as string).l - lift) < 0.002)
  assert.equal(e.linkOf(13), 5)
  press(e, 'right', 'tab', 'up', 'enter')
  assert.equal(e.linkOf(13), undefined)
  const alone = e.colors().ansi[9]
  press(e, 'left', 'tab', 'up', 'enter')
  assert.equal(e.colors().ansi[9], alone)
  press(e, 'l')
  assert.equal(e.linkOf(13), 5)
  assert.match(e.notice ?? '', /move together/)
  press(e, 'tab', 'up', 'enter')
  assert.notEqual(e.colors().ansi[9], alone)
})

test('a bright that starts away from its normal’s hue is not linked until l asks', () => {
  const e = editor({ colors: { ...start, ansi: start.ansi.map((c, i) => (i === 9 ? '#5aa0ff' : c)) as string[] } })
  assert.equal(e.linkOf(13), undefined)
  press(e, ...RED, 'l')
  assert.equal(e.linkOf(13), 5)
})

test('m keeps the slots that changed, and the cursor skips the rest', () => {
  const e = editor()
  e.viewport(140, 40)
  press(e, ...RED, 'tab', 'up', 'enter', 'm')
  assert.deepEqual(
    [5, 6, 13, 14].map((slot) => e.visible(slot)),
    [true, false, true, false],
  )
  press(e, 'down')
  assert.equal(e.slot(), 5)
  press(e, 'right')
  assert.equal(e.slot(), 13)
  press(e, 'm')
  assert.equal(e.visible(6), true)
})

test('editing a tone marks the slots off the original colors, and leaves signature, other palettes and pictures out', () => {
  const tuned = { ...start, ansi: start.ansi.map((c, i) => (i === 1 ? '#ff6fa5' : c)) as string[] }
  const e = editor({ colors: tuned, original: start, tone: true })
  assert.deepEqual(
    [5, 6, 0].map((slot) => e.changed(slot)),
    [true, false, false],
  )
  assert.equal(e.dirty(), false)
  press(e, 'p', 'ctrl-v', 'o', '*')
  assert.equal(e.overlay, undefined)
  assert.equal(e.wants, undefined)
  assert.equal(e.signature.join(), 'background,foreground,cursor')
  press(e, 'R')
  assert.equal(e.changes(), 0)
  assert.equal(e.dirty(), true)
})

test('a spot on the sample finds its slots, and enter goes to the slot', () => {
  const e = editor()
  e.viewport(140, 40)
  e.point({ pane: 'shell', line: 14, run: 3 })
  assert.equal(e.inspect, true)
  assert.deepEqual(e.slotsHere(), { text: 5, ground: 0 })
  press(e, 'enter')
  assert.equal(e.inspect, false)
  assert.equal(e.slot(), 5)
  e.viewport(80, 24)
  press(e, 'i')
  assert.equal(e.inspect, false)
  assert.match(e.notice ?? '', /96×28/)
})

test('a share code pasted into the editor takes its colors, and a plain paste is still a color', () => {
  const e = editor({ decode: (text) => (text === 'tt1:dawn' ? other : undefined) })
  e.paste('tt1:dawn')
  assert.deepEqual(e.colors(), other)
  press(e, 'u')
  assert.deepEqual(e.colors(), start)
  e.paste('#ff0000')
  assert.equal(e.colors().background, '#ff0000')
})

test('the picker floats over the slot list under its slot, and the rows under it keep their places', () => {
  const e = editor()
  e.viewport(140, 40)
  press(e, ...RED)
  const list = renderEditor(e, 140, 40, false)
  const open = renderEditor(press(e, 'enter'), 140, 40, false)
  const at = list.findIndex((line) => line.startsWith('│▌ Red'))
  const end = open.findIndex((line) => /^.{2}╰─ ↑↓/.test(line))
  assert.equal(open[at], list[at])
  assert.match(open[at + 1] ?? '', /^│ ╭─ L × C/)
  assert.deepEqual(
    open.slice(at + 1, end + 1).map((line) => line.slice(44, 46)),
    list.slice(at + 1, end + 1).map((line) => line.slice(44, 46)),
  )
  assert.deepEqual(open.slice(end + 1, 39), list.slice(end + 1, 39))
})

test('a picture behind the builder shows through its preview, which leaves the background to the terminal', () => {
  const ground = `48;2;${rgb(start.background).join(';')}m`
  const opaque = renderEditor(editor(), 140, 40, true)
  const clear = renderEditor(editor(), 140, 40, true, { behind: true })
  assert.ok(opaque.slice(5, 20).some((line) => line.includes(ground)))
  assert.ok(!clear.slice(5, 20).some((line) => line.includes(ground)))
})
