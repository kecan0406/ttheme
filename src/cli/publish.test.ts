import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { type Work, workToml } from '../core/commons.ts'
import { readMarketplaceInfo } from '../store/sources.ts'
import { proposalsFor, unsaved, withCharacter, withDescription } from './publish.ts'

const toml = `"$schema" = "https://www.schemastore.org/ttheme-marketplace.json"
name = "pastel"

[owner]
name = "alice"

[renames]
old-dusk = "dusk"
gone = false

[metadata]
description = "not the marketplace's"
`

test('a description goes in after the name, is replaced in place, and comes out when cleared', () => {
  const added = withDescription(toml, 'Soft colors')
  assert.match(added, /^name = "pastel"\ndescription = "Soft colors"\n\n\[owner\]/m)
  assert.equal(readMarketplaceInfo(added, 'x').description, 'Soft colors')
  const replaced = withDescription(added, 'Softer "colors"')
  assert.equal(readMarketplaceInfo(replaced, 'x').description, 'Softer "colors"')
  assert.equal(withDescription(replaced, undefined), toml)
  assert.equal(withDescription(toml, undefined), toml)
})

test('a hand-written description over several lines is replaced whole, and the tables after it stay as they were', () => {
  const written = toml.replace('name = "pastel"\n', 'name = "pastel"\ndescription = """\nSoft colors"""\n')

  assert.equal(readMarketplaceInfo(written, 'x').description, 'Soft colors')
  const replaced = withDescription(written, 'Softer')
  assert.equal(readMarketplaceInfo(replaced, 'x').description, 'Softer')
  assert.deepEqual(readMarketplaceInfo(replaced, 'x').renames, { 'old-dusk': 'dusk', gone: false })
  assert.equal(withDescription(written, undefined), toml)
})

test('a description written on the line after its quotes, starting with a bracket, is replaced whole, with LF or CRLF line ends', () => {
  const written = toml.replace('name = "pastel"\n', 'name = "pastel"\ndescription = """\n[WIP] Soft colors"""\n')

  for (const text of [written, written.replaceAll('\n', '\r\n')]) {
    assert.equal(readMarketplaceInfo(text, 'x').description, '[WIP] Soft colors')
    const info = readMarketplaceInfo(withDescription(text, 'Softer'), 'x')
    assert.equal(info.description, 'Softer')
    assert.deepEqual(info.renames, { 'old-dusk': 'dusk', gone: false })
    assert.equal(readMarketplaceInfo(withDescription(text, undefined), 'x').description, undefined)
  }
})

test('a proposal takes a character once, and leaves a work that already lists it as it was', () => {
  const work: Work = { id: 'k-on', name: 'K-On!', native: 'けいおん！', characters: [{ id: 'yui' }] }
  const azusa = { id: 'azusa', native: ['中野梓'], danbooru: 'nakano_azusa' }
  const grown = withCharacter(work, azusa)
  assert.deepEqual(grown, { ...work, characters: [{ id: 'yui' }, azusa] })
  assert.equal(withCharacter(grown, { id: 'azusa' }), grown)
  assert.equal(withCharacter(work, undefined), work)
})

test('a marketplace proposes what the commons lacks of the works its palettes are of, into the proposals it holds', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ttheme-proposals-'))
  const commons: Work[] = [{ id: 'k-on', name: 'K-On!', native: 'けいおん！', characters: [{ id: 'yui' }] }]
  const azusa = { id: 'azusa', danbooru: 'nakano_azusa' }

  const known: Work[] = [
    { id: 'k-on', name: 'K-On!', native: 'けいおん！', characters: [{ id: 'yui' }, azusa] },
    { id: 'neon', name: 'Neon', characters: [{ id: 'volt' }, { id: 'arcade' }] },
  ]

  mkdirSync(join(dir, 'works'))
  writeFileSync(join(dir, 'works', 'neon.toml'), workToml({ id: 'neon', name: 'Neon', characters: [{ id: 'volt' }] }))
  writeFileSync(join(dir, 'works', 'broken.toml'), 'name = \n')

  assert.deepEqual(
    proposalsFor(known, commons, dir, [
      'k-on/yui',
      'k-on/azusa',
      'k-on/mio',
      'neon/volt',
      'neon/arcade',
      'nowhere/x',
      'broken/y',
      undefined,
    ]),
    [
      {
        work: { id: 'k-on', name: 'K-On!', native: 'けいおん！', characters: [azusa, { id: 'mio' }] },
        path: join(dir, 'works', 'k-on.toml'),
      },
      {
        work: { id: 'neon', name: 'Neon', characters: [{ id: 'volt' }, { id: 'arcade' }] },
        path: join(dir, 'works', 'neon.toml'),
      },
      {
        work: { id: 'nowhere', name: 'nowhere', characters: [{ id: 'x' }] },
        path: join(dir, 'works', 'nowhere.toml'),
      },
    ],
  )

  assert.deepEqual(proposalsFor(known, commons, dir, ['neon/volt', 'k-on/yui']), [])
})

test('a palette file git never committed, or changed since it was, is one share must warn it deletes, a committed one is not', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ttheme-publish-'))

  const git = (...args: string[]) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...args], {
      cwd: dir,
      stdio: 'ignore',
    })

  try {
    const shared = join(dir, 'palettes', 'kita.toml')
    const tuned = join(dir, 'palettes', 'rei.toml')
    const fresh = join(dir, 'palettes', 'miku.toml')
    mkdirSync(join(dir, 'palettes'))
    writeFileSync(shared, 'a')
    writeFileSync(tuned, 'c')
    assert.deepEqual(await unsaved(dir, [shared]), { fresh: [shared], changed: [] })
    git('init', '-q', '-b', 'main')
    assert.deepEqual(await unsaved(dir, [shared]), { fresh: [shared], changed: [] })
    git('add', '-A')
    git('commit', '-q', '--no-verify', '-m', 'share')
    writeFileSync(tuned, 'tuned since')
    writeFileSync(fresh, 'b')
    assert.deepEqual(await unsaved(dir, [shared, tuned, fresh]), { fresh: [fresh], changed: [tuned] })
    assert.deepEqual(await unsaved(dir, []), { fresh: [], changed: [] })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
