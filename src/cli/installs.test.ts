import { spyOn } from 'bun:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import * as p from '@clack/prompts'
import type { Commons } from '../core/commons.ts'
import { codeOf, draftOf, paletteToml, SHARE_URL, shareLink } from '../core/draft.ts'
import type { Manifest, PaletteEntry } from '../core/manifest.ts'
import { fromCode, shareCode } from '../core/own.ts'
import { setText } from '../core/sets.ts'
import { writeBundled } from '../store/available.ts'
import { readInstalled, writeInstalled } from '../store/installed.ts'
import { writeTone } from '../store/tone.ts'
import * as terminal from '../tui/terminal.ts'
import { runEdit } from './craft.ts'
import { runAdd, runDefault } from './installs.ts'
import { checkMarketplace, runMarketplace, withMarketplaces } from './marketplaces.ts'
import { runShare } from './share.ts'
import { sync } from './sync.ts'

function entry(name: string): PaletteEntry {
  return {
    name,
    subject: `tidewater/${name.slice(name.indexOf('/') + 1)}`,
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
  palettes: [entry('ttheme/orla'), entry('ttheme/juno'), entry('ttheme/wren')],
  works: [],
}

const commons: Commons = {
  works: [{ id: 'tidewater', name: 'Tidewater', native: '潮汐', characters: [{ id: 'orla' }] }],
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
  const home = installedHome(['ttheme/orla', 'ttheme/juno'])
  inHome(home, () => {
    runDefault('juno')
    runAdd(['wren'])
  })
  assert.equal(readInstalled(home).startup, 'ttheme/juno')
  assert.deepEqual(readInstalled(home).palettes, ['ttheme/orla', 'ttheme/juno', 'ttheme/wren'])
  assert.match(readFileSync(join(home, 'ttheme', 'ghostty.conf'), 'utf8'), /^theme = ttheme-ttheme--juno\.dark$/m)
})

test('default turns ttheme back on', () => {
  const home = installedHome(['ttheme/orla', 'ttheme/juno'])
  writeInstalled(home, { terminals: ['ghostty'], off: true, palettes: ['ttheme/orla', 'ttheme/juno'] })
  inHome(home, () => runDefault('ttheme/juno'))
  assert.equal(readInstalled(home).off, undefined)
  assert.match(readFileSync(join(home, 'ttheme', 'ghostty.conf'), 'utf8'), /^theme = ttheme-ttheme--juno\.dark$/m)
})

test('default refuses a palette that is not installed', () => {
  const home = installedHome(['ttheme/orla'])
  assert.throws(() => inHome(home, () => runDefault('juno')), /ttheme\/juno is not installed/)
  assert.equal(readInstalled(home).startup, undefined)
})

test('a share link to a palette already in a marketplace installs it, and one with other colors is refused', async () => {
  const home = installedHome(['ttheme/orla'])
  const juno = manifest.palettes[1] as PaletteEntry
  await inHome(home, () => runAdd([shareLink(shareCode([draftOf(juno)]))]))
  assert.deepEqual(readInstalled(home).palettes, ['ttheme/orla', 'ttheme/juno'])
  const wren = shareLink(shareCode([{ ...draftOf(manifest.palettes[2] as PaletteEntry), background: '#000000' }]))
  await assert.rejects(
    inHome(home, () => runAdd([wren])),
    /ttheme\/wren is already in the built-in marketplace and differs/,
  )
})

test('a share link with several palettes installs each one it can and skips one whose colors differ', async () => {
  const home = installedHome(['ttheme/orla'])
  const juno = draftOf(manifest.palettes[1] as PaletteEntry)
  const wren = { ...draftOf(manifest.palettes[2] as PaletteEntry), background: '#000000' }
  await inHome(home, () => runAdd([shareLink(shareCode([juno, wren]))]))
  assert.deepEqual(readInstalled(home).palettes, ['ttheme/orla', 'ttheme/juno'])
})

test('a set file joins your local marketplace under its slug and installs, and a changed copy is not taken over it', async () => {
  const home = installedHome(['ttheme/orla'])
  writeInstalled(home, { ...readInstalled(home), author: 'kai' })
  await inHome(home, () => runMarketplace('init', 'mine'))
  const dir = mkdtempSync(join(tmpdir(), 'ttheme-file-'))
  const file = join(dir, 'pip.toml')
  const pip = { ...draftOf(manifest.palettes[1] as PaletteEntry), name: 'kai@mine/pip', background: '#101010' }
  writeFileSync(file, setText([{ slug: 'pip', text: paletteToml(pip) }]))
  writeFileSync(join(dir, 'pip (1).toml'), setText([{ slug: 'pip (1)', text: paletteToml(pip) }]))
  await assert.rejects(
    inHome(home, () => runAdd([join(dir, 'pip (1).toml')])),
    /the slug "pip \(1\)" takes lowercase letters/,
  )
  await inHome(home, () => runAdd([file]))
  assert.deepEqual(readInstalled(home).palettes, ['ttheme/orla', 'kai@mine/pip'])
  const kept = join(home, 'ttheme', 'marketplace', 'mine', 'sets', 'tidewater.toml')
  assert.equal(readFileSync(kept, 'utf8'), readFileSync(file, 'utf8'))
  await inHome(home, () => runAdd([file]))
  writeFileSync(file, setText([{ slug: 'pip', text: paletteToml({ ...pip, background: '#202020' }) }]))
  await assert.rejects(
    inHome(home, () => runAdd([file])),
    /kai@mine\/pip already exists/,
  )
  assert.match(readFileSync(kept, 'utf8'), /#101010/)
})

test('a set file adds each palette in it, each to the set of its work in your local marketplace', async () => {
  const home = installedHome(['ttheme/orla'])
  writeInstalled(home, { ...readInstalled(home), author: 'kai' })
  await inHome(home, () => runMarketplace('init', 'mine'))
  const juno = draftOf(manifest.palettes[1] as PaletteEntry)
  const file = join(mkdtempSync(join(tmpdir(), 'ttheme-file-')), 'mix.toml')

  writeFileSync(
    file,
    setText([
      { slug: 'pip', text: paletteToml({ ...juno, background: '#101010' }) },
      { slug: 'dawn', text: paletteToml({ ...juno, subject: undefined, background: '#202020' }) },
    ]),
  )

  await inHome(home, () => runAdd([file]))
  assert.deepEqual(readInstalled(home).palettes, ['ttheme/orla', 'kai@mine/pip', 'kai@mine/dawn'])
  assert.deepEqual(readdirSync(join(home, 'ttheme', 'marketplace', 'mine', 'sets')).sort(), [
    'original.toml',
    'tidewater.toml',
  ])
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
  const sender = installedHome(['ttheme/orla', 'ttheme/juno'])
  writeTone(sender, { 'ttheme/juno': { dark: { cursor: '#ff8800' } } })
  const link = await sharedLink(sender, ['juno', 'orla'])

  assert.deepEqual(
    fromCode(codeOf(link) as string).map((d) => [d.name, d.subject, d.from, d.cursor]),
    [
      ['juno-tuned', 'tidewater/juno', 'ttheme/juno', '#ff8800'],
      ['ttheme/orla', 'tidewater/orla', undefined, '#7cc1d6'],
    ],
  )

  const receiver = installedHome(['ttheme/juno'])
  writeInstalled(receiver, { ...readInstalled(receiver), author: 'kai' })
  await inHome(receiver, () => runMarketplace('init', 'mine'))
  await inHome(receiver, () => runAdd([link]))
  assert.deepEqual(readInstalled(receiver).palettes, ['ttheme/juno', 'kai@mine/juno-tuned', 'ttheme/orla'])
  const filed = readFileSync(join(receiver, 'ttheme', 'marketplace', 'mine', 'sets', 'tidewater.toml'), 'utf8')
  assert.match(filed, /^subject = "tidewater\/juno"$/m)
  assert.match(filed, /^from = "ttheme\/juno"$/m)
  assert.match(filed, /^cursor = "#ff8800"$/m)
  writeFileSync(
    join(receiver, 'ttheme', 'marketplace', 'mine', 'sets', 'tidewater.toml'),
    filed.replace('#ff8800', '#00ff88'),
  )
  await assert.rejects(
    inHome(receiver, () => runAdd([link])),
    /kai@mine\/juno-tuned already exists/,
  )
})

test('adding a set file, or a link with a tuned palette, before you have a local marketplace makes one, keeps it and proposes what the commons lacks', async () => {
  const juno = manifest.palettes[1] as PaletteEntry
  const file = join(mkdtempSync(join(tmpdir(), 'ttheme-file-')), 'pip.toml')
  writeFileSync(file, setText([{ slug: 'pip', text: paletteToml(draftOf(juno)) }]))
  const link = shareLink(shareCode([{ ...draftOf(juno), name: 'juno-tuned', from: 'ttheme/juno', cursor: '#ff8800' }]))
  const named = spyOn(p, 'text').mockImplementation(async () => 'mine')
  const asking = spyOn(terminal, 'interactive').mockReturnValue(true)

  try {
    for (const [asked, name] of [
      [file, 'kai@mine/pip'],
      [link, 'kai@mine/juno-tuned'],
    ] as const) {
      const home = installedHome(['ttheme/orla'])
      const mine = join(home, 'ttheme', 'marketplace', 'mine')
      writeInstalled(home, { ...readInstalled(home), author: 'kai' })
      await withHome(home, () => runAdd([asked]))
      assert.deepEqual(readInstalled(home).palettes, ['ttheme/orla', name])
      assert.deepEqual(readInstalled(home).marketplaces, ['ttheme', mine])
      assert.equal(
        readFileSync(join(mine, 'works', 'tidewater.toml'), 'utf8')
          .split('\n')
          .slice(1)
          .join('\n'),
        'name = "Tidewater"\nnative = "潮汐"\n\n[[character]]\nid = "juno"\n',
      )
      assert.equal(await withHome(home, async () => checkMarketplace(mine, commons)), 0)
    }
  } finally {
    named.mockRestore()
    asking.mockRestore()
  }
})

test('two tuned palettes of one name each travel under a name of their own, and a palette named twice travels once', async () => {
  const sender = installedHome(['ttheme/orla', 'ttheme/juno'])
  writeInstalled(sender, { ...readInstalled(sender), author: 'kai' })
  await withHome(sender, () => runMarketplace('init', 'mine'))
  const file = join(mkdtempSync(join(tmpdir(), 'ttheme-file-')), 'juno.toml')
  writeFileSync(
    file,
    setText([
      { slug: 'juno', text: paletteToml({ ...draftOf(manifest.palettes[1] as PaletteEntry), background: '#101010' }) },
    ]),
  )
  await withHome(sender, () => runAdd([file]))

  writeTone(sender, {
    'ttheme/juno': { dark: { cursor: '#ff8800' } },
    'kai@mine/juno': { dark: { cursor: '#88ff00' } },
  })

  const link = await sharedLink(sender, ['ttheme/juno', 'kai@mine/juno', 'ttheme/juno'])

  assert.deepEqual(
    fromCode(codeOf(link) as string).map((d) => [d.name, d.from, d.cursor]),
    [
      ['juno-tuned', 'ttheme/juno', '#ff8800'],
      ['juno-tuned-2', 'kai@mine/juno', '#88ff00'],
    ],
  )
})

test('edit asks which palette a name two share means, and says why your own palette of that name does not read', async () => {
  const home = installedHome(['ttheme/orla'])
  writeInstalled(home, { ...readInstalled(home), author: 'kai' })
  await inHome(home, () => runMarketplace('init', 'mine'))
  const own = join(home, 'ttheme', 'marketplace', 'mine', 'sets', 'tidewater.toml')

  writeFileSync(
    own,
    setText([
      { slug: 'juno', text: paletteToml({ ...draftOf(manifest.palettes[1] as PaletteEntry), name: 'kai@mine/juno' }) },
    ]),
  )

  const asking = spyOn(terminal, 'interactive').mockReturnValue(true)

  try {
    await assert.rejects(
      inHome(home, () => runEdit('juno')),
      /juno is ttheme\/juno, kai@mine\/juno — name the one you mean/,
    )
    writeFileSync(own, setText([{ slug: 'juno', text: 'signature = 3\n' }]))
    await assert.rejects(
      inHome(home, () => runEdit('juno')),
      /kai@mine\/juno in .*tidewater\.toml cannot be read/,
    )
  } finally {
    asking.mockRestore()
  }
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
