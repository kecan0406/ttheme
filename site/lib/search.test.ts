import { expect, test } from 'bun:test'
import { marketsFor, type SearchPalette, type SearchWork, said, searchWorks } from '@/lib/search'

function palette(slug: string): SearchPalette {
  return { name: `ttheme/${slug}`, slug, look: [] }
}

function work(id: string, name: string, native: string | null, slugs: string[]): SearchWork {
  return {
    id,
    name,
    native,
    lang: native ? 'ja' : null,
    path: `/works/${id}`,
    art: null,
    facets: '',
    search: [id, name, native ?? ''].join('\n').toLowerCase(),
    palettes: slugs.map(palette),
  }
}

const WORKS = [
  work('lantern-days', 'Lantern Days', 'ランタンの日々', ['aoba-rin', 'kurose-mio']),
  work('moon-harbor', 'Moon Harbor', null, ['harbor-keeper']),
  work('tidal-moonlight', 'Tidal Moonlight', null, ['shiomi-sora', 'moon']),
]

const ids = (query: string, named: string[] = []) => searchWorks(WORKS, query, named).map((hit) => hit.work.id)

test('an exact title comes first, a title that starts with the query next, then any title holding it', () => {
  expect(ids('moon')).toEqual(['moon-harbor', 'tidal-moonlight'])
  expect(ids('moon harbor')).toEqual(['moon-harbor'])
  expect(ids('harbor')).toEqual(['moon-harbor'])
  expect(ids('light')).toEqual(['tidal-moonlight'])
})

test('a palette named in full or by its slug shows that palette, never a palette its name only starts', () => {
  const [hit] = searchWorks(WORKS, 'kurose-mio')

  expect(hit?.work.id).toBe('lantern-days')
  expect(hit?.palette.slug).toBe('kurose-mio')
  expect(searchWorks(WORKS, 'ttheme/kurose-mio')[0]?.palette.slug).toBe('kurose-mio')
  expect(ids('kurose')).toEqual([])
})

test('a title match shows the lead palette unless the query also names one of its palettes', () => {
  expect(searchWorks(WORKS, 'lantern days')[0]?.palette.slug).toBe('aoba-rin')
  expect(searchWorks(WORKS, 'moon').find((hit) => hit.work.id === 'tidal-moonlight')?.palette.slug).toBe('moon')
})

test('a work the name lookup found joins after every work the text found', () => {
  expect(ids('moon', ['lantern-days'])).toEqual(['moon-harbor', 'tidal-moonlight', 'lantern-days'])
  expect(ids('ランタン')).toEqual(['lantern-days'])
  expect(ids('   ')).toEqual([])
})

test('what said() keeps is exactly what the ranking keeps, so the menu and the page agree', () => {
  for (const query of ['moon', 'harbor-keeper', 'kurose', 'lantern', 'ランタン', 'nothing']) {
    const kept = WORKS.flatMap((one) =>
      said(
        one.search,
        one.palettes.flatMap((p) => [p.name, p.slug]),
        query,
      )
        ? [one.id]
        : [],
    )

    expect(ids(query).toSorted()).toEqual(kept.toSorted())
  }
})

test('a marketplace matches on two letters or more', () => {
  const markets = [{ id: 'kit@pastel', text: 'kit@pastel pastel palettes' }]

  expect(marketsFor(markets, 'p')).toEqual([])
  expect(marketsFor(markets, 'pa').map((market) => market.id)).toEqual(['kit@pastel'])
})
