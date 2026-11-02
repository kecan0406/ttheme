import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { castMembers, hitsOf, nameSearch } from './names.ts'

function work(label: string, match: string) {
  return { id: `w/${label}`, kind: 'work', label, match, names: [], danbooru: [] }
}

test('a work is found by its name, its family or the start of a name, never by a guess at a typo or a sound', () => {
  const found = [work('A', 'name'), work('B', 'family'), work('C', 'prefix'), work('D', 'typo'), work('E', 'sound')]

  assert.deepEqual(
    hitsOf(found, 'harbor').map((hit) => hit.label),
    ['A', 'B', 'C'],
  )
})

test('one word of a title counts only for a query long enough to mean it', () => {
  const found = [work('A', 'part')]

  assert.equal(hitsOf(found, 'tide').length, 0)
  assert.equal(hitsOf(found, 'tidal').length, 1)
  assert.equal(hitsOf(found, '항구').length, 0)
  assert.equal(hitsOf(found, '달빛항').length, 1)
})

test('a character is no hit, whatever it matched', () => {
  assert.deepEqual(hitsOf([{ ...work('A', 'name'), kind: 'character' }], 'harbor'), [])
})

test('a generated name is never the preferred one', () => {
  const [member] = castMembers([
    {
      id: 'c/1',
      kind: 'character',
      label: 'ネル',
      names: [
        { text: 'neru', lang: 'ja-Latn', kind: 'generated', preferred: true },
        { text: 'Nell', lang: 'en', kind: 'synonym', preferred: true },
      ],
      danbooru: [],
    },
  ])

  assert.deepEqual(
    member?.names.map((name) => name.preferred === true),
    [false, true],
  )
})

test('a lookup the server never answers ends as a failure, so the screen stops saying it is looking', async () => {
  const fetching = globalThis.fetch
  const cache = process.env.XDG_CACHE_HOME
  const dir = mkdtempSync(join(tmpdir(), 'ttheme-names-'))
  process.env.XDG_CACHE_HOME = dir

  globalThis.fetch = ((_url: string, init?: RequestInit) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
    })) as typeof fetch

  try {
    const search = nameSearch('aninames', 'https://names.example.test', 20)

    await assert.rejects(search?.('harbor', new AbortController().signal) as Promise<unknown>, {
      message: 'names.example.test gave no answer within 0.02 s',
    })
  } finally {
    globalThis.fetch = fetching

    if (cache === undefined) {
      delete process.env.XDG_CACHE_HOME
    } else {
      process.env.XDG_CACHE_HOME = cache
    }

    rmSync(dir, { recursive: true, force: true })
  }
})
