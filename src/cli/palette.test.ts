import { spyOn } from 'bun:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { isCrash } from './cli.ts'
import { runPalette } from './palette.ts'

test('palette consensus says a page that is not JSON is one it cannot read, which is no crash of ttheme', async () => {
  const fetched = spyOn(globalThis, 'fetch').mockImplementation(
    Object.assign(async () => new Response('<!doctype html><title>Just a moment</title>'), { preconnect: () => {} }),
  )

  try {
    await assert.rejects(
      () => runPalette('consensus', 'orla_(starfall)', {}),
      (error: Error) => !isCrash(error) && /safebooru answered something ttheme cannot read/.test(error.message),
    )
  } finally {
    fetched.mockRestore()
  }
})

test('a marketplace of your own named ttheme is yours, not the built-in one', async () => {
  const home = mkdtempSync(join(tmpdir(), 'ttheme-palette-'))
  const dir = join(home, 'mine')
  mkdirSync(join(home, 'ttheme'), { recursive: true })
  mkdirSync(join(dir, 'sets'), { recursive: true })
  writeFileSync(join(dir, 'ttheme-marketplace.toml'), 'name = "ttheme"\n\n[owner]\nname = "ann"\n')
  writeFileSync(
    join(home, 'ttheme', 'installed.json'),
    JSON.stringify({ terminals: [], palettes: [], marketplaces: [dir] }),
  )
  writeFileSync(join(home, 'anchors.json'), JSON.stringify({ wren: { slots: { cursor: ['Hair', '#ff8040'] } } }))

  const fetched = spyOn(globalThis, 'fetch').mockRejectedValue(new Error('no network in a test'))
  const said: string[] = []

  const written = spyOn(process.stdout, 'write').mockImplementation((text) => {
    said.push(String(text))

    return true
  })

  const was = { config: process.env.XDG_CONFIG_HOME, cache: process.env.XDG_CACHE_HOME }
  process.env.XDG_CONFIG_HOME = home
  process.env.XDG_CACHE_HOME = join(home, 'cache')

  try {
    await runPalette('make', undefined, { anchors: join(home, 'anchors.json'), in: dir, 'dry-run': true, json: true })
  } finally {
    fetched.mockRestore()
    written.mockRestore()
    process.env.XDG_CONFIG_HOME = was.config
    process.env.XDG_CACHE_HOME = was.cache
  }

  assert.equal(JSON.parse(said.join('')).marketplace, 'ann@ttheme')
})
