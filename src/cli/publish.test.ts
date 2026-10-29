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

[notes]
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
  assert.equal(readMarketplaceInfo(replaced, 'x').owner, 'alice')
  assert.equal(withDescription(written, undefined), toml)
})

test('a description written on the line after its quotes, starting with a bracket, is replaced whole, with LF or CRLF line ends', () => {
  const written = toml.replace('name = "pastel"\n', 'name = "pastel"\ndescription = """\n[WIP] Soft colors"""\n')

  for (const text of [written, written.replaceAll('\n', '\r\n')]) {
    assert.equal(readMarketplaceInfo(text, 'x').description, '[WIP] Soft colors')
    const info = readMarketplaceInfo(withDescription(text, 'Softer'), 'x')
    assert.equal(info.description, 'Softer')
    assert.equal(info.owner, 'alice')
    assert.equal(readMarketplaceInfo(withDescription(text, undefined), 'x').description, undefined)
  }
})

test('a proposal takes a character once, and leaves a work that already lists it as it was', () => {
  const work: Work = { id: 'lantern-row', name: 'Lantern Row!', native: '등불 거리', characters: [{ id: 'wren' }] }
  const pip = { id: 'pip', native: ['ピップ'], danbooru: 'pip_(lantern_row)' }
  const grown = withCharacter(work, pip)
  assert.deepEqual(grown, { ...work, characters: [{ id: 'wren' }, pip] })
  assert.equal(withCharacter(grown, { id: 'pip' }), grown)
  assert.equal(withCharacter(work, undefined), work)
})

test('a marketplace proposes what the commons lacks of the works its palettes are of, into the proposals it holds', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ttheme-proposals-'))

  const commons: Work[] = [
    { id: 'lantern-row', name: 'Lantern Row!', native: '등불 거리', characters: [{ id: 'wren' }] },
  ]

  const pip = { id: 'pip', danbooru: 'pip_(lantern_row)' }

  const known: Work[] = [
    { id: 'lantern-row', name: 'Lantern Row!', native: '등불 거리', characters: [{ id: 'wren' }, pip] },
    { id: 'neon', name: 'Neon', characters: [{ id: 'volt' }, { id: 'arcade' }] },
  ]

  mkdirSync(join(dir, 'works'))
  writeFileSync(join(dir, 'works', 'neon.toml'), workToml({ id: 'neon', name: 'Neon', characters: [{ id: 'volt' }] }))
  writeFileSync(join(dir, 'works', 'broken.toml'), 'name = \n')

  assert.deepEqual(
    proposalsFor(known, commons, dir, [
      'lantern-row/wren',
      'lantern-row/pip',
      'lantern-row/juno',
      'neon/volt',
      'neon/arcade',
      'nowhere/x',
      'broken/y',
      undefined,
    ]),
    [
      {
        work: { id: 'lantern-row', name: 'Lantern Row!', native: '등불 거리', characters: [pip, { id: 'juno' }] },
        path: join(dir, 'works', 'lantern-row.toml'),
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

  assert.deepEqual(proposalsFor(known, commons, dir, ['neon/volt', 'lantern-row/wren']), [])
})

test('a set file git never committed, or changed since it was, is one share must warn it deletes from, a committed one is not', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ttheme-publish-'))

  const git = (...args: string[]) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...args], {
      cwd: dir,
      stdio: 'ignore',
    })

  try {
    const shared = join(dir, 'sets', 'tidewater.toml')
    const tuned = join(dir, 'sets', 'starfall.toml')
    const fresh = join(dir, 'sets', 'glass-arcade.toml')
    mkdirSync(join(dir, 'sets'))
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
