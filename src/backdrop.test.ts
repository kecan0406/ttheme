import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  backdropTone,
  backgroundsDir,
  type Colors,
  coverBox,
  dropImage,
  fillBox,
  fillFrame,
  headAnchor,
  imageKeys,
  installBackdrop,
  switchImage,
  toneFor,
} from './backdrop.ts'

const KAGAMI: Colors = {
  name: 'kagami',
  background: '#19161e',
  foreground: '#e8dff1',
  cursor: '#9b86c8',
  ansi: [
    '#25222a',
    '#d58c98',
    '#76b4c9',
    '#f7a895',
    '#9099f2',
    '#b49cd1',
    '#70b8e8',
    '#cbc4cf',
    '#7a757f',
    '#ffa3e6',
    '#97d5eb',
    '#ffd3c8',
    '#b0bff9',
    '#d4bbfe',
    '#a2d8ff',
    '#f4eafd',
  ],
}

test('kagami at 0.2 is the brightness every other palette is matched to', () => {
  assert.equal(toneFor(KAGAMI, 'cursor').opacity, 0.2)
})

test('the tint stays on the cursor while it leaves a visible opacity', () => {
  assert.equal(backdropTone(KAGAMI, ['cursor', 'ansi4', 'ansi1']).slot, 'cursor')
})

test('a cursor too faint to show moves the tint to the signature slot that shows most, not the darkest', () => {
  const tight = { ...KAGAMI, name: 'tight', foreground: '#b4b0b8', cursor: '#ffffff' }
  assert.ok(toneFor(tight, 'cursor').opacity < 0.1)
  assert.equal(toneFor(tight, 'ansi0').opacity, 1)
  assert.equal(backdropTone(tight, ['cursor', 'ansi0', 'ansi4']).slot, 'ansi4')
})

test('a tall figure keeps its head: the fill starts a little below the top of the figure', () => {
  const tall = { x: 10, y: 20, w: 1000, h: 3000 }
  const crop = fillBox(tall, 2560, 1550, headAnchor(tall))
  assert.equal(crop.w, tall.w)
  assert.ok(Math.abs(crop.h - (1000 * 1550) / 2560) < 1e-9)
  assert.ok(Math.abs(crop.y - (tall.y + 0.15 * crop.h)) < 1e-9)
})

test('the anchor lands where kagami was measured by hand on a bust-up', () => {
  assert.equal(Math.round(headAnchor({ x: 49, y: 10, w: 2045, h: 1994 }) * 100), 40)
})

test('a figure wider than the fill keeps its full height and centers horizontally', () => {
  const wide = { x: 0, y: 0, w: 4000, h: 1000 }
  const crop = fillBox(wide, 2560, 1550, headAnchor(wide))
  assert.equal(crop.h, 1000)
  assert.ok(Math.abs(crop.x + crop.w / 2 - 2000) < 1e-9)
})

test('the try-on crops the fill the way ghostty covers a window of another shape', () => {
  const fill = { x: 0, y: 0, w: 2560, h: 1550 }
  const tall = coverBox(fill, 1000, 1000)
  assert.deepEqual([tall.w, tall.h, tall.x], [1550, 1550, 505])
  const wide = coverBox(fill, 3000, 1000)
  assert.ok(Math.abs(wide.h - 2560 / 3) < 1e-9)
  assert.ok(Math.abs(wide.y - (1550 - 2560 / 3) / 2) < 1e-9)
})

test('a figure too narrow to fill the band stands in the frame instead of being cropped to its head', () => {
  const tall = { x: 10, y: 20, w: 1000, h: 3000 }
  const frame = fillFrame(tall, 2560, 1550, headAnchor(tall), 60)
  assert.equal(frame.inset, true)
  assert.equal(frame.crop.y, tall.y, 'a head anchor this high cannot trim the top of the figure')
  assert.ok(Math.abs(frame.crop.h - 0.55 * tall.h) < 1e-9, 'it keeps 55% of the figure')
  assert.ok(frame.at.y > 0 && frame.at.y + frame.at.h === 1550, 'the headroom is above it')
  assert.ok(frame.at.x > 1550 * 0.5 && frame.at.x + frame.at.w < 2560, 'it sits right of centre, clear of the edge')
})

test('the frame grows into the covering crop as the figure widens, with no jump at the switch', () => {
  const shape = (ratio: number) => {
    const box = { x: 0, y: 0, w: ratio * 1000, h: 1000 }
    const frame = fillFrame(box, 2560, 1550, headAnchor(box), 60)
    return { inset: frame.inset, w: frame.at.w, y: frame.at.y, top: frame.crop.y }
  }
  const under = shape(0.908)
  const over = shape(0.91)
  assert.deepEqual([under.inset, over.inset], [true, false], 'they sit on either side of the switch')
  assert.ok(Math.abs(under.w - over.w) < 2560 * 0.01, 'the figure does not resize across it')
  assert.ok(Math.abs(under.y - over.y) < 1550 * 0.01, 'the headroom does not appear across it')
  assert.ok(Math.abs(under.top - over.top) < 1000 * 0.01, 'the crop does not slide across it')

  const widths = [0.2, 0.4, 0.6, 0.8, 0.9].map((r) => shape(r).w)
  assert.deepEqual(
    widths,
    [...widths].sort((a, b) => a - b),
    'a wider figure always fills more of the frame',
  )
})

test('a wide enough figure keeps the crop it always had', () => {
  const bust = { x: 49, y: 10, w: 2045, h: 1994 }
  const frame = fillFrame(bust, 2560, 1550, headAnchor(bust), 60)
  assert.equal(frame.inset, false)
  assert.deepEqual(frame.crop, fillBox(bust, 2560, 1550, headAnchor(bust)))
})

test('an opaque picture is a wallpaper: it is covered, never stood in the frame', () => {
  const tall = { x: 0, y: 0, w: 1000, h: 3000 }
  assert.equal(fillFrame(tall, 2560, 1550, headAnchor(tall), 0).inset, false)
  assert.equal(fillFrame(tall, 2560, 1550, headAnchor(tall), 2).inset, false)
  assert.equal(fillFrame(tall, 2560, 1550, headAnchor(tall), 3).inset, true)
})

function install(configHome: string, id: number): void {
  const image = { width: 4, height: 4, data: new Uint8Array(64).fill(200) }
  installBackdrop(configHome, KAGAMI, toneFor(KAGAMI, 'cursor'), image, {
    site: 'safebooru',
    id,
    ext: 'png',
    bytes: new Uint8Array([id]),
    from: `safebooru ${id} https://example.test/${id}`,
  })
}

function shown(dir: string): string | undefined {
  return /^# image (\S+)$/m.exec(readFileSync(join(dir, 'kagami.conf'), 'utf8'))?.[1]
}

test('installing another picture keeps the one shown, and installing the shown one again does not duplicate it', () => {
  const configHome = mkdtempSync(join(tmpdir(), 'ttheme-images-'))
  const dir = backgroundsDir(configHome)
  install(configHome, 1)
  install(configHome, 2)
  assert.deepEqual(imageKeys(dir, 'kagami'), ['safebooru_1', 'safebooru_2'])
  assert.equal(shown(dir), 'safebooru_2')
  assert.ok(existsSync(join(dir, 'shelf', 'kagami', 'safebooru_1', '.conf')))
  install(configHome, 2)
  assert.deepEqual(imageKeys(dir, 'kagami'), ['safebooru_1', 'safebooru_2'])
})

test('a picture without a key is replaced by the next install, and can still be removed', () => {
  const configHome = mkdtempSync(join(tmpdir(), 'ttheme-images-'))
  const dir = backgroundsDir(configHome)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'kagami.png'), 'old')
  writeFileSync(join(dir, 'kagami.conf'), 'background-image = kagami@fill-9.png\n')
  writeFileSync(join(dir, 'kagami@fill-9.png'), 'old')
  assert.throws(() => switchImage(configHome, 'kagami', 1), /no other image/)
  assert.deepEqual(dropImage(configHome, 'kagami'), { key: undefined, left: 0 })
  assert.deepEqual(readdirSync(dir), [])
  writeFileSync(join(dir, 'kagami.conf'), 'background-image = kagami@fill-9.png\n')
  install(configHome, 1)
  assert.deepEqual(imageKeys(dir, 'kagami'), ['safebooru_1'])
})

test('switching walks the saved pictures around and puts each one back as it was', () => {
  const configHome = mkdtempSync(join(tmpdir(), 'ttheme-images-'))
  const dir = backgroundsDir(configHome)
  install(configHome, 1)
  install(configHome, 2)
  assert.deepEqual(switchImage(configHome, 'kagami', 1), { key: 'safebooru_1', at: 1, of: 2 })
  assert.equal(shown(dir), 'safebooru_1')
  assert.deepEqual(switchImage(configHome, 'kagami', -1), { key: 'safebooru_2', at: 2, of: 2 })
  assert.equal(shown(dir), 'safebooru_2')
  assert.deepEqual(readdirSync(join(dir, 'shelf', 'kagami')), ['safebooru_1'])
})

test('removing the shown picture shows the next one, and the last one leaves the palette bare', () => {
  const configHome = mkdtempSync(join(tmpdir(), 'ttheme-images-'))
  const dir = backgroundsDir(configHome)
  install(configHome, 1)
  install(configHome, 2)
  assert.deepEqual(dropImage(configHome, 'kagami'), { key: 'safebooru_2', left: 1 })
  assert.equal(shown(dir), 'safebooru_1')
  assert.deepEqual(readdirSync(join(dir, 'originals')), ['kagami-safebooru_1.png'])
  assert.deepEqual(dropImage(configHome, 'kagami'), { key: 'safebooru_1', left: 0 })
  assert.deepEqual(imageKeys(dir, 'kagami'), [])
  assert.throws(() => switchImage(configHome, 'kagami', 1), /no other image/)
})
