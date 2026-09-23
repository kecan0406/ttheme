import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  backdropTone,
  backgroundsDir,
  type Colors,
  dropImage,
  fillFrame,
  fillSize,
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

test('a cut-out stands whole from its head down, right of centre, a little taller than the window', () => {
  const bust = { x: 49, y: 10, w: 2045, h: 1994 }
  const frame = fillFrame(bust, 1880, 1008, 40)
  assert.deepEqual(frame.crop, { ...bust, h: frame.crop.h }, 'the crop keeps the top and both sides of the figure')
  assert.ok(Math.abs(frame.at.y - 0.04 * 1008) < 1e-9, 'the head sits under a little headroom')
  assert.ok(Math.abs(frame.at.x + frame.at.w - 0.97 * 1880) < 1e-9, 'it stands against the right edge')
  assert.ok(
    Math.abs(frame.at.h / (frame.crop.h / bust.h) - 1.15 * 1008) < 1e-6,
    'the whole figure is 115% of the window',
  )
})

test('a tall narrow figure grows until it spans 40% of the window, so a full body shows its upper half', () => {
  const tall = { x: 10, y: 20, w: 1000, h: 3000 }
  const frame = fillFrame(tall, 1880, 1008, 40)
  assert.ok(Math.abs(frame.at.w - 0.4 * 1880) < 1e-9)
  assert.equal(frame.crop.y, tall.y)
  assert.ok(frame.crop.h < tall.h * 0.6)
})

test('a figure wider than the window shrinks to fit its width instead of losing its sides', () => {
  const wide = { x: 0, y: 0, w: 4000, h: 1000 }
  const frame = fillFrame(wide, 1880, 1008, 40)
  assert.ok(Math.abs(frame.at.w - 0.95 * 1880) < 1e-9)
  assert.equal(frame.crop.w, wide.w)
})

test('a picture that fills its box is a wallpaper: it covers the window from its top', () => {
  const tall = { x: 0, y: 5, w: 1000, h: 3000 }
  const frame = fillFrame(tall, 1880, 1008, 11)
  assert.deepEqual(frame.at, { x: 0, y: 0, w: 1880, h: 1008 })
  assert.equal(frame.crop.y, tall.y)
  assert.equal(fillFrame(tall, 1880, 1008, 12).at.w < 1880, true)
  const wide = { x: 0, y: 0, w: 4000, h: 1000 }
  assert.ok(Math.abs(fillFrame(wide, 1880, 1008, 0).crop.x + fillFrame(wide, 1880, 1008, 0).crop.w / 2 - 2000) < 1e-9)
})

test("the fill is made at the window's shape, no wider than 2560", () => {
  assert.deepEqual(fillSize(3760, 2016), { width: 2560, height: 1373 })
  assert.deepEqual(fillSize(1200, 800), { width: 1200, height: 800 })
})

function install(configHome: string, id: number): void {
  const image = { width: 4, height: 4, data: new Uint8Array(64).fill(200 + id) }
  installBackdrop(
    configHome,
    KAGAMI,
    toneFor(KAGAMI, 'cursor'),
    image,
    {
      site: 'safebooru',
      id,
      ext: 'png',
      bytes: new Uint8Array([id]),
      from: `safebooru ${id} https://example.test/${id}`,
    },
    { width: 40, height: 20 },
  )
}

function shown(dir: string): string | undefined {
  return /^# image (\S+)$/m.exec(readFileSync(join(dir, 'kagami.conf'), 'utf8'))?.[1]
}

function shownPath(dir: string): string | undefined {
  return /^background-image = (.+)$/m.exec(readFileSync(join(dir, 'kagami.conf'), 'utf8'))?.[1]
}

test('each picture shows under a path of its own, since terminals reload a background only when its path changes', () => {
  const configHome = mkdtempSync(join(tmpdir(), 'ttheme-images-'))
  const dir = backgroundsDir(configHome)
  install(configHome, 1)
  const first = shownPath(dir)
  install(configHome, 2)
  assert.notEqual(shownPath(dir), first)
  switchImage(configHome, 'kagami', 1)
  assert.equal(shownPath(dir), first)
  assert.ok(existsSync(first as string))
})

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

test('each saved picture keeps its own tuning, off switch and baked sizes', () => {
  const configHome = mkdtempSync(join(tmpdir(), 'ttheme-images-'))
  const dir = backgroundsDir(configHome)
  install(configHome, 1)
  writeFileSync(join(dir, 'kagami.tune.conf'), 'background-image-opacity = 0.42\n')
  writeFileSync(join(dir, 'kagami.off.conf'), 'background-image =\n')
  writeFileSync(join(dir, 'kagami@60-center.png'), 'baked')
  install(configHome, 2)
  const shelf = join(dir, 'shelf', 'kagami', 'safebooru_1')
  const kept = readdirSync(shelf).sort()
  assert.deepEqual(
    kept.filter((f) => !/^\.[0-9a-f]{8}/.test(f)),
    ['.conf', '.off.conf', '.tune.conf', '@60-center.png'],
  )
  assert.equal(kept.filter((f) => /^\.[0-9a-f]{8}(@fill-\d+)?\.png$/.test(f)).length, 2)
  assert.ok(!existsSync(join(dir, 'kagami.tune.conf')))
  assert.ok(!existsSync(join(dir, 'kagami.off.conf')))
  assert.ok(!existsSync(join(dir, 'kagami@60-center.png')))
  switchImage(configHome, 'kagami', 1)
  assert.equal(shown(dir), 'safebooru_1')
  assert.equal(readFileSync(join(dir, 'kagami.tune.conf'), 'utf8'), 'background-image-opacity = 0.42\n')
  assert.ok(existsSync(join(dir, 'kagami.off.conf')))
  assert.ok(existsSync(join(dir, 'kagami@60-center.png')))
  assert.ok(!existsSync(join(dir, 'shelf', 'kagami', 'safebooru_2', '.tune.conf')))
  switchImage(configHome, 'kagami', 1)
  assert.equal(shown(dir), 'safebooru_2')
  assert.ok(!existsSync(join(dir, 'kagami.tune.conf')))
  assert.ok(!existsSync(join(dir, 'kagami@60-center.png')))
})

test('dropping a picture takes its tuning with it', () => {
  const configHome = mkdtempSync(join(tmpdir(), 'ttheme-images-'))
  const dir = backgroundsDir(configHome)
  install(configHome, 1)
  install(configHome, 2)
  writeFileSync(join(dir, 'kagami.tune.conf'), 'background-image-opacity = 0.42\n')
  assert.deepEqual(dropImage(configHome, 'kagami'), { key: 'safebooru_2', left: 1 })
  assert.ok(!existsSync(join(dir, 'kagami.tune.conf')))
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
