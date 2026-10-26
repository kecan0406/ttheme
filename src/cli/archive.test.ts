import assert from 'node:assert/strict'
import { mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { test } from 'node:test'
import { type Colors, toneFor } from '../core/backdrop-tone.ts'
import { type Manifest, type PaletteEntry, toTheme } from '../core/manifest.ts'
import { WIRED, type Wired } from '../core/wired.ts'
import { installBackdrop } from '../pictures/backdrop.ts'
import type { Output } from '../terminals/emit/types.ts'
import { WIRINGS } from '../terminals/index.ts'
import { sync } from './sync.ts'

const colors: Colors = {
  name: 'ttheme/gojo',
  background: '#11191c',
  foreground: '#e3e2e7',
  cursor: '#7cc1d6',
  ansi: Array.from({ length: 16 }, (_, i) => `#${(i * 17).toString(16).padStart(2, '0')}8080`),
}

const entry: PaletteEntry = {
  name: 'ttheme/gojo',
  subject: 'jujutsu-kaisen/gojo',
  ansiSource: 'Horizon + Jujutsu',
  background: '#11191c',
  foreground: '#e3e2e7',
  cursor: '#7cc1d6',
  selection: '#383b5b',
  signature: ['#7cc1d6'],
  signatureSlots: ['cursor'],
  ansi: Array.from({ length: 16 }, (_, i) => `#${(i * 17).toString(16).padStart(2, '0')}8080`),
  gate: [],
  backdrop: { slot: 'cursor', color: '#7cc1d6', opacity: 0.2 },
  other: {
    background: '#f1fcf9',
    foreground: '#101918',
    cursor: '#005f5a',
    selection: '#cfe8e4',
    ansi: Array.from({ length: 16 }, (_, i) => `#${(i * 17).toString(16).padStart(2, '0')}2020`),
  },
}

const manifest: Manifest = { version: '0.1.0', gate: [], palettes: [entry], works: [] }

function fixture(): string {
  return mkdtempSync(join(tmpdir(), 'ttheme-archive-'))
}

function walk(dir: string): Map<string, string> {
  const files = new Map<string, string>()

  for (const name of readdirSync(dir)) {
    const path = join(dir, name)

    if (statSync(path).isDirectory()) {
      for (const [file, content] of walk(path)) {
        files.set(file, content)
      }
    } else {
      files.set(basename(path), readFileSync(path, 'utf8'))
    }
  }

  return files
}

function archiveOf(id: Wired): Output[] {
  const emitter = WIRINGS[id].emitter
  const theme = toTheme(entry)

  return [...(emitter.emit?.(theme) ?? []), ...(emitter.emitShared?.([theme]) ?? [])]
}

function installOf(id: Wired): Map<string, string> {
  const home = fixture()

  const state = {
    terminals: [id],
    palettes: ['ttheme/gojo'],
    ...(id === 'windows-terminal' ? { wtHome: join(home, 'wt'), wtProfile: 'the profile' } : {}),
  }

  installPicture(home)
  sync(home, manifest, state, home)

  return walk(home)
}

function installPicture(home: string): void {
  installBackdrop(
    home,
    { ...colors, name: 'ttheme/gojo' },
    toneFor(colors, 'cursor'),
    { width: 4, height: 4, data: new Uint8Array(64).fill(90) },
    { site: 'yande', id: 9, ext: 'png', bytes: new Uint8Array([9]) },
    { width: 40, height: 20 },
    0,
  )
}

function without(text: string, drop: RegExp): string {
  return text
    .split('\n')
    .filter((line) => !drop.test(line))
    .join('\n')
}

interface ItermColor {
  'Alpha Component': number
  'Blue Component': number
  'Color Space': string
  'Green Component': number
  'Red Component': number
}

interface ItermProfile {
  Name: string
  Guid: string
}

function plist(text: string): Map<string, ItermColor> {
  const colors = new Map<string, ItermColor>()

  for (const [, key, body] of text.matchAll(/<key>([^<]+)<\/key>\s*<dict>(.*?)<\/dict>/gs)) {
    const values = new Map<string, string | number>()

    for (const [, name, value] of body?.matchAll(
      /<key>([^<]+)<\/key>\s*<(?:real|string)>([^<]*)<\/(?:real|string)>/g,
    ) ?? []) {
      const number = Number(value)

      values.set(name as string, value !== '' && Number.isFinite(number) ? number : (value as string))
    }

    colors.set(key as string, {
      'Alpha Component': Number(values.get('Alpha Component')),
      'Blue Component': Number(values.get('Blue Component')),
      'Color Space': String(values.get('Color Space')),
      'Green Component': Number(values.get('Green Component')),
      'Red Component': Number(values.get('Red Component')),
    })
  }

  return colors
}

function iterm2Agrees(archive: Output[], install: Map<string, string>): void {
  const shipped = plist(archive[0]?.content as string)

  const profiles = (
    JSON.parse(install.get('ttheme.json') as string) as {
      Profiles: (ItermProfile & Record<string, string | ItermColor>)[]
    }
  ).Profiles

  const profile = profiles.find((p) => p.Name === 'ttheme · ttheme/gojo')

  assert.ok(profile, 'the install wrote no profile for the palette')
  assert.ok(shipped.size > 0, 'the archive shipped no colors')

  for (const [key, color] of shipped) {
    assert.deepEqual(profile[key], color, `the archive's ${key} and the install's differ`)
  }
}

function windowsTerminalAgrees(archive: Output[], install: Map<string, string>): void {
  const fragment = install.get('ttheme.json') as string
  const shipped = archive.find((file) => file.path.endsWith('/ttheme.json')) as Output
  const scheme = archive.find((file) => file.path.includes('/schemes/')) as Output
  const installed = JSON.parse(fragment) as { profiles?: unknown; schemes: unknown[] }
  const { profiles: _profiles, ...rest } = installed

  assert.deepEqual(rest, JSON.parse(shipped.content))
  assert.deepEqual(installed.schemes[0], JSON.parse(scheme.content))
}

function konsoleAgrees(archive: Output[], install: Map<string, string>): void {
  const scheme = install.get('ttheme-ttheme--gojo.colorscheme') as string

  assert.equal(
    without(scheme, /^(Wallpaper|FillStyle|Anchor|WallpaperOpacity)=/),
    without(archive[0]?.content as string, /^(Wallpaper|FillStyle|Anchor|WallpaperOpacity)=/),
  )
  assert.match(archive[0]?.content as string, /^Wallpaper=$/m)
  assert.match(scheme, /^Wallpaper=.+$/m)
}

const DECLARED: Partial<Record<Wired, Record<string, string>>> = {
  iterm2: {
    'ttheme-ttheme--gojo.itermcolors': 'the install writes a dynamic profile per palette, not a color scheme plist',
  },
  'windows-terminal': {
    'ttheme-ttheme--gojo.json': 'the install keeps the scheme in its fragment',
    'ttheme.json': "the install's fragment names the profile to update; the archive's registers the schemes alone",
  },
  konsole: {
    'ttheme-ttheme--gojo.colorscheme': "the install's scheme carries the palette's picture; the archive's has none",
  },
}

const CHECKERS: Partial<Record<Wired, (archive: Output[], install: Map<string, string>) => void>> = {
  iterm2: iterm2Agrees,
  'windows-terminal': windowsTerminalAgrees,
  konsole: konsoleAgrees,
}

test('every file a terminal ships reaches the machine the same way the install writes it', () => {
  for (const id of WIRED) {
    const archive = archiveOf(id)
    const install = installOf(id)
    const declared = DECLARED[id] ?? {}

    for (const file of archive) {
      const name = basename(file.path)

      if (name in declared) {
        continue
      }

      const shipped = install.get(name)

      assert.ok(shipped, `${id}: the archive ships ${file.path}, the install writes no ${name}`)
      assert.equal(shipped, file.content, `${id}: the archive's ${file.path} and the install's ${name} differ`)
    }
  }
})

test('the terminals whose install writes another form of what they ship say which file it is', () => {
  for (const id of WIRED) {
    const archive = archiveOf(id)
    const install = installOf(id)
    const checker = CHECKERS[id]

    if (!checker) {
      continue
    }

    checker(archive, install)
  }
})

test('a terminal names every file it ships in another form, and no other', () => {
  for (const id of WIRED) {
    const declared = Object.keys(DECLARED[id] ?? {})
    const shipped = archiveOf(id).map((file) => basename(file.path))

    assert.deepEqual(
      declared.filter((name) => !shipped.includes(name)),
      [],
    )
  }
})

test('a terminal that ships a file in another form has a check that says how', () => {
  assert.deepEqual(Object.keys(DECLARED).sort(), Object.keys(CHECKERS).sort())
})
