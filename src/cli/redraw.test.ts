import assert from 'node:assert/strict'
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { inMode, type Manifest, type PaletteEntry, SCHEMA } from '../core/manifest.ts'
import { encodeRgba, type Rgba } from '../core/png.ts'
import {
  backgroundsDir,
  cached,
  colorsOf,
  installBackdrop,
  type Picture,
  paintFor,
  rackOf,
} from '../pictures/backdrop.ts'
import { readAvailable, writeOfficial } from '../store/available.ts'
import { readInstalled, writeInstalled } from '../store/installed.ts'
import { moveColors } from './init.ts'
import { redrawColoring, redrawPictures } from './redraw.ts'

process.env.XDG_CACHE_HOME = mkdtempSync(join(tmpdir(), 'ttheme-redraw-cache-'))

const GOJO: PaletteEntry = {
  name: 'gojo',
  catalog: 'Jujutsu Kaisen',
  order: 1,
  ansiSource: 'Horizon + Jujutsu',
  background: '#11191c',
  foreground: '#e3e2e7',
  cursor: '#7cc1d6',
  selection: '#383b5b',
  signature: ['#7cc1d6', '#e3e2e7', '#d7bcf3'],
  signatureSlots: ['cursor', 'foreground', 'ansi13'],
  ansi: Array.from({ length: 16 }, (_, i) => `#${(0x30 + i * 8).toString(16).repeat(3)}`),
  gate: [13.8, 6.8, 0.02, 10.4, 4.0],
  backdrop: { slot: 'cursor', color: '#7cc1d6', opacity: 0.2 },
}

const MANIFEST: Manifest = { schema: SCHEMA, version: '0.1.0', gate: [], palettes: [GOJO] }

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
  writeOfficial(configHome, MANIFEST)
  writeInstalled(configHome, { terminals: [], palettes: ['gojo'] })

  return configHome
}

function install(configHome: string): Picture {
  const worn = readAvailable(configHome).palettes.find((entry) => entry.name === 'gojo') as PaletteEntry
  const image = figure()

  installBackdrop(
    configHome,
    colorsOf(worn),
    worn.backdrop,
    image,
    { site: 'safebooru', id: 7, ext: 'png', bytes: encodeRgba(image) },
    { width: 40, height: 20 },
    0,
  )

  return rackOf(configHome, 'gojo')[0] as Picture
}

test('a mode switch lays the drawing of the other ink that was got ready, with no original to read, and it is the one a fresh install gives', async () => {
  const configHome = home('dark')
  const before = install(configHome)
  const lines: string[] = []
  assert.equal(await redrawPictures(configHome, (line) => lines.push(line), configHome, { emit: false }), 0)
  assert.deepEqual(lines, ['Drawing 1 background picture for the other mode'])
  const dark = readAvailable(configHome).palettes.find((entry) => entry.name === 'gojo') as PaletteEntry
  const light = paintFor(inMode(dark, 'light'))
  assert.equal(cached(configHome, 'gojo', before, light, 0, 'tone'), true)

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

  const swapped = rackOf(configHome, 'gojo')[0] as Picture
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

  const moved = rackOf(configHome, 'gojo')[0] as Picture
  assert.equal(moved.coloring, 'original')
  assert.notEqual(moved.stem, before.stem)
  assert.equal(readInstalled(configHome).colorsMoved, true)

  await redrawColoring(configHome, 'gojo', 'tone', moved.key, configHome)
  assert.equal((rackOf(configHome, 'gojo')[0] as Picture).coloring, 'tone')

  await moveColors(configHome, () => {}, configHome)
  assert.equal((rackOf(configHome, 'gojo')[0] as Picture).coloring, 'tone')

  const toneHome = home('dark')
  writeFileSync(join(toneHome, 'ttheme', 'config.zsh'), ': ${TTHEME_MODE:=dark}\n: ${TTHEME_BG_COLORS:=tone}\n')
  install(toneHome)

  await moveColors(toneHome, () => {}, toneHome)

  assert.equal((rackOf(toneHome, 'gojo')[0] as Picture).coloring, 'tone')
  assert.equal(readInstalled(toneHome).colorsMoved, true)
})
