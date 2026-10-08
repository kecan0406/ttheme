import assert from 'node:assert/strict'
import { test } from 'node:test'
import { findMarkets } from './markets.ts'

test('a repository the GitHub search lists comes back without the control characters its text holds', async () => {
  const realFetch = globalThis.fetch
  const listed = {
    full_name: 'mallory/ttheme-evil',
    name: 'ttheme-evil',
    description: 'Pastel\x1b]52;c;ZWNobyBoaQ==\x07 palettes\x1b[2J\nnext\tline',
    stargazers_count: 1,
    owner: { login: 'mallory\x1b[8m' },
  }
  globalThis.fetch = (async () => new Response(JSON.stringify({ items: [listed] }))) as unknown as typeof fetch
  try {
    const [repo] = await findMarkets(undefined)
    assert.equal(repo?.description, 'Pastel ]52;c;ZWNobyBoaQ== palettes [2J next line')
    assert.equal(repo?.owner.login, 'mallory [8m')
    assert.equal(repo?.full_name, 'mallory/ttheme-evil')
  } finally {
    globalThis.fetch = realFetch
  }
})
