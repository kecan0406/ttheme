import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Query } from './screen.ts'
import { Tags } from './tags.ts'

function field() {
  const view = { tag: 'tamsin_(tidewater)', chips: [], query: undefined as Query | undefined }
  const committed: string[] = []
  const left: number[] = []
  const watch = { drawn: () => {} }

  const tags = new Tags({
    view: view as never,
    paint: { draw: () => watch.drawn() } as never,
    signal: new AbortController().signal,
    net: {
      fetchSuggestions: async () => [
        { value: 'tamarisk_(tidewater)', count: 12 },
        { value: 'tamsin_(tidewater)', count: 40 },
      ],
    } as never,
    manifest: { palettes: [], works: [] } as never,
    entry: { name: 'ann@pastel/tamsin' } as never,
    research: () => {},
    commit: async (text) => {
      committed.push(text)
    },
    leave: (code) => left.push(code),
  })

  const listed = () =>
    new Promise<void>((resolve) => {
      watch.drawn = () => {
        if (view.query?.suggest) {
          resolve()
        }
      }
    })

  return { view, tags, committed, left, listed }
}

test('esc in the tag field drops the suggestion picked with what was typed, so the next enter searches nothing', async () => {
  const { view, tags, committed, left, listed } = field()
  tags.edit()
  const shown = listed()
  tags.editKey('t')
  tags.editKey('a')
  await shown
  tags.editKey('down')
  assert.equal(view.query?.suggest?.pick, 0)
  tags.editKey('esc')
  assert.equal(view.query, undefined)
  tags.edit()
  assert.deepEqual(view.query, { text: '' })
  tags.editKey('enter')
  assert.deepEqual(committed, [])
  assert.deepEqual(left, [])
  assert.equal(view.query, undefined)
})
