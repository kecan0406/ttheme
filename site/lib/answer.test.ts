import { expect, test } from 'bun:test'
import { answerOf } from '@/lib/answer'
import type { Work } from '../../src/core/commons.ts'
import type { NameHit } from '../../src/core/names.ts'

const works: Work[] = [
  { id: 'moonlit-harbor', name: 'Moonlit Harbor', danbooru: 'moonlit_harbor', characters: [] },
  { id: 'tidewater', name: 'Tidewater', danbooru: 'tidewater', characters: [] },
]

function hit(label: string, tags: string[]): NameHit {
  return { id: `work/${label}`, label, names: [], tags }
}

function asked(request: string): string | null {
  return new URL(request).searchParams.get('character')
}

test('an answer keeps the works that have palettes', () => {
  const hits = [hit('月明かりの港', ['moonlit_harbor']), hit('Tidewater', ['tidewater'])]
  const answer = answerOf('달빛', hits, works, new Set(['moonlit-harbor']), [])

  expect(answer.works).toEqual(['moonlit-harbor'])
})

test('a name no index knows is asked for and made as it was typed', () => {
  const answer = answerOf('Glass Orchard', [], works, new Set(), [])

  expect(answer.works).toEqual([])
  expect([answer.label, asked(answer.request), answer.name]).toEqual([
    'Glass Orchard',
    'Glass Orchard',
    'glass-orchard',
  ])
})
