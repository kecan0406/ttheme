import { spyOn } from 'bun:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { corpusOf, fetchCorpus, readCorpus, schemesPath } from './schemes.ts'

function answering(listing: { name: string; type: string }[]) {
  return spyOn(globalThis, 'fetch').mockImplementation(
    Object.assign(
      async (url: string | URL | Request) =>
        String(url).includes('api.github.com') ? Response.json(listing) : new Response('background = #000000\n'),
      { preconnect: () => {} },
    ),
  )
}

test('a scheme keeps only a plain name whatever name the listing gives it', async () => {
  const home = mkdtempSync(join(tmpdir(), 'ttheme-schemes-'))

  const fetched = answering([
    { name: '../../escaped', type: 'file' },
    { name: '..\\escaped', type: 'file' },
    { name: '.hidden', type: 'file' },
    { name: 'odd\x1b[2J', type: 'file' },
    { name: 'Dusk Harbor', type: 'file' },
  ])

  try {
    const corpus = await fetchCorpus(home)

    assert.deepEqual(
      corpus.schemes.map(([name]) => name),
      ['Dusk Harbor'],
    )
    assert.deepEqual(corpus.notes, [])
    assert.deepEqual(readdirSync(home), ['ttheme'])
    assert.deepEqual(readdirSync(join(home, 'ttheme')), ['schemes.json'])
  } finally {
    fetched.mockRestore()
  }
})

test('a kept corpus is held to the same names', () => {
  const home = mkdtempSync(join(tmpdir(), 'ttheme-schemes-'))
  mkdirSync(join(home, 'ttheme'), { recursive: true })
  writeFileSync(
    schemesPath(home),
    JSON.stringify({ schemes: { '../../escaped': 'x', 'odd\x1b[2J': 'x', 'Dusk Harbor': 'background = #000000\n' } }),
  )

  assert.deepEqual(
    corpusOf(readCorpus(home))?.map(([name]) => name),
    ['Dusk Harbor'],
  )
})
