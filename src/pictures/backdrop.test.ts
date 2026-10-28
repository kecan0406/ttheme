import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { canvasOf } from '../cli/images.ts'
import { backdropTone, type Colors, originalOpacity, toneFor } from '../core/backdrop-tone.ts'
import { luminance, mix } from '../core/color.ts'
import { checkReadability } from '../core/contrast.ts'
import {
  decodePng,
  encodeMask,
  encodeRgb,
  encodeRgba,
  flatIndexed,
  flatten,
  lay,
  type Rgba,
  retone,
} from '../core/png.ts'
import { ROOT } from '../root.ts'
import {
  applyRedraw,
  backgroundsDir,
  coloringOf,
  dropImage,
  fillFrame,
  fillSize,
  frameAt,
  freshenConfs,
  inked,
  installBackdrop,
  liftOf,
  type Paint,
  type Picture,
  peakOf,
  rackOf,
  readStore,
  retint,
  showImage,
  thumbless,
  tryOn,
  tuneOf,
  writeThumb,
  writeTune,
} from './backdrop.ts'
import { readBackdrop } from './conf.ts'
import { prepareOne, redrawOne } from './redrawing.ts'

process.env.XDG_CACHE_HOME = mkdtempSync(join(tmpdir(), 'ttheme-cache-'))

const TAMSIN: Colors = {
  name: 'tamsin',
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

const PAINT: Paint = { hue: { color: '#9b86c8', opacity: 0.2 }, colors: TAMSIN }

test('tamsin at 0.2 is the brightness every other palette is matched to, and its accents hold tamsin itself just under it', () => {
  const tone = toneFor(TAMSIN, 'cursor')
  assert.equal(Math.floor(tone.matched * 100) / 100, 0.2)
  assert.equal(tone.opacity, 0.19)
})

test('a palette that already misses the gate without a picture still gets the opacity its picture allows', () => {
  const missing = { ...TAMSIN, ansi: TAMSIN.ansi.map((c, i) => (i === 1 ? '#2a2530' : c)) }
  assert.equal(toneFor(missing, 'cursor').opacity, toneFor(TAMSIN, 'cursor').opacity)
})

test('the tint stays on the cursor while it leaves a visible opacity', () => {
  assert.equal(backdropTone(TAMSIN, ['cursor', 'ansi4', 'ansi1']).slot, 'cursor')
})

test('a cursor too faint to show moves the tint to the signature slot that shows most, not the darkest', () => {
  const tight = { ...TAMSIN, name: 'tight', foreground: '#b4b0b8', cursor: '#ffffff' }
  assert.ok(toneFor(tight, 'cursor').opacity < 0.1)
  assert.equal(toneFor(tight, 'ansi0').opacity, 1)
  assert.equal(backdropTone(tight, ['cursor', 'ansi0', 'ansi4']).slot, 'ansi4')
})

const LINNET: Colors = {
  name: 'linnet',
  background: '#fff8f7',
  foreground: '#1f1c39',
  cursor: '#b83b64',
  ansi: [
    '#fff0f2',
    '#974b61',
    '#1b5b40',
    '#8b5800',
    '#51628f',
    '#6a4269',
    '#005676',
    '#35292b',
    '#847376',
    '#863d53',
    '#034c33',
    '#8b3f13',
    '#435381',
    '#5b345b',
    '#004763',
    '#2c1b1f',
  ],
}

test('a light palette lets its picture darken the background as far as a dark one lets its picture brighten it, mirrored', () => {
  const tone = toneFor(LINNET, 'cursor')
  assert.ok(tone.opacity >= 0.1, String(tone.opacity))
  assert.ok(luminance(mix(LINNET.background, LINNET.cursor, tone.matched)) >= 0.6)
  assert.ok(luminance(mix(LINNET.background, LINNET.cursor, tone.matched + 0.02)) < 0.61)
})

test('on a light background the ink is how dark the picture is, so it reads the right way round', () => {
  const image: Rgba = { width: 2, height: 1, data: Uint8Array.from([0, 0, 0, 255, 255, 255, 255, 255]) }
  assert.deepEqual([...inked(image).ink(false).data], [0, 255])
  assert.deepEqual([...inked(image).ink(true).data], [255, 0])
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

function install(configHome: string, id: number, artist = id === 1 ? ['inkwell', 'paper boat'] : undefined): void {
  const image = { width: 4, height: 4, data: new Uint8Array(64).fill(200 + id) }
  installBackdrop(
    configHome,
    TAMSIN,
    toneFor(TAMSIN, 'cursor'),
    image,
    {
      site: 'safebooru',
      id,
      ext: 'png',
      bytes: new Uint8Array([id]),
      from: `safebooru ${id} https://example.test/${id}`,
      ...(artist ? { artist } : {}),
      ...(id === 1
        ? { source: 'https://www.pixiv.net/artworks/1', profiles: { inkwell: ['https://x.com/inkwell'] } }
        : {}),
    },
    { width: 40, height: 20 },
    0,
  )
}

function shown(dir: string): string | undefined {
  return /^# image (\S+)/m.exec(readFileSync(join(dir, 'tamsin.conf'), 'utf8'))?.[1]
}

function shownPath(dir: string): string | undefined {
  return /^background-image = (.+)$/m.exec(readFileSync(join(dir, 'tamsin.conf'), 'utf8'))?.[1]
}

function keys(dir: string): string[] {
  return readStore(dir).palettes.tamsin?.pictures.map((picture) => picture.key) ?? []
}

function tuning(dir: string): string {
  return join(
    dir,
    /^config-file = \?(.+\.tune\.conf)$/m.exec(readFileSync(join(dir, 'tamsin.conf'), 'utf8'))?.[1] ?? '',
  )
}

test('a palette named like a property every object has keeps its pictures as any other does', () => {
  const configHome = mkdtempSync(join(tmpdir(), 'ttheme-images-'))
  const named = { ...TAMSIN, name: 'constructor' }
  const image = { width: 4, height: 4, data: new Uint8Array(64).fill(201) }
  const source = { site: 'safebooru', id: 1, ext: 'png', bytes: new Uint8Array([1]), from: 'safebooru 1' }
  assert.deepEqual(rackOf(configHome, 'constructor'), [])
  installBackdrop(configHome, named, toneFor(named, 'cursor'), image, source, { width: 40, height: 20 }, 0)
  assert.deepEqual(
    rackOf(configHome, 'constructor').map((picture) => picture.key),
    ['safebooru_1'],
  )
  assert.deepEqual(showImage(configHome, 'constructor', 'safebooru_1'), { at: 1, of: 1 })
  dropImage(configHome, 'constructor')
  assert.deepEqual(rackOf(configHome, 'constructor'), [])
})

test('a picture whose artist is named like a property every object has still gets its conf, so sync keeps working', () => {
  const configHome = mkdtempSync(join(tmpdir(), 'ttheme-images-'))
  const image = { width: 4, height: 4, data: new Uint8Array(64).fill(201) }

  const source = {
    site: 'safebooru',
    id: 1,
    ext: 'png',
    bytes: new Uint8Array([1]),
    from: 'safebooru 1 https://example.test/1',
    artist: ['constructor', 'inkwell'],
    profiles: { inkwell: ['https://x.com/inkwell'] },
  }

  installBackdrop(configHome, TAMSIN, toneFor(TAMSIN, 'cursor'), image, source, { width: 40, height: 20 }, 0)
  assert.match(
    readFileSync(join(backgroundsDir(configHome), 'tamsin.conf'), 'utf8'),
    /^# credit safebooru_1 .*constructor/m,
  )
  freshenConfs(configHome)
})

test('each picture shows under a path of its own, since terminals reload a background only when its path changes', () => {
  const configHome = mkdtempSync(join(tmpdir(), 'ttheme-images-'))
  const dir = backgroundsDir(configHome)
  install(configHome, 1)
  const first = shownPath(dir)
  install(configHome, 2)
  assert.notEqual(shownPath(dir), first)
  showImage(configHome, 'tamsin', 'safebooru_1')
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
  assert.match(readFileSync(join(dir, 'tamsin.conf'), 'utf8'), /^# image safebooru_2 2\/2$/m)
})

test('a picture installed before pictures had keys is kept when another one is installed', () => {
  const configHome = mkdtempSync(join(tmpdir(), 'ttheme-images-'))
  const dir = backgroundsDir(configHome)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'tamsin.1a2b3c4d.png'), 'old')
  writeFileSync(join(dir, 'tamsin.1a2b3c4d@fill-9.png'), 'old')
  writeFileSync(join(dir, 'tamsin.conf'), `background-image = ${join(dir, 'tamsin.1a2b3c4d@fill-9.png')}\n`)
  install(configHome, 1)
  assert.deepEqual(keys(dir), ['picture_1a2b3c4d', 'safebooru_1'])
  assert.ok(existsSync(join(dir, 'tamsin.1a2b3c4d@fill-9.png')))
  assert.deepEqual(showImage(configHome, 'tamsin', 'picture_1a2b3c4d'), { at: 1, of: 2 })
})

test('a conf ttheme did not write stays as it is and out of the store', () => {
  const configHome = mkdtempSync(join(tmpdir(), 'ttheme-images-'))
  const dir = backgroundsDir(configHome)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'tamsin.conf'), 'background-image = ~/walls/tamsin.png\n')
  assert.deepEqual(readStore(dir).palettes, {})
  assert.equal(readFileSync(join(dir, 'tamsin.conf'), 'utf8'), 'background-image = ~/walls/tamsin.png\n')
})

function shelved(): string {
  const dir = backgroundsDir(mkdtempSync(join(tmpdir(), 'ttheme-images-')))
  const shelf = join(dir, 'shelf', 'tamsin', 'safebooru_1')
  mkdirSync(shelf, { recursive: true })
  mkdirSync(join(dir, 'originals'))
  writeFileSync(join(dir, 'originals', 'tamsin-safebooru_1.png'), 'one')
  writeFileSync(join(dir, 'originals', 'tamsin-safebooru_2.png'), 'two')
  writeFileSync(
    join(dir, 'tamsin.conf'),
    `# from safebooru 2 x\n# image safebooru_2\nbackground-image = ${join(dir, 'tamsin.bbbbbbbb@fill-30.png')}\nbackground-image-opacity = 0.3\nconfig-file = ?tamsin.tune.conf\n`,
  )
  writeFileSync(join(dir, 'tamsin.bbbbbbbb@fill-30.png'), 'two')
  writeFileSync(join(dir, 'tamsin.tune.conf'), 'background-image-opacity = 0.5\n')
  writeFileSync(
    join(shelf, '.conf'),
    `# image safebooru_1\nbackground-image = ${join(dir, 'tamsin.aaaaaaaa@fill-20.png')}\nbackground-image-opacity = 0.2\n`,
  )
  writeFileSync(join(shelf, '.aaaaaaaa@fill-20.png'), 'one')
  writeFileSync(join(shelf, '.aaaaaaaa@60-center.png'), 'baked')
  writeFileSync(join(shelf, '.off.conf'), 'background-image =\n')

  return dir
}

test('the shelf layout moves into the store once, each picture keeping its tuning, bakes and original', () => {
  const dir = shelved()
  assert.deepEqual(readStore(dir).palettes.tamsin, {
    active: 'safebooru_2',
    pictures: [
      {
        key: 'safebooru_1',
        stem: 'tamsin.aaaaaaaa',
        fill: 'tamsin.aaaaaaaa@fill-20.png',
        opacity: 0.2,
        original: join('originals', 'tamsin-safebooru_1.png'),
      },
      {
        key: 'safebooru_2',
        stem: 'tamsin.bbbbbbbb',
        fill: 'tamsin.bbbbbbbb@fill-30.png',
        opacity: 0.3,
        from: 'safebooru 2 x',
        original: join('originals', 'tamsin-safebooru_2.png'),
      },
    ],
  })
  assert.ok(!existsSync(join(dir, 'shelf')))
  assert.deepEqual(
    readdirSync(dir)
      .filter((file) => file.startsWith('tamsin.'))
      .sort(),
    [
      'tamsin.aaaaaaaa.off.conf',
      'tamsin.aaaaaaaa@60-center.png',
      'tamsin.aaaaaaaa@fill-20.png',
      'tamsin.bbbbbbbb.tune.conf',
      'tamsin.bbbbbbbb@fill-30.png',
      'tamsin.conf',
    ],
  )
  assert.match(readFileSync(join(dir, 'tamsin.conf'), 'utf8'), /^config-file = \?tamsin\.bbbbbbbb\.tune\.conf$/m)
})

test('a shelf move that fails before the store is written is finished by the next read, losing no picture', () => {
  const dir = shelved()
  mkdirSync(join(dir, 'images.json'))
  assert.throws(() => readStore(dir))
  rmSync(join(dir, 'images.json'), { recursive: true })
  assert.deepEqual(keys(dir), ['safebooru_1', 'safebooru_2'])
  assert.ok(existsSync(join(dir, 'tamsin.aaaaaaaa@fill-20.png')))
  assert.ok(!existsSync(join(dir, 'shelf')))
})

test('showing another saved picture moves no file', () => {
  const configHome = mkdtempSync(join(tmpdir(), 'ttheme-images-'))
  const dir = backgroundsDir(configHome)
  install(configHome, 1)
  install(configHome, 2)
  const files = readdirSync(dir).sort()
  assert.deepEqual(showImage(configHome, 'tamsin', 'safebooru_1'), { at: 1, of: 2 })
  assert.equal(shown(dir), 'safebooru_1')
  assert.deepEqual(showImage(configHome, 'tamsin', 'safebooru_2'), { at: 2, of: 2 })
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
  showImage(configHome, 'tamsin', 'safebooru_1')
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
  assert.deepEqual(dropImage(configHome, 'tamsin'), { key: 'safebooru_2', left: 1 })
  assert.ok(!existsSync(gone))
  assert.equal(shown(dir), 'safebooru_1')
  assert.deepEqual(readdirSync(join(dir, 'originals')), ['tamsin-safebooru_1.png'])
  assert.equal(readdirSync(dir).filter((file) => file.startsWith('tamsin.') && file.endsWith('.png')).length, 3)
})

test('the conf lists every picture preview can switch to with its artist, and one not shown drops by key', () => {
  const configHome = mkdtempSync(join(tmpdir(), 'ttheme-images-'))
  const dir = backgroundsDir(configHome)
  install(configHome, 1)
  install(configHome, 2)
  const conf = () => readFileSync(join(dir, 'tamsin.conf'), 'utf8')
  const listed = [...conf().matchAll(/^# picture (\S+) \S+ \S+ \S+ (\S+) (.*)$/gm)].map((m) => m.slice(1))
  assert.deepEqual(listed, [
    ['safebooru_1', 'inkwell,paper_boat', 'safebooru 1 https://example.test/1'],
    ['safebooru_2', '-', 'safebooru 2 https://example.test/2'],
  ])
  assert.doesNotMatch(conf(), /^# by /m)
  assert.deepEqual(
    conf()
      .split('\n')
      .filter((line) => /^# (?:credit|source|profile) /.test(line)),
    [
      '# credit safebooru_1 Background art by inkwell (x.com/inkwell), paper boat · https://www.pixiv.net/artworks/1',
      '# source safebooru_1 pixiv 1 https://www.pixiv.net/artworks/1',
      '# profile safebooru_1 inkwell x https://x.com/inkwell',
      '# credit safebooru_2 Background art (artist unknown) · https://example.test/2',
    ],
  )
  showImage(configHome, 'tamsin', 'safebooru_1')
  assert.match(conf(), /^# by inkwell,paper_boat$/m)
  assert.deepEqual(dropImage(configHome, 'tamsin', 'safebooru_1'), { key: 'safebooru_1', left: 1 })
  assert.equal(shown(dir), 'safebooru_2')
})

test('an artist name a site sends with control characters reaches the conf without them', () => {
  const configHome = mkdtempSync(join(tmpdir(), 'ttheme-images-'))
  install(configHome, 3, ['mallory\x1b]52;c;aGk=\x07', 'bell\x07'])
  const conf = readFileSync(join(backgroundsDir(configHome), 'tamsin.conf'), 'utf8')
  assert.match(conf, /^# by mallory_\]52;c;aGk=_,bell_$/m)
  assert.doesNotMatch(conf.replaceAll('\n', ''), /\p{Cc}/u)
})

test('a picture whose file name or artist breaks a line reaches the conf on one line, so no reader takes part of it for a setting', () => {
  const [line, paragraph, rlo] = [0x2028, 0x2029, 0x202e].map((code) => String.fromCodePoint(code))
  const configHome = mkdtempSync(join(tmpdir(), 'ttheme-images-'))
  const dir = backgroundsDir(configHome)
  installBackdrop(
    configHome,
    TAMSIN,
    toneFor(TAMSIN, 'cursor'),
    { width: 4, height: 4, data: new Uint8Array(64).fill(200) },
    {
      site: 'local',
      id: 7,
      ext: 'png',
      bytes: new Uint8Array([7]),
      from: `local 7 /tmp/a\ncommand = /tmp/run\r${line}background-image = /tmp/x.png${rlo}.png`,
      artist: [`mallory${paragraph}background-image-opacity = 1`],
    },
    { width: 40, height: 20 },
    0,
  )
  const conf = readFileSync(join(dir, 'tamsin.conf'), 'utf8')
  const keys = conf.split('\n').flatMap((each) => /^([a-z-]+) = /.exec(each)?.[1] ?? [])
  assert.deepEqual(
    [...new Set(keys)],
    [
      'background-image',
      'background-image-fit',
      'background-image-position',
      'background-image-opacity',
      'config-file',
    ],
  )
  assert.doesNotMatch(conf.replaceAll('\n', ''), /[\p{Cc}\p{Zl}\p{Zp}\p{Bidi_Control}]/u)
  assert.match(conf, /^# from local 7 \/tmp\/a command = \/tmp\/run background-image = \/tmp\/x\.png\.png$/m)
})

test('removing the last picture leaves the palette bare', () => {
  const configHome = mkdtempSync(join(tmpdir(), 'ttheme-images-'))
  const dir = backgroundsDir(configHome)
  install(configHome, 1)
  assert.deepEqual(dropImage(configHome, 'tamsin'), { key: 'safebooru_1', left: 0 })
  assert.deepEqual(keys(dir), [])
  assert.ok(!existsSync(join(dir, 'tamsin.conf')))
  assert.throws(() => showImage(configHome, 'tamsin', 'safebooru_1'), /has no picture/)
  assert.throws(() => dropImage(configHome, 'tamsin'), /has no picture/)
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
  const layer = readFileSync(join(ROOT, 'shell', 'adapters', '_bg.zsh'), 'utf8')
  const from = layer.indexOf('__tt_bg_frame() {')
  const frame = layer.slice(from, layer.indexOf('\n}\n', from) + 2)
  const cases: [number, number, number, number, number, number, boolean, number][] = []

  for (const [iw, ih] of [
    [1000, 1500],
    [1600, 900],
    [2056, 2560],
    [800, 1200],
  ] as const) {
    for (const [W, H] of [
      [1000, 1500],
      [2560, 1550],
      [1600, 1000],
      [800, 1200],
    ] as const) {
      for (const size of [45, 60, 100, 130, 150, 199]) {
        for (const at of [1, 5, 9]) {
          for (const focus of [-1, 42, 62]) {
            cases.push([iw, ih, W, H, size, at, true, focus], [iw, ih, W, H, size, at, false, focus])
          }
        }
      }
    }
  }

  const shell = spawnSync(
    'zsh',
    ['-f', '-c', `${frame}\nwhile read -r a; do __tt_bg_frame \${=a}; print -r -- $REPLY; done`],
    {
      input: `${cases.map(([iw, ih, W, H, size, at, cover, focus]) => `${iw} ${ih} ${W} ${H} ${size} ${at} ${cover ? 'cover' : 'contain'} ${focus}`).join('\n')}\n`,
      encoding: 'utf8',
    },
  )

  assert.deepEqual(shell.stdout.trimEnd().split('\n'), cases.map(box))
})

test('a shared framing written for a picture reads back the same, and the default writes nothing', () => {
  const configHome = mkdtempSync(join(tmpdir(), 'ttheme-tune-'))
  const dir = backgroundsDir(configHome)
  install(configHome, 3)
  const [picture] = rackOf(configHome, 'tamsin')
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

test("a marketplace's palette keeps its pictures in files named with -- for the @ and the /", () => {
  const configHome = mkdtempSync(join(tmpdir(), 'ttheme-slash-'))
  const image = { width: 4, height: 4, data: new Uint8Array(64).fill(90) }
  const colors = { ...TAMSIN, name: 'kai@dust/pip' }
  installBackdrop(
    configHome,
    colors,
    toneFor(colors, 'cursor'),
    image,
    { site: 'yande', id: 9, ext: 'png', bytes: new Uint8Array([9]) },
    { width: 40, height: 20 },
    0,
  )
  const files = readdirSync(backgroundsDir(configHome))
  assert.ok(files.includes('kai--dust--pip.conf'))
  assert.ok(files.some((f) => /^kai--dust--pip\.[0-9a-f]{8}\.png$/.test(f)))
  assert.ok(readBackdrop(backgroundsDir(configHome), 'kai@dust/pip', configHome))
})

function figure(): Rgba {
  const data = new Uint8Array(16 * 16 * 4)

  for (let y = 2; y < 14; y++) {
    for (let x = 4; x < 12; x++) {
      data.set([40 + y * 12, 40 + y * 12, 40 + y * 12, 255], (y * 16 + x) * 4)
    }
  }

  return { width: 16, height: 16, data }
}

function installFigure(configHome: string, id: number): Picture {
  const image = figure()
  installBackdrop(
    configHome,
    TAMSIN,
    { color: '#9b86c8', opacity: 0.2 },
    image,
    { site: 'safebooru', id, ext: 'png', bytes: encodeRgba(image) },
    { width: 40, height: 20 },
    0,
  )

  return rackOf(configHome, 'tamsin')[0] as Picture
}

test('a picture file is the tone with the ink as its alpha, so a terminal lays the tint over the background itself', () => {
  const mask = { width: 3, height: 1, data: Uint8Array.from([0, 128, 255]) }
  const tone = [0x9b, 0x86, 0xc8]
  assert.deepEqual([...decodePng(encodeMask(mask, '#9b86c8')).data], [...tone, 0, ...tone, 128, ...tone, 255])
  const again = retone(encodeMask(mask, '#9b86c8'), '#123456')
  assert.ok(again)
  assert.deepEqual([...decodePng(again).data.subarray(4, 8)], [0x12, 0x34, 0x56, 128])
})

test('Warp gets a picture laid whole on the background, so no transparent part lets the window show through', () => {
  const image: Rgba = { width: 2, height: 1, data: Uint8Array.from([255, 0, 0, 255, 0, 255, 0, 0]) }
  const laid = flatten(image, '#204060', 0.5)
  assert.deepEqual([...laid.data], [144, 32, 48, 32, 64, 96])
  assert.deepEqual([...decodePng(encodeRgb(laid)).data], [144, 32, 48, 255, 32, 64, 96, 255])
})

test('a tone picture is laid on the background by swapping its palette, to the pixels flatten gives, and any other picture is left to flatten', () => {
  const mask = { width: 4, height: 2, data: Uint8Array.from([0, 1, 127, 128, 200, 254, 255, 77]) }
  const file = encodeMask(mask, '#9b86c8')

  for (const opacity of [1, 0.5]) {
    const laid = flatIndexed(file, '#204060', opacity)
    assert.ok(laid)
    const got = decodePng(laid)
    assert.deepEqual(
      [...got.data].filter((_, i) => i % 4 !== 3),
      [...flatten(decodePng(file), '#204060', opacity).data],
    )
    assert.ok(got.data.every((v, i) => i % 4 !== 3 || v === 255))
  }

  assert.equal(
    flatIndexed(encodeRgba({ width: 1, height: 1, data: Uint8Array.from([1, 2, 3, 4]) }), '#204060', 1),
    undefined,
  )
})

test('Warp gets a picture laid on the background where preview frames it, at its own size when Warp would enlarge it', () => {
  const image: Rgba = {
    width: 2,
    height: 2,
    data: Uint8Array.from([255, 0, 0, 255, 255, 0, 0, 0, 255, 0, 0, 255, 255, 0, 0, 255]),
  }

  const laid = flatten(image, '#000000', 0.5, { width: 3, height: 2, at: { x: 2, y: -1, w: 2, h: 2 } })
  assert.deepEqual([...laid.data], [0, 0, 0, 0, 0, 0, 128, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
  assert.deepEqual(canvasOf(image, '2912x2040', '4x4+10-20'), {
    width: 1456,
    height: 1020,
    at: { x: 5, y: -10, w: 2, h: 2 },
  })
  assert.deepEqual(canvasOf(image, '100x50', '1x1+3+4'), { width: 100, height: 50, at: { x: 3, y: 4, w: 1, h: 1 } })
  assert.throws(() => canvasOf(image, '100x50', '1x1'))
  const baked = lay(image, { width: 3, height: 2, at: { x: 2, y: -1, w: 2, h: 2 } })
  assert.deepEqual([...baked.data], [0, 0, 0, 0, 0, 0, 0, 0, 255, 0, 0, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
  assert.deepEqual([...decodePng(encodeRgba(baked)).data], [...baked.data])
})

test('a dim picture is lifted until its brightest part reaches the tone, at most twice, and a bright one is left alone', () => {
  const flat = (level: number) => ({
    width: 10,
    height: 10,
    data: new Uint8Array(400).map((_, i) => (i % 4 === 3 ? 255 : level)),
  })

  const box = { x: 0, y: 0, w: 10, h: 10 }
  assert.equal(liftOf(flat(60), box), 2)
  assert.equal(liftOf(flat(170), box), 1.5)
  assert.equal(liftOf(flat(255), box), 1)
})

test('a palette that changes its tone paints its pictures again, under new names, with their tuning', () => {
  const configHome = mkdtempSync(join(tmpdir(), 'ttheme-retint-'))
  const dir = backgroundsDir(configHome)
  const before = installFigure(configHome, 5)
  writeTune(dir, before, { size: 60, position: 'center' }, true, configHome)
  assert.deepEqual(retint(configHome, new Map([['tamsin', PAINT]])), [])
  assert.deepEqual(retint(configHome, new Map([['tamsin', { ...PAINT, hue: { color: '#5fa8d3', opacity: 0.15 } }]])), [
    'tamsin',
  ])
  const after = rackOf(configHome, 'tamsin')[0] as Picture
  assert.notEqual(after.stem, before.stem)
  assert.deepEqual([after.tone, after.opacity], ['#5fa8d3', before.opacity])

  for (const file of [`${after.stem}.png`, after.fill, `${after.stem}@60-center.png`]) {
    assert.deepEqual(
      [...decodePng(new Uint8Array(readFileSync(join(dir, file)))).data.subarray(0, 3)],
      [0x5f, 0xa8, 0xd3],
    )
  }

  assert.deepEqual(
    readdirSync(dir).filter((file) => file.startsWith(before.stem)),
    [],
  )
  assert.deepEqual(tuneOf(dir, after), { size: 60, position: 'center' })
  assert.equal(shownPath(dir), join(dir, after.fill))
})

test("every picture keeps a thumbnail of its fill for preview's strip, which a new tone repaints and one without gets back", () => {
  const configHome = mkdtempSync(join(tmpdir(), 'ttheme-thumb-'))
  const dir = backgroundsDir(configHome)
  const image = figure()

  installBackdrop(
    configHome,
    TAMSIN,
    PAINT.hue,
    image,
    { site: 'safebooru', id: 40, ext: 'png', bytes: encodeRgba(image) },
    { width: 400, height: 300 },
    0,
  )

  const thumb = (picture: Picture) => decodePng(new Uint8Array(readFileSync(join(dir, `${picture.stem}@thumb.png`))))
  const before = rackOf(configHome, 'tamsin')[0] as Picture
  const small = thumb(before)
  assert.deepEqual([small.width, small.height, ...small.data.subarray(0, 3)], [213, 160, 0x9b, 0x86, 0xc8])
  retint(configHome, new Map([['tamsin', { ...PAINT, hue: { color: '#5fa8d3', opacity: 0.15 } }]]))
  const after = rackOf(configHome, 'tamsin')[0] as Picture
  assert.deepEqual([...thumb(after).data.subarray(0, 3)], [0x5f, 0xa8, 0xd3])
  rmSync(join(dir, `${after.stem}@thumb.png`))
  assert.deepEqual(thumbless(configHome), [{ name: 'tamsin', key: after.key }])
  assert.equal(writeThumb(configHome, 'tamsin', after.key), true)
  assert.deepEqual([thumbless(configHome), thumb(after).height], [[], 160])
})

test('a picture drawn before its tone was kept is drawn again from its original, with its tuning and off switch', async () => {
  const configHome = mkdtempSync(join(tmpdir(), 'ttheme-redraw-'))
  const dir = backgroundsDir(configHome)
  const legacy = installFigure(configHome, 6)
  const store = readStore(dir)
  store.palettes.tamsin = {
    active: legacy.key,
    pictures: [{ key: legacy.key, stem: legacy.stem, fill: legacy.fill, opacity: 0.2, original: legacy.original }],
  }
  writeFileSync(join(dir, 'images.json'), JSON.stringify(store))
  writeFileSync(
    join(dir, `${legacy.stem}.tune.conf`),
    `background-image = ${join(dir, legacy.fill)}\nbackground-image-fit = cover\nbackground-image-position = bottom-left\nbackground-image-opacity = 0.3\n`,
  )
  writeFileSync(join(dir, `${legacy.stem}.off.conf`), 'background-image =\n')
  const picture = await redrawOne(configHome, 'tamsin', legacy.key, PAINT, 2, true, configHome)
  assert.ok(picture)
  applyRedraw(configHome, [{ name: 'tamsin', picture }])
  const after = rackOf(configHome, 'tamsin')[0] as Picture
  assert.notEqual(after.stem, legacy.stem)
  assert.deepEqual([after.tone, after.blur, after.window], ['#9b86c8', 2, { width: 40, height: 20 }])
  assert.deepEqual(tuneOf(dir, after), { position: 'bottom-left', opacity: 0.3 })
  assert.ok(existsSync(join(dir, `${after.stem}.off.conf`)))
  assert.deepEqual(
    readdirSync(dir).filter((file) => file.startsWith(legacy.stem)),
    [],
  )
})

function colorful(): Rgba {
  const data = new Uint8Array(16 * 16 * 4)

  for (let y = 2; y < 14; y++) {
    for (let x = 4; x < 12; x++) {
      data.set(y === 2 ? [255, 255, 255, 255] : [200, 60, 40, 255], (y * 16 + x) * 4)
    }
  }

  return { width: 16, height: 16, data }
}

function installColorful(configHome: string, id: number): Picture {
  const image = colorful()
  installBackdrop(
    configHome,
    TAMSIN,
    PAINT.hue,
    image,
    { site: 'safebooru', id, ext: 'png', bytes: encodeRgba(image) },
    { width: 40, height: 20 },
    0,
    'original',
  )

  return rackOf(configHome, 'tamsin')[0] as Picture
}

test('the peak of a picture is the color of its brightest 1% of visible pixels, and a clear pixel does not count', () => {
  const image = colorful()
  const box = { x: 4, y: 2, w: 8, h: 12 }
  assert.equal(peakOf(image, box), '#ffffff')
  const dark = { ...image, data: image.data.map((v, i) => (i % 4 === 3 ? v : Math.min(v, 90))) }
  assert.equal(peakOf(dark, box), '#5a5a5a')
  const clear = { ...image, data: image.data.slice() }

  for (let x = 4; x < 12; x++) {
    clear.data[(2 * 16 + x) * 4 + 3] = 0
  }

  assert.equal(peakOf(clear, { x: 0, y: 0, w: 16, h: 16 }), '#c83c28')
})

test('original colors are as faint as their brightest pixel needs, and the text still passes the gate on it', () => {
  const white = originalOpacity(TAMSIN, '#ffffff')
  const dark = originalOpacity(TAMSIN, '#5a5a5a')
  assert.ok(white < toneFor(TAMSIN, 'cursor').opacity, 'white is the worst pixel a picture can hold')
  assert.ok(dark > white, 'a dark picture may be drawn stronger')

  for (const [peak, opacity] of [
    ['#ffffff', white],
    ['#5a5a5a', dark],
  ] as const) {
    const under = mix(TAMSIN.background, peak, opacity)
    assert.deepEqual(
      checkReadability({ ...TAMSIN, background: under, waive: [] }),
      [],
      `${peak} at ${opacity} keeps the palette readable`,
    )
    assert.ok(luminance(under) <= luminance(mix('#19161e', '#9b86c8', 0.2)) + 1e-9)
  }
})

test('a picture drawn in its own colors keeps them, with the picture own alpha, and opens at the gate-safe opacity', () => {
  const configHome = mkdtempSync(join(tmpdir(), 'ttheme-colors-'))
  const dir = backgroundsDir(configHome)
  const picture = installColorful(configHome, 21)
  assert.deepEqual([picture.coloring, picture.tone, picture.peak], ['original', undefined, '#ffffff'])
  assert.equal(picture.opacity, originalOpacity(TAMSIN, '#ffffff'))
  assert.equal(coloringOf(picture), 'original')
  const figureFile = decodePng(new Uint8Array(readFileSync(join(dir, `${picture.stem}.png`))))
  assert.deepEqual([figureFile.width, figureFile.height], [8, 12])
  assert.deepEqual([...figureFile.data.subarray(0, 4)], [255, 255, 255, 255])
  assert.deepEqual([...figureFile.data.subarray(8 * 4, 8 * 4 + 4)], [200, 60, 40, 255])
  const conf = readFileSync(join(dir, 'tamsin.conf'), 'utf8')
  assert.ok(conf.includes(`# colors ${picture.key} original`))
  assert.ok(conf.includes(`background-image-opacity = ${picture.opacity}`))
  assert.equal(readBackdrop(dir, 'tamsin', configHome)?.opacity, picture.opacity)
})

test('a tone picture has no colors line, and a tuned size of an original-color picture keeps its colors', () => {
  const configHome = mkdtempSync(join(tmpdir(), 'ttheme-colors-tune-'))
  const dir = backgroundsDir(configHome)
  installFigure(configHome, 3)
  assert.ok(!readFileSync(join(dir, 'tamsin.conf'), 'utf8').includes('# colors'))
  const own = installColorful(configHome, 22)
  writeTune(dir, own, { size: 60, position: 'center' }, true, configHome)
  const tuned = decodePng(new Uint8Array(readFileSync(join(dir, `${own.stem}@60-center.png`))))

  const pixels = [
    ...new Set(
      Array.from({ length: tuned.width * tuned.height }, (_, i) => tuned.data.subarray(i * 4, i * 4 + 4).join(',')),
    ),
  ]

  assert.ok(pixels.includes('200,60,40,255'), 'the placed picture keeps its red')
  assert.ok(pixels.includes('0,0,0,0'), 'the rest of the canvas is clear')
})

test('a palette whose colors change leaves an original-color picture and its opacity as they are', () => {
  const configHome = mkdtempSync(join(tmpdir(), 'ttheme-colors-retint-'))
  const dir = backgroundsDir(configHome)
  const before = installColorful(configHome, 23)
  const dimmer = { ...PAINT, colors: { ...TAMSIN, foreground: '#b9b1c2' } }
  assert.deepEqual(retint(configHome, new Map([['tamsin', dimmer]])), [])
  assert.deepEqual(rackOf(configHome, 'tamsin')[0], before)
  assert.equal(readBackdrop(dir, 'tamsin', configHome)?.opacity, before.opacity)
})

test('drawing a picture in its other colors keeps its tuning, drops its opacity and takes the old files away', async () => {
  const configHome = mkdtempSync(join(tmpdir(), 'ttheme-colors-switch-'))
  const dir = backgroundsDir(configHome)
  const before = installFigure(configHome, 7)
  writeTune(dir, before, { size: 60, position: 'center', opacity: 0.3 }, true, configHome)
  const original = await redrawOne(configHome, 'tamsin', before.key, PAINT, 0, true, configHome, 'original')
  assert.ok(original)
  applyRedraw(configHome, [{ name: 'tamsin', picture: original }])
  const own = rackOf(configHome, 'tamsin')[0] as Picture
  assert.deepEqual([own.coloring, own.tone, own.peak !== undefined], ['original', undefined, true])
  assert.equal(own.opacity, originalOpacity(TAMSIN, own.peak as string))
  assert.deepEqual(tuneOf(dir, own), { size: 60, position: 'center' })
  assert.ok(existsSync(join(dir, `${own.stem}@60-center.png`)))
  assert.deepEqual(
    readdirSync(dir).filter((file) => file.startsWith(before.stem)),
    [],
  )
  const back = await redrawOne(configHome, 'tamsin', own.key, PAINT, 0, true, configHome, 'tone')
  assert.ok(back)
  applyRedraw(configHome, [{ name: 'tamsin', picture: back }])
  const tinted = rackOf(configHome, 'tamsin')[0] as Picture
  assert.deepEqual([tinted.coloring, tinted.tone, tinted.peak, tinted.opacity], ['tone', '#9b86c8', undefined, 0.2])
  assert.ok(!readFileSync(join(dir, 'tamsin.conf'), 'utf8').includes('# colors'))
})

test('a coloring drawn once is kept, so the other one can be got ready and going back needs no original', async () => {
  const configHome = mkdtempSync(join(tmpdir(), 'ttheme-drawn-'))
  const dir = backgroundsDir(configHome)
  const before = installFigure(configHome, 31)
  const original = join(dir, before.original as string)
  assert.equal(prepareOne(configHome, 'tamsin', before.key, PAINT, 0, 'original'), true)
  chmodSync(original, 0o000)

  try {
    const own = await redrawOne(configHome, 'tamsin', before.key, PAINT, 0, true, configHome, 'original')
    assert.ok(own)
    assert.equal(own.coloring, 'original')
    applyRedraw(configHome, [{ name: 'tamsin', picture: own }])
    const back = await redrawOne(configHome, 'tamsin', before.key, PAINT, 0, true, configHome, 'tone')
    assert.ok(back)
    assert.deepEqual([back.stem, back.fill, back.coloring], [before.stem, before.fill, 'tone'])
    applyRedraw(configHome, [{ name: 'tamsin', picture: back }])
    assert.ok(existsSync(join(dir, `${before.stem}.png`)) && existsSync(join(dir, before.fill)))
    assert.ok(!existsSync(join(dir, `${own.stem}.png`)))
  } finally {
    chmodSync(original, 0o644)
  }

  const own = await redrawOne(configHome, 'tamsin', before.key, PAINT, 0, true, configHome, 'original')
  assert.ok(own)
  applyRedraw(configHome, [{ name: 'tamsin', picture: own }])
  const bluer = { ...PAINT, hue: { color: '#336699', opacity: 0.2 } }
  const recolored = await redrawOne(configHome, 'tamsin', before.key, bluer, 0, true, configHome, 'tone')
  assert.ok(recolored)
  assert.deepEqual([recolored.tone, recolored.stem === before.stem], ['#336699', false])
})

test('a drawing kept for one tone serves a palette whose tone moved, as the picture a fresh drawing gives', async () => {
  const configHome = mkdtempSync(join(tmpdir(), 'ttheme-drawn-tone-'))
  const dir = backgroundsDir(configHome)
  const before = installFigure(configHome, 32)
  const bluer = { ...PAINT, hue: { color: '#336699', opacity: 0.2 } }
  assert.equal(prepareOne(configHome, 'tamsin', before.key, PAINT, 0, 'tone'), true)
  const original = join(dir, before.original as string)
  chmodSync(original, 0o000)

  try {
    const moved = await redrawOne(configHome, 'tamsin', before.key, bluer, 0, true, configHome, 'tone')
    assert.ok(moved)
    assert.deepEqual([moved.tone, moved.stem === before.stem], ['#336699', false])
    const fresh = mkdtempSync(join(tmpdir(), 'ttheme-drawn-fresh-'))
    const image = figure()

    installBackdrop(
      fresh,
      TAMSIN,
      bluer.hue,
      image,
      { site: 'safebooru', id: 32, ext: 'png', bytes: encodeRgba(image) },
      { width: 40, height: 20 },
      0,
    )

    assert.equal((rackOf(fresh, 'tamsin')[0] as Picture).stem, moved.stem)
  } finally {
    chmodSync(original, 0o644)
  }
})

test('trying a picture on in its own colors lays it over the background at the default opacity, straight alpha', () => {
  const held = inked(colorful())
  const tone = tryOn(held, TAMSIN, PAINT.hue, 40, 20, 0)
  const own = tryOn(held, TAMSIN, PAINT.hue, 40, 20, 0, undefined, 'original')
  assert.equal(tone.opacity, 0.2)
  assert.equal(own.opacity, originalOpacity(TAMSIN, '#ffffff'))
  assert.notDeepEqual([...own.image.data], [...tone.image.data])
  const stronger = tryOn(held, TAMSIN, PAINT.hue, 40, 20, 0, { opacity: 0.5 }, 'original')
  assert.equal(stronger.opacity, own.opacity, 'the default stays the default while a framing overrides it')
  const [r, g, b] = [0x19, 0x16, 0x1e]

  const wanted = [
    Math.round((r as number) + (200 - (r as number)) * 0.5),
    Math.round((g as number) + (60 - (g as number)) * 0.5),
    Math.round((b as number) + (40 - (b as number)) * 0.5),
  ]

  const pixels = Array.from({ length: 40 * 20 }, (_, i) => stronger.image.data.subarray(i * 4, i * 4 + 3).join())
  assert.ok(pixels.includes(wanted.join()), `some pixel is red at half strength, ${wanted}`)
})

test('blurring a picture in its own colors softens its edge without dimming the colors at it', () => {
  const configHome = mkdtempSync(join(tmpdir(), 'ttheme-colors-blur-'))
  const dir = backgroundsDir(configHome)
  const image = colorful()
  installBackdrop(
    configHome,
    TAMSIN,
    PAINT.hue,
    image,
    { site: 'safebooru', id: 24, ext: 'png', bytes: encodeRgba(image) },
    { width: 40, height: 20 },
    1.5,
    'original',
  )
  const picture = rackOf(configHome, 'tamsin')[0] as Picture
  const fill = decodePng(new Uint8Array(readFileSync(join(dir, picture.fill))))

  const soft = Array.from({ length: fill.width * fill.height }, (_, i) => fill.data.subarray(i * 4, i * 4 + 4)).filter(
    (px) => (px[3] as number) > 0 && (px[3] as number) < 255,
  )

  assert.ok(soft.length > 0, 'the edge has partial alpha')
  assert.ok(
    soft.every((px) => (px[0] as number) >= 195),
    'a partial pixel keeps its red instead of fading toward black',
  )
})
