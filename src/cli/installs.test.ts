import { spyOn } from 'bun:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import * as p from '@clack/prompts'
import type { Commons } from '../core/commons.ts'
import { codeOf, draftOf, paletteToml, SHARE_URL, shareLink } from '../core/draft.ts'
import type { Manifest, PaletteEntry } from '../core/manifest.ts'
import { fromCode, shareCode } from '../core/own.ts'
import { writeBundled } from '../store/available.ts'
import { readInstalled, writeInstalled } from '../store/installed.ts'
import { writeTone } from '../store/tone.ts'
import * as terminal from '../tui/terminal.ts'
import { runAdd, runDefault } from './installs.ts'
import { checkMarketplace, runMarketplace, withMarketplaces } from './marketplaces.ts'
import { runShare } from './share.ts'
import { sync } from './sync.ts'

function entry(name: string): PaletteEntry {
  return {
    name,
    subject: `jujutsu-kaisen/${name.slice(name.indexOf('/') + 1)}`,
    ansiSource: 'Horizon + Jujutsu',
    background: '#11191c',
    foreground: '#e3e2e7',
    cursor: '#7cc1d6',
    selection: '#383b5b',
    signature: ['#7cc1d6', '#e3e2e7', '#d7bcf3'],
    signatureSlots: ['cursor', 'foreground', 'ansi13'],
    ansi: Array.from({ length: 16 }, () => '#808080'),
    gate: [13.8, 6.8, 0.02, 10.4, 4.0],
    backdrop: { slot: 'cursor', color: '#7cc1d6', opacity: 0.2 },
  }
}

const manifest: Manifest = {
  version: '0.1.0',
  gate: [],
  palettes: [entry('ttheme/gojo'), entry('ttheme/geto'), entry('ttheme/sukuna')],
  works: [],
}

const commons: Commons = {
  works: [{ id: 'jujutsu-kaisen', name: 'Jujutsu Kaisen', native: '呪術廻戦', characters: [{ id: 'gojo' }] }],
  renames: {},
}

function installedHome(palettes: string[]): string {
  const home = mkdtempSync(join(tmpdir(), 'ttheme-marketplace-'))
  const state = { terminals: ['ghostty' as const], palettes }
  writeBundled(home, { builtin: manifest, commons })
  writeInstalled(home, state)
  sync(home, manifest, state)

  return home
}

async function withHome<T>(home: string, run: () => Promise<T>): Promise<T> {
  const saved = process.env.XDG_CONFIG_HOME
  const log = spyOn(console, 'log').mockImplementation(() => {})
  process.env.XDG_CONFIG_HOME = home

  try {
    return await run()
  } finally {
    log.mockRestore()

    if (saved === undefined) {
      delete process.env.XDG_CONFIG_HOME
    } else {
      process.env.XDG_CONFIG_HOME = saved
    }
  }
}

function inHome<T>(home: string, run: () => T): T {
  const saved = process.env.XDG_CONFIG_HOME
  process.env.XDG_CONFIG_HOME = home
  const log = console.log
  console.log = () => {}

  try {
    return run()
  } finally {
    console.log = log

    if (saved === undefined) {
      delete process.env.XDG_CONFIG_HOME
    } else {
      process.env.XDG_CONFIG_HOME = saved
    }
  }
}

test('a kept default survives a later add, each named by its palette name alone', () => {
  const home = installedHome(['ttheme/gojo', 'ttheme/geto'])
  inHome(home, () => {
    runDefault('geto')
    runAdd(['sukuna'])
  })
  assert.equal(readInstalled(home).startup, 'ttheme/geto')
  assert.deepEqual(readInstalled(home).palettes, ['ttheme/gojo', 'ttheme/geto', 'ttheme/sukuna'])
  assert.match(readFileSync(join(home, 'ttheme', 'ghostty.conf'), 'utf8'), /^theme = ttheme-ttheme--geto\.dark$/m)
})

test('default turns ttheme back on', () => {
  const home = installedHome(['ttheme/gojo', 'ttheme/geto'])
  writeInstalled(home, { terminals: ['ghostty'], off: true, palettes: ['ttheme/gojo', 'ttheme/geto'] })
  inHome(home, () => runDefault('ttheme/geto'))
  assert.equal(readInstalled(home).off, undefined)
  assert.match(readFileSync(join(home, 'ttheme', 'ghostty.conf'), 'utf8'), /^theme = ttheme-ttheme--geto\.dark$/m)
})

test('default refuses a palette that is not installed', () => {
  const home = installedHome(['ttheme/gojo'])
  assert.throws(() => inHome(home, () => runDefault('geto')), /ttheme\/geto is not installed/)
  assert.equal(readInstalled(home).startup, undefined)
})

test('a share link to a palette already in a marketplace installs it, and one with other colors is refused', async () => {
  const home = installedHome(['ttheme/gojo'])
  const geto = manifest.palettes[1] as PaletteEntry
  await inHome(home, () => runAdd([shareLink(shareCode([draftOf(geto)]))]))
  assert.deepEqual(readInstalled(home).palettes, ['ttheme/gojo', 'ttheme/geto'])
  const sukuna = shareLink(shareCode([{ ...draftOf(manifest.palettes[2] as PaletteEntry), background: '#000000' }]))
  await assert.rejects(
    inHome(home, () => runAdd([sukuna])),
    /ttheme\/sukuna is already in the built-in marketplace and differs/,
  )
})

test('a share link with several palettes installs each one it can and skips one whose colors differ', async () => {
  const home = installedHome(['ttheme/gojo'])
  const geto = draftOf(manifest.palettes[1] as PaletteEntry)
  const sukuna = { ...draftOf(manifest.palettes[2] as PaletteEntry), background: '#000000' }
  await inHome(home, () => runAdd([shareLink(shareCode([geto, sukuna]))]))
  assert.deepEqual(readInstalled(home).palettes, ['ttheme/gojo', 'ttheme/geto'])
})

test('a palette file joins your local marketplace under its file name and installs, and a changed copy is not taken over it', async () => {
  const home = installedHome(['ttheme/gojo'])
  writeInstalled(home, { ...readInstalled(home), author: 'kec' })
  await inHome(home, () => runMarketplace('init', 'mine'))
  const dir = mkdtempSync(join(tmpdir(), 'ttheme-file-'))
  const file = join(dir, 'kisara.toml')
  const kisara = { ...draftOf(manifest.palettes[1] as PaletteEntry), name: 'kec@mine/kisara', background: '#101010' }
  writeFileSync(file, paletteToml(kisara))
  writeFileSync(join(dir, 'kisara (1).toml'), paletteToml(kisara))
  await assert.rejects(
    inHome(home, () => runAdd([join(dir, 'kisara (1).toml')])),
    /the palette is named after its file, and "kisara \(1\)" takes lowercase letters/,
  )
  await inHome(home, () => runAdd([file]))
  assert.deepEqual(readInstalled(home).palettes, ['ttheme/gojo', 'kec@mine/kisara'])
  const kept = join(home, 'ttheme', 'marketplace', 'mine', 'palettes', 'kisara.toml')
  assert.equal(readFileSync(kept, 'utf8'), readFileSync(file, 'utf8'))
  await inHome(home, () => runAdd([file]))
  writeFileSync(file, paletteToml({ ...kisara, background: '#202020' }))
  await assert.rejects(
    inHome(home, () => runAdd([file])),
    /kec@mine\/kisara already exists/,
  )
  assert.match(readFileSync(kept, 'utf8'), /#101010/)
})

async function sharedLink(home: string, names: string[]): Promise<string> {
  const saved = process.env.XDG_CONFIG_HOME
  const said: string[] = []
  const log = spyOn(console, 'log').mockImplementation((line: string) => void said.push(line))
  const error = spyOn(console, 'error').mockImplementation(() => {})
  process.env.XDG_CONFIG_HOME = home

  try {
    await runShare(names, 'tuned')
  } finally {
    log.mockRestore()
    error.mockRestore()

    if (saved === undefined) {
      delete process.env.XDG_CONFIG_HOME
    } else {
      process.env.XDG_CONFIG_HOME = saved
    }
  }

  return said.find((line) => line.startsWith(SHARE_URL)) ?? ''
}

test('a tuned palette travels by its name alone, made from the original, and joins the local marketplace of whoever adds it', async () => {
  const sender = installedHome(['ttheme/gojo', 'ttheme/geto'])
  writeTone(sender, { 'ttheme/geto': { dark: { cursor: '#ff8800' } } })
  const link = await sharedLink(sender, ['geto', 'gojo'])

  assert.deepEqual(
    fromCode(codeOf(link) as string).map((d) => [d.name, d.subject, d.from, d.cursor]),
    [
      ['geto-tuned', 'jujutsu-kaisen/geto', 'ttheme/geto', '#ff8800'],
      ['ttheme/gojo', 'jujutsu-kaisen/gojo', undefined, '#7cc1d6'],
    ],
  )

  const receiver = installedHome(['ttheme/geto'])
  writeInstalled(receiver, { ...readInstalled(receiver), author: 'kec' })
  await inHome(receiver, () => runMarketplace('init', 'mine'))
  await inHome(receiver, () => runAdd([link]))
  assert.deepEqual(readInstalled(receiver).palettes, ['ttheme/geto', 'kec@mine/geto-tuned', 'ttheme/gojo'])
  const filed = readFileSync(join(receiver, 'ttheme', 'marketplace', 'mine', 'palettes', 'geto-tuned.toml'), 'utf8')
  assert.match(filed, /^subject = "jujutsu-kaisen\/geto"$/m)
  assert.match(filed, /^from = "ttheme\/geto"$/m)
  assert.match(filed, /^cursor = "#ff8800"$/m)
  writeFileSync(
    join(receiver, 'ttheme', 'marketplace', 'mine', 'palettes', 'geto-tuned.toml'),
    filed.replace('#ff8800', '#00ff88'),
  )
  await assert.rejects(
    inHome(receiver, () => runAdd([link])),
    /kec@mine\/geto-tuned already exists/,
  )
})

test('adding a palette file, or a link with a tuned palette, before you have a local marketplace makes one, keeps it and proposes what the commons lacks', async () => {
  const geto = manifest.palettes[1] as PaletteEntry
  const file = join(mkdtempSync(join(tmpdir(), 'ttheme-file-')), 'kisara.toml')
  writeFileSync(file, paletteToml({ ...draftOf(geto), name: 'kisara' }))
  const link = shareLink(shareCode([{ ...draftOf(geto), name: 'geto-tuned', from: 'ttheme/geto', cursor: '#ff8800' }]))
  const named = spyOn(p, 'text').mockImplementation(async () => 'mine')
  const asking = spyOn(terminal, 'interactive').mockReturnValue(true)

  try {
    for (const [asked, name] of [
      [file, 'kec@mine/kisara'],
      [link, 'kec@mine/geto-tuned'],
    ] as const) {
      const home = installedHome(['ttheme/gojo'])
      const mine = join(home, 'ttheme', 'marketplace', 'mine')
      writeInstalled(home, { ...readInstalled(home), author: 'kec' })
      await withHome(home, () => runAdd([asked]))
      assert.deepEqual(readInstalled(home).palettes, ['ttheme/gojo', name])
      assert.deepEqual(readInstalled(home).marketplaces, ['ttheme', mine])
      assert.equal(
        readFileSync(join(mine, 'works', 'jujutsu-kaisen.toml'), 'utf8')
          .split('\n')
          .slice(1)
          .join('\n'),
        'name = "Jujutsu Kaisen"\nnative = "呪術廻戦"\n\n[[character]]\nid = "geto"\n',
      )
      assert.equal(await withHome(home, async () => checkMarketplace(mine, commons)), 0)
    }
  } finally {
    named.mockRestore()
    asking.mockRestore()
  }
})

test('two tuned palettes of one name each travel under a name of their own, and a palette named twice travels once', async () => {
  const sender = installedHome(['ttheme/gojo', 'ttheme/geto'])
  writeInstalled(sender, { ...readInstalled(sender), author: 'kec' })
  await withHome(sender, () => runMarketplace('init', 'mine'))
  const file = join(mkdtempSync(join(tmpdir(), 'ttheme-file-')), 'geto.toml')
  writeFileSync(file, paletteToml({ ...draftOf(manifest.palettes[1] as PaletteEntry), background: '#101010' }))
  await withHome(sender, () => runAdd([file]))

  writeTone(sender, {
    'ttheme/geto': { dark: { cursor: '#ff8800' } },
    'kec@mine/geto': { dark: { cursor: '#88ff00' } },
  })

  const link = await sharedLink(sender, ['ttheme/geto', 'kec@mine/geto', 'ttheme/geto'])

  assert.deepEqual(
    fromCode(codeOf(link) as string).map((d) => [d.name, d.from, d.cursor]),
    [
      ['geto-tuned', 'ttheme/geto', '#ff8800'],
      ['geto-tuned-2', 'kec@mine/geto', '#88ff00'],
    ],
  )
})

test('installed.json keeps an auto-update setting only where it differs from the default', () => {
  const state = { terminals: ['ghostty' as const], palettes: [] }

  const next = withMarketplaces(state, ['ttheme', 'alice/pastel', 'bob/neon'], {
    ttheme: true,
    'alice/pastel': true,
    'bob/neon': false,
    'carol/gone': true,
  })

  assert.deepEqual(next.marketplaces, ['ttheme', 'alice/pastel', 'bob/neon'])
  assert.deepEqual(next.updates, { 'alice/pastel': true })
  assert.equal(withMarketplaces(state, ['ttheme'], { ttheme: true }).updates, undefined)
})
