import { spyOn } from 'bun:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fetchArt } from '../pictures/art.ts'
import { loadRef } from '../tui/find/attach.ts'
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

test('palette measure says an address that is no URL cannot be read, which is no crash of ttheme', async () => {
  await assert.rejects(
    () => runPalette('measure', 'https://[', {}),
    (error: Error) => !isCrash(error) && /cannot be read/.test(error.message),
  )
})

test('a picture fetched from an address stops at its limit, whatever the server says of its size', async () => {
  let sent = 0
  const chunk = new Uint8Array(1024 * 1024)

  const fetched = spyOn(globalThis, 'fetch').mockImplementation(
    Object.assign(
      async () =>
        new Response(
          new ReadableStream({
            pull(stream) {
              sent++
              stream.enqueue(chunk)
            },
          }),
        ),
      { preconnect: () => {} },
    ),
  )

  const was = process.env.XDG_CACHE_HOME
  process.env.XDG_CACHE_HOME = mkdtempSync(join(tmpdir(), 'ttheme-palette-'))

  try {
    await assert.rejects(() => fetchArt('https://art.example.invalid/orla.png'), /sent a picture over 32 MB/)
    assert.ok(sent < 40, `read ${sent} MB`)
    sent = 0
    await assert.rejects(() => loadRef('https://art.example.invalid/orla.png', AbortSignal.timeout(5000)), /over 64 MB/)
    assert.ok(sent < 72, `read ${sent} MB`)
  } finally {
    fetched.mockRestore()
    process.env.XDG_CACHE_HOME = was
  }
})

test('palette make leaves a work file it cannot read as it found it', async () => {
  const home = mkdtempSync(join(tmpdir(), 'ttheme-palette-'))
  const dir = join(home, 'mine')
  mkdirSync(join(home, 'ttheme'), { recursive: true })
  mkdirSync(join(dir, 'sets'), { recursive: true })
  mkdirSync(join(dir, 'works'), { recursive: true })
  writeFileSync(join(dir, 'ttheme-marketplace.toml'), 'name = "pastel"\n\n[owner]\nname = "ann"\n')
  writeFileSync(
    join(home, 'ttheme', 'installed.json'),
    JSON.stringify({ terminals: [], palettes: [], marketplaces: [dir] }),
  )
  writeFileSync(join(home, 'anchors.json'), JSON.stringify({ wren: { slots: { cursor: ['Hair', '#ff8040'] } } }))
  const typo = 'name = "Starfall\n\n[[character]]\nid = "orla"\n'
  writeFileSync(join(dir, 'works', 'starfall.toml'), typo)

  const fetched = spyOn(globalThis, 'fetch').mockRejectedValue(new Error('no network in a test'))
  const log = spyOn(console, 'log').mockImplementation(() => {})
  const was = { config: process.env.XDG_CONFIG_HOME, cache: process.env.XDG_CACHE_HOME }
  process.env.XDG_CONFIG_HOME = home
  process.env.XDG_CACHE_HOME = join(home, 'cache')

  try {
    await assert.rejects(
      () =>
        runPalette('make', undefined, {
          anchors: join(home, 'anchors.json'),
          in: dir,
          work: 'starfall',
          'work-name': 'Starfall',
        }),
      /cannot be made/,
    )
  } finally {
    fetched.mockRestore()
    log.mockRestore()
    process.env.XDG_CONFIG_HOME = was.config
    process.env.XDG_CACHE_HOME = was.cache
  }

  assert.equal(readFileSync(join(dir, 'works', 'starfall.toml'), 'utf8'), typo)
})
