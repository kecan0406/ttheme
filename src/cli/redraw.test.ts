import { spyOn } from 'bun:test'
import assert from 'node:assert/strict'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { inMode, type Manifest, type PaletteEntry } from '../core/manifest.ts'
import { encodeRgba, type Rgba } from '../core/png.ts'
import { STICKERING } from '../core/sticker.ts'
import {
  backgroundsDir,
  colorsOf,
  dropImage,
  installBackdrop,
  owedOf,
  type Picture,
  paintFor,
  rackOf,
  readStore,
  staleBy,
  standingOf,
  triedAs,
  type Work,
  workFor,
} from '../pictures/backdrop.ts'
import { readAvailable, writeBundled } from '../store/available.ts'
import { readInstalled, writeInstalled } from '../store/installed.ts'
import { shelfFor } from './craft.ts'
import { moveColors } from './init.ts'
import { bringPictures, owedPictures } from './pictures.ts'
import { redrawColoring, redrawPictures } from './redraw.ts'

const ORLA: PaletteEntry = {
  name: 'ttheme/orla',
  subject: 'tidewater/orla',
  background: '#11191c',
  foreground: '#e3e2e7',
  cursor: '#7cc1d6',
  selection: '#383b5b',
  ansi: Array.from({ length: 16 }, (_, i) => `#${(0x30 + i * 8).toString(16).repeat(3)}`),
  gate: [13.8, 6.8, 0.02, 10.4, 4.0],
  backdrop: { slot: 'cursor', color: '#7cc1d6', opacity: 0.2 },
}

const MANIFEST: Manifest = { version: '0.1.0', gate: [], palettes: [ORLA], works: [] }

function figure(): Rgba {
  const data = new Uint8Array(16 * 16 * 4)

  for (let y = 2; y < 14; y++) {
    for (let x = 4; x < 12; x++) {
      data.set([40 + y * 12, 40 + y * 12, 40 + y * 12, 255], (y * 16 + x) * 4)
    }
  }

  return { width: 16, height: 16, data }
}

function home(mode: 'dark' | 'light'): string {
  const configHome = mkdtempSync(join(tmpdir(), 'ttheme-redraw-'))
  mkdirSync(join(configHome, 'ttheme'), { recursive: true })
  writeFileSync(join(configHome, 'ttheme', 'config.zsh'), `: \${TTHEME_MODE:=${mode}}\n`)
  writeBundled(configHome, { builtin: MANIFEST, commons: { works: [] } })
  writeInstalled(configHome, { terminals: [], palettes: ['ttheme/orla'] })

  return configHome
}

function install(configHome: string, id = 7, original?: Uint8Array, site = 'safebooru'): Picture {
  const worn = readAvailable(configHome).palettes.find((entry) => entry.name === 'ttheme/orla') as PaletteEntry
  const image = figure()

  installBackdrop(
    configHome,
    colorsOf(worn),
    worn.backdrop,
    image,
    { site, id, ext: 'png', bytes: original ?? encodeRgba(image) },
    { width: 40, height: 20 },
    0,
    'tone',
    true,
  )

  return rackOf(configHome, 'ttheme/orla')[0] as Picture
}

test('a mode switch lays the other ink drawn with the picture, with no original to read, and it is the one a fresh install gives', async () => {
  const configHome = home('dark')
  const before = install(configHome)
  const lines: string[] = []
  assert.equal(await redrawPictures(configHome, (line) => lines.push(line), configHome, { emit: false }), 0)
  assert.equal(lines.length, 0)
  const dark = readAvailable(configHome).palettes.find((entry) => entry.name === 'ttheme/orla') as PaletteEntry
  const light = paintFor(inMode(dark, 'light'))
  assert.ok(existsSync(join(backgroundsDir(configHome), 'inks', `ttheme--orla-${before.key}.light.png`)))

  writeFileSync(join(configHome, 'ttheme', 'config.zsh'), ': ${TTHEME_MODE:=light}\n')
  const original = join(backgroundsDir(configHome), before.original as string)
  chmodSync(original, 0o000)

  try {
    lines.length = 0
    assert.equal(await redrawPictures(configHome, (line) => lines.push(line), configHome, { emit: false }), 1)
    assert.equal(lines.length, 0)
  } finally {
    chmodSync(original, 0o644)
  }

  const swapped = rackOf(configHome, 'ttheme/orla')[0] as Picture
  assert.deepEqual([swapped.light, swapped.tone], [true, light.hue.color])
  assert.notEqual(swapped.stem, before.stem)

  const fresh = install(home('light'))
  assert.equal(fresh.stem, swapped.stem)

  assert.equal(await redrawPictures(configHome, (line) => lines.push(line), configHome, { emit: false }), 0)
  assert.equal(lines.length, 0)
})

test('an update moves every tone picture to its own colors once, and leaves an install that sets tone alone', async () => {
  const configHome = home('dark')
  const before = install(configHome)
  assert.equal(before.coloring, 'tone')

  await moveColors(configHome, () => {}, configHome)

  const moved = rackOf(configHome, 'ttheme/orla')[0] as Picture
  assert.equal(moved.coloring, 'original')
  assert.notEqual(moved.stem, before.stem)
  assert.equal(readInstalled(configHome).colorsMoved, true)

  await redrawColoring(configHome, 'ttheme/orla', 'tone', moved.key, configHome)
  assert.equal((rackOf(configHome, 'ttheme/orla')[0] as Picture).coloring, 'tone')

  await moveColors(configHome, () => {}, configHome)
  assert.equal((rackOf(configHome, 'ttheme/orla')[0] as Picture).coloring, 'tone')

  const toneHome = home('dark')
  writeFileSync(join(toneHome, 'ttheme', 'config.zsh'), ': ${TTHEME_MODE:=dark}\n: ${TTHEME_BG_COLORS:=tone}\n')
  install(toneHome)

  await moveColors(toneHome, () => {}, toneHome)

  assert.equal((rackOf(toneHome, 'ttheme/orla')[0] as Picture).coloring, 'tone')
  assert.equal(readInstalled(toneHome).colorsMoved, true)
})

test('a picture whose original cannot be read stays in its tone without keeping the move from being made once', async () => {
  const configHome = home('dark')
  install(configHome)
  install(configHome, 8, new Uint8Array([8]))
  const coloring = (key: string) => rackOf(configHome, 'ttheme/orla').find((picture) => picture.key === key)?.coloring

  await moveColors(configHome, () => {}, configHome)
  assert.equal(coloring('safebooru_7'), 'original')
  assert.equal(coloring('safebooru_8'), 'tone')
  assert.equal(readInstalled(configHome).colorsMoved, true)

  await redrawColoring(configHome, 'ttheme/orla', 'tone', 'safebooru_7', configHome)
  await moveColors(configHome, () => {}, configHome)
  assert.equal(coloring('safebooru_7'), 'tone')
})

test('turning the sticker off draws each picture again once, and a picture with no original is left alone', async () => {
  const configHome = home('dark')
  const before = install(configHome)
  const lines: string[] = []
  const again = () => redrawPictures(configHome, (line) => lines.push(line), configHome, { emit: false })
  assert.equal(before.sticker, STICKERING)
  assert.equal(await again(), 0)

  writeFileSync(join(configHome, 'ttheme', 'config.zsh'), ': ${TTHEME_MODE:=dark}\n: ${TTHEME_BG_STICKER:=off}\n')
  assert.equal(await again(), 1)

  const off = rackOf(configHome, 'ttheme/orla')[0]
  assert.equal(off?.sticker, undefined)
  assert.equal(await again(), 0)

  const dir = backgroundsDir(configHome)
  const stored = readStore(dir)
  const held = stored.palettes['ttheme/orla']?.pictures[0]
  assert.ok(held)
  delete held.original
  writeFileSync(join(dir, 'images.json'), JSON.stringify(stored))
  writeFileSync(join(configHome, 'ttheme', 'config.zsh'), ': ${TTHEME_MODE:=dark}\n')
  lines.length = 0
  assert.equal(await again(), 0)
  assert.deepEqual(lines, [])
})

test('a picture the sticker cannot be drawn on says so once, and is not tried again on every sync', async () => {
  const configHome = home('dark')
  const worn = readAvailable(configHome).palettes.find((entry) => entry.name === 'ttheme/orla') as PaletteEntry

  installBackdrop(
    configHome,
    colorsOf(worn),
    worn.backdrop,
    figure(),
    { site: 'safebooru', id: 9, ext: 'png', bytes: new Uint8Array([9]) },
    { width: 40, height: 20 },
    0,
  )

  const lines: string[] = []
  const again = () => redrawPictures(configHome, (line) => lines.push(line), configHome, { emit: false })
  await again()
  assert.equal(lines.filter((line) => line.includes('left as it was')).length, 1)
  assert.equal(rackOf(configHome, 'ttheme/orla')[0]?.sticker, undefined)
  assert.equal(rackOf(configHome, 'ttheme/orla')[0]?.tried?.sticker, STICKERING)

  lines.length = 0
  assert.equal(await again(), 0)
  assert.deepEqual(lines, [])
})

test('a picture that cannot be drawn again says so once, then once more only when another drawing is asked of it', async () => {
  const configHome = home('dark')
  install(configHome)
  const dir = backgroundsDir(configHome)
  const stored = readStore(dir)
  const held = stored.palettes['ttheme/orla']?.pictures[0]
  assert.ok(held)
  const { tone: _tone, original: _original, ...bare } = held
  stored.palettes['ttheme/orla'] = { active: bare.key, pictures: [bare] }
  writeFileSync(join(dir, 'images.json'), JSON.stringify(stored))
  const lines: string[] = []
  const again = () => redrawPictures(configHome, (line) => lines.push(line), configHome, { emit: false })
  const said = () => lines.splice(0)
  const left = () => said().filter((line) => line.includes('left as it was'))
  assert.equal(await again(), 0)
  assert.deepEqual(left(), [`  ▢ ttheme/orla ${bare.key} — no original to draw it from, left as it was`])
  assert.equal(rackOf(configHome, 'ttheme/orla')[0]?.stem, bare.stem)
  assert.equal(await again(), 0)
  assert.equal(await again(), 0)
  assert.deepEqual(said(), [])

  writeFileSync(join(configHome, 'ttheme', 'config.zsh'), ': ${TTHEME_MODE:=dark}\n: ${TTHEME_BG_BLUR:=4}\n')
  assert.equal(await again(), 0)
  assert.equal(left().length, 1)
  assert.equal(await again(), 0)
  assert.deepEqual(said(), [])
})

test('a mode switch that finds neither the other ink nor an original says so once, not on every sync', async () => {
  const configHome = home('dark')
  const before = install(configHome)
  const dir = backgroundsDir(configHome)
  rmSync(join(dir, 'inks'), { recursive: true })
  rmSync(join(dir, before.original as string))
  writeFileSync(join(configHome, 'ttheme', 'config.zsh'), ': ${TTHEME_MODE:=light}\n')
  const lines: string[] = []
  const again = () => redrawPictures(configHome, (line) => lines.push(line), configHome, { emit: false })
  assert.equal(await again(), 0)
  assert.equal(lines.filter((line) => line.includes('left as it was')).length, 1)
  lines.length = 0
  assert.equal(await again(), 0)
  assert.deepEqual(lines, [])
  assert.equal(rackOf(configHome, 'ttheme/orla')[0]?.stem, before.stem)
})

test('what a picture needs is one answer: drawn again for its drawing, swapped for its mode, nothing once that was tried', () => {
  const configHome = home('dark')
  const picture = install(configHome)
  const worn = readAvailable(configHome).palettes.find((entry) => entry.name === 'ttheme/orla') as PaletteEntry
  const paint = paintFor(worn)
  const wanted = { paint, blur: 0, sticker: true }
  assert.deepEqual(standingOf(picture), { drawn: 'tinted', tone: paint.hue.color, light: false })
  assert.deepEqual(staleBy(picture, wanted), [])
  assert.equal(workFor(picture, wanted), undefined)
  assert.deepEqual(staleBy(picture, { ...wanted, blur: 3, sticker: false }), ['blur', 'sticker'])
  assert.equal(workFor(picture, { ...wanted, blur: 3 })?.by, 'draw')
  const light = { ...wanted, paint: paintFor(inMode(worn, 'light')) }
  assert.deepEqual(staleBy(picture, light), ['mode', 'tone'])
  const swap = workFor(picture, light)
  assert.equal(swap?.by, 'swap')
  assert.equal(workFor(picture, { ...light, blur: 3 })?.by, 'draw')
  assert.equal(workFor(triedAs(picture, (swap as Work).attempt), light), undefined)
  assert.equal(workFor(triedAs(picture, (swap as Work).attempt), wanted), undefined)
  assert.equal(workFor(triedAs(picture, (swap as Work).attempt), { ...light, blur: 3 })?.by, 'draw')
  assert.equal(workFor(picture, wanted, true)?.attempt.coloring, 'original')
  const { tone: _tone, ...old } = picture
  assert.deepEqual(standingOf(old), { drawn: 'never', source: true })
  assert.deepEqual(staleBy(old, wanted), ['undrawn'])
  assert.deepEqual(standingOf({ ...old, coloring: 'original' }), { drawn: 'original' })
})

test('a listed picture whose fetch failed is owed until it arrives, and one the user dropped is not', async () => {
  const configHome = home('dark')

  const listed = {
    ...ORLA,
    pictures: [
      { site: 'konachan', id: 7 },
      { site: 'konachan', id: 8 },
    ],
  }

  install(configHome, 8, undefined, 'konachan')
  const fetched = spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
  const said: string[] = []
  const log = spyOn(console, 'log').mockImplementation((line) => void said.push(String(line)))

  try {
    await bringPictures(configHome, [listed], [])
  } finally {
    fetched.mockRestore()
    log.mockRestore()
  }

  const dir = backgroundsDir(configHome)
  assert.equal(said.length, 1)
  assert.match(said[0] ?? '', /^ {2}▢ ttheme\/orla {2}konachan 7 — /)
  assert.deepEqual(owedOf(readStore(dir), 'ttheme/orla'), ['konachan_7'])
  assert.deepEqual(owedPictures(configHome, listed).pictures, [{ site: 'konachan', id: 7 }])
  dropImage(configHome, 'ttheme/orla', 'konachan_8')
  assert.deepEqual(owedPictures(configHome, listed).pictures, [{ site: 'konachan', id: 7 }])
  install(configHome, 7, undefined, 'konachan')
  assert.deepEqual(owedOf(readStore(dir), 'ttheme/orla'), [])
  assert.equal('owed' in readStore(dir), false)
  dropImage(configHome, 'ttheme/orla', 'konachan_7')
  assert.deepEqual(owedPictures(configHome, listed).pictures, [])
})

test('pictures added in an editor that is then cancelled go, and the picture that was up is up again', () => {
  const configHome = home('dark')
  install(configHome, 7)
  install(configHome, 8)
  const shelf = shelfFor(configHome, 'ttheme/orla')
  install(configHome, 9)
  assert.equal(shelf.added(), 1)
  shelf.discard()
  assert.deepEqual(
    rackOf(configHome, 'ttheme/orla').map((picture) => picture.key),
    ['safebooru_8', 'safebooru_7'],
  )
})
