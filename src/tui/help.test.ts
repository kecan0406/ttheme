import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Help, overlay, type Topic } from './help.ts'
import { painter } from './style.ts'
import { lifted, marking, zone } from './zones.ts'

const p = painter(false)

function topicsWithGaps(): Topic[] {
  const run = () => {}

  return [
    { label: 'First', text: 'a  runs', run },
    ...Array.from({ length: 12 }, (_, i) => ({ label: `Note${i}`, text: 'only words, nothing to run' })),
    { label: 'Last', text: 'z  runs', run },
  ]
}

test('every topic can be reached in a short help, even the ones with nothing to run', () => {
  const help = new Help(topicsWithGaps())
  const seen = new Set<string>()

  for (let i = 0; i < 20; i++) {
    for (const line of help.box(p, 80, 12)) {
      for (const match of line.matchAll(/(First|Last|Note\d+)/g)) {
        seen.add(match[1] as string)
      }
    }

    help.key('down')
  }

  assert.equal(seen.size, 14)
})

test('the help is never taller than the rows it was given, dropping its marks first', () => {
  const run = () => {}
  const topics = Array.from({ length: 30 }, (_, i) => ({ label: `T${i}`, text: 'x  words', run }))
  const legend: [string, string][] = Array.from({ length: 8 }, (_, i) => [String(i), 'a mark'])
  const help = new Help(topics, legend)

  for (const rows of [6, 8, 10, 14]) {
    assert.ok(help.box(p, 40, rows).length <= rows - 1, `rows ${rows}`)
  }
})

test('the screen under the help keeps no click zones but on its last row, the key bar', () => {
  const help = new Help(topicsWithGaps())

  const { drawn, targets } = marking(() => {
    const under = [
      zone({ kind: 'key', key: 's' }, 'Save'),
      'text',
      '',
      '',
      '',
      '',
      zone({ kind: 'key', key: '?' }, '? keys'),
    ]

    return overlay(under, help.box(p, 40, 6), 40, 7, 1)
  })

  const kinds = lifted(drawn, targets).zones.map((z) => [z.row, (z.target as { kind: string }).kind])
  assert.ok(!kinds.some(([row, kind]) => kind === 'key' && row !== 6))
  assert.ok(kinds.some(([row, kind]) => kind === 'key' && row === 6))
})
