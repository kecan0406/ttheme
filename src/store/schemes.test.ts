import { spyOn } from 'bun:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { syncSchemes } from './schemes.ts'

function answering(listing: { name: string; type: string }[]) {
  return spyOn(globalThis, 'fetch').mockImplementation(
    Object.assign(
      async (url: string | URL | Request) =>
        String(url).includes('api.github.com') ? Response.json(listing) : new Response('background = #000000\n'),
      { preconnect: () => {} },
    ),
  )
}

test('a scheme stays in its folder whatever name the listing gives it', async () => {
  const root = mkdtempSync(join(tmpdir(), 'ttheme-schemes-'))
  const dir = join(root, 'cache', 'schemes')

  const fetched = answering([
    { name: '../../escaped', type: 'file' },
    { name: '..\\escaped', type: 'file' },
    { name: '.hidden', type: 'file' },
    { name: 'odd\x1b[2J', type: 'file' },
    { name: 'Dusk Harbor', type: 'file' },
  ])

  try {
    const corpus = await syncSchemes(dir)

    assert.deepEqual(corpus.names, ['Dusk Harbor'])
    assert.deepEqual(corpus.notes, [])
    assert.equal(existsSync(join(root, 'escaped')), false)
    assert.deepEqual(readdirSync(root), ['cache'])
  } finally {
    fetched.mockRestore()
  }
})

test('a kept listing is held to the same names', async () => {
  const root = mkdtempSync(join(tmpdir(), 'ttheme-schemes-'))
  const dir = join(root, 'cache', 'schemes')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, '.index'), '../../escaped\nDusk Harbor\n')
  const fetched = answering([])

  try {
    assert.deepEqual((await syncSchemes(dir)).names, ['Dusk Harbor'])
    assert.equal(existsSync(join(root, 'escaped')), false)
  } finally {
    fetched.mockRestore()
  }
})
