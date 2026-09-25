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
  frameAt,
  installBackdrop,
  rackOf,
  readBackdrop,
  readStore,
  switchImage,
  toneFor,
  tuneOf,
  writeTune,
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
  return /^# image (\S+)/m.exec(readFileSync(join(dir, 'kagami.conf'), 'utf8'))?.[1]
}

function shownPath(dir: string): string | undefined {
  return /^background-image = (.+)$/m.exec(readFileSync(join(dir, 'kagami.conf'), 'utf8'))?.[1]
}

function keys(dir: string): string[] {
  return readStore(dir).palettes.kagami?.pictures.map((picture) => picture.key) ?? []
}

function tuning(dir: string): string {
  return join(
    dir,
    /^config-file = \?(.+\.tune\.conf)$/m.exec(readFileSync(join(dir, 'kagami.conf'), 'utf8'))?.[1] ?? '',
  )
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
  assert.deepEqual(keys(dir), ['safebooru_1', 'safebooru_2'])
  assert.equal(shown(dir), 'safebooru_2')
  install(configHome, 2)
  assert.deepEqual(keys(dir), ['safebooru_1', 'safebooru_2'])
  assert.match(readFileSync(join(dir, 'kagami.conf'), 'utf8'), /^# image safebooru_2 2\/2$/m)
})

test('a picture installed before pictures had keys is kept when another one is installed', () => {
  const configHome = mkdtempSync(join(tmpdir(), 'ttheme-images-'))
  const dir = backgroundsDir(configHome)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'kagami.1a2b3c4d.png'), 'old')
  writeFileSync(join(dir, 'kagami.1a2b3c4d@fill-9.png'), 'old')
  writeFileSync(join(dir, 'kagami.conf'), `background-image = ${join(dir, 'kagami.1a2b3c4d@fill-9.png')}\n`)
  install(configHome, 1)
  assert.deepEqual(keys(dir), ['picture_1a2b3c4d', 'safebooru_1'])
  assert.ok(existsSync(join(dir, 'kagami.1a2b3c4d@fill-9.png')))
  assert.deepEqual(switchImage(configHome, 'kagami', 1), { key: 'picture_1a2b3c4d', at: 1, of: 2 })
})

test('a conf ttheme did not write stays as it is and out of the store', () => {
  const configHome = mkdtempSync(join(tmpdir(), 'ttheme-images-'))
  const dir = backgroundsDir(configHome)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'kagami.conf'), 'background-image = ~/walls/kagami.png\n')
  assert.deepEqual(readStore(dir).palettes, {})
  assert.equal(readFileSync(join(dir, 'kagami.conf'), 'utf8'), 'background-image = ~/walls/kagami.png\n')
})

test('the shelf layout moves into the store once, each picture keeping its tuning, bakes and original', () => {
  const configHome = mkdtempSync(join(tmpdir(), 'ttheme-images-'))
  const dir = backgroundsDir(configHome)
  const shelf = join(dir, 'shelf', 'kagami', 'safebooru_1')
  mkdirSync(shelf, { recursive: true })
  mkdirSync(join(dir, 'originals'))
  writeFileSync(join(dir, 'originals', 'kagami-safebooru_1.png'), 'one')
  writeFileSync(join(dir, 'originals', 'kagami-safebooru_2.png'), 'two')
  writeFileSync(
    join(dir, 'kagami.conf'),
    `# from safebooru 2 x\n# image safebooru_2\nbackground-image = ${join(dir, 'kagami.bbbbbbbb@fill-30.png')}\nbackground-image-opacity = 0.3\nconfig-file = ?kagami.tune.conf\n`,
  )
  writeFileSync(join(dir, 'kagami.bbbbbbbb@fill-30.png'), 'two')
  writeFileSync(join(dir, 'kagami.tune.conf'), 'background-image-opacity = 0.5\n')
  writeFileSync(
    join(shelf, '.conf'),
    `# image safebooru_1\nbackground-image = ${join(dir, 'kagami.aaaaaaaa@fill-20.png')}\nbackground-image-opacity = 0.2\n`,
  )
  writeFileSync(join(shelf, '.aaaaaaaa@fill-20.png'), 'one')
  writeFileSync(join(shelf, '.aaaaaaaa@60-center.png'), 'baked')
  writeFileSync(join(shelf, '.off.conf'), 'background-image =\n')
  assert.deepEqual(readStore(dir).palettes.kagami, {
    active: 'safebooru_2',
    pictures: [
      {
        key: 'safebooru_1',
        stem: 'kagami.aaaaaaaa',
        fill: 'kagami.aaaaaaaa@fill-20.png',
        opacity: 0.2,
        original: join('originals', 'kagami-safebooru_1.png'),
      },
      {
        key: 'safebooru_2',
        stem: 'kagami.bbbbbbbb',
        fill: 'kagami.bbbbbbbb@fill-30.png',
        opacity: 0.3,
        from: 'safebooru 2 x',
        original: join('originals', 'kagami-safebooru_2.png'),
      },
    ],
  })
  assert.ok(!existsSync(join(dir, 'shelf')))
  assert.deepEqual(
    readdirSync(dir)
      .filter((file) => file.startsWith('kagami.'))
      .sort(),
    [
      'kagami.aaaaaaaa.off.conf',
      'kagami.aaaaaaaa@60-center.png',
      'kagami.aaaaaaaa@fill-20.png',
      'kagami.bbbbbbbb.tune.conf',
      'kagami.bbbbbbbb@fill-30.png',
      'kagami.conf',
    ],
  )
  assert.match(readFileSync(join(dir, 'kagami.conf'), 'utf8'), /^config-file = \?kagami\.bbbbbbbb\.tune\.conf$/m)
})

test('switching walks the saved pictures around without moving a file', () => {
  const configHome = mkdtempSync(join(tmpdir(), 'ttheme-images-'))
  const dir = backgroundsDir(configHome)
  install(configHome, 1)
  install(configHome, 2)
  const files = readdirSync(dir).sort()
  assert.deepEqual(switchImage(configHome, 'kagami', 1), { key: 'safebooru_1', at: 1, of: 2 })
  assert.equal(shown(dir), 'safebooru_1')
  assert.deepEqual(switchImage(configHome, 'kagami', -1), { key: 'safebooru_2', at: 2, of: 2 })
  assert.equal(shown(dir), 'safebooru_2')
  assert.deepEqual(readdirSync(dir).sort(), files)
})

test('each saved picture keeps its own tuning and off switch', () => {
  const configHome = mkdtempSync(join(tmpdir(), 'ttheme-images-'))
  const dir = backgroundsDir(configHome)
  install(configHome, 1)
  const first = tuning(dir)
  writeFileSync(first, 'background-image-opacity = 0.42\n')
  install(configHome, 2)
  assert.notEqual(tuning(dir), first)
  assert.ok(existsSync(first))
  switchImage(configHome, 'kagami', 1)
  assert.equal(tuning(dir), first)
  assert.equal(readFileSync(first, 'utf8'), 'background-image-opacity = 0.42\n')
})

test('installing the shown post again starts it from the defaults', () => {
  const configHome = mkdtempSync(join(tmpdir(), 'ttheme-images-'))
  const dir = backgroundsDir(configHome)
  install(configHome, 1)
  writeFileSync(tuning(dir), 'background-image-opacity = 0.42\n')
  install(configHome, 1)
  assert.ok(!existsSync(tuning(dir)))
})

test('dropping a picture takes its files, tuning and original with it', () => {
  const configHome = mkdtempSync(join(tmpdir(), 'ttheme-images-'))
  const dir = backgroundsDir(configHome)
  install(configHome, 1)
  install(configHome, 2)
  const gone = tuning(dir)
  writeFileSync(gone, 'background-image-opacity = 0.42\n')
  assert.deepEqual(dropImage(configHome, 'kagami'), { key: 'safebooru_2', left: 1 })
  assert.ok(!existsSync(gone))
  assert.equal(shown(dir), 'safebooru_1')
  assert.deepEqual(readdirSync(join(dir, 'originals')), ['kagami-safebooru_1.png'])
  assert.equal(readdirSync(dir).filter((file) => file.startsWith('kagami.') && file.endsWith('.png')).length, 2)
})

test('removing the last picture leaves the palette bare', () => {
  const configHome = mkdtempSync(join(tmpdir(), 'ttheme-images-'))
  const dir = backgroundsDir(configHome)
  install(configHome, 1)
  assert.deepEqual(dropImage(configHome, 'kagami'), { key: 'safebooru_1', left: 0 })
  assert.deepEqual(keys(dir), [])
  assert.ok(!existsSync(join(dir, 'kagami.conf')))
  assert.throws(() => switchImage(configHome, 'kagami', 1), /no other image/)
  assert.throws(() => dropImage(configHome, 'kagami'), /has no image/)
})

test('frameAt places a picture exactly as the shell layer does', () => {
  const box = (a: [number, number, number, number, number, number, boolean, number?]) => {
    const { w, h, x, y } = frameAt(...a)
    return `${w} ${h} ${x} ${y}`
  }
  assert.equal(box([1000, 1500, 1000, 1500, 60, 3, false]), '600 900 400 0')
  assert.equal(box([1000, 1500, 2560, 1550, 130, 3, false, 42]), '1343 2015 1217 -71')
  assert.equal(box([1600, 900, 2560, 1550, 150, 9, false, 30]), '3840 2160 -640 0')
  assert.equal(box([800, 1200, 800, 1200, 45, 5, false]), '360 540 220 330')
})

test('a shared framing written for a picture reads back the same, and the default writes nothing', () => {
  const configHome = mkdtempSync(join(tmpdir(), 'ttheme-tune-'))
  const dir = backgroundsDir(configHome)
  install(configHome, 3)
  const [picture] = rackOf(configHome, 'kagami')
  assert.ok(picture)
  assert.equal(writeTune(dir, picture, {}, true, configHome), undefined)
  assert.deepEqual(tuneOf(dir, picture), {})
  for (const tune of [
    { size: 60, position: 'center' },
    { size: 130 },
    { size: 100, opacity: 0.3 },
    { position: 'bottom-left' },
  ]) {
    writeTune(dir, picture, tune, true, configHome)
    assert.deepEqual(tuneOf(dir, picture), tune)
  }
})

test('a palette named after its author keeps its pictures in files named with -- for the slash', () => {
  const configHome = mkdtempSync(join(tmpdir(), 'ttheme-slash-'))
  const image = { width: 4, height: 4, data: new Uint8Array(64).fill(90) }
  const colors = { ...KAGAMI, name: 'kec/dusk' }
  installBackdrop(
    configHome,
    colors,
    toneFor(colors, 'cursor'),
    image,
    { site: 'yande', id: 9, ext: 'png', bytes: new Uint8Array([9]) },
    { width: 40, height: 20 },
  )
  const files = readdirSync(backgroundsDir(configHome))
  assert.ok(files.includes('kec--dusk.conf'))
  assert.ok(files.some((f) => /^kec--dusk\.[0-9a-f]{8}\.png$/.test(f)))
  assert.ok(readBackdrop(backgroundsDir(configHome), 'kec/dusk', configHome))
})
