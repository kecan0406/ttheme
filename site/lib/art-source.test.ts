import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import { fetchCasts, fetchPeople, recordedWorks } from '@/lib/art-source'

const { preconnect } = fetch

afterEach(() => {
  mock.restore()
})

function refused() {
  spyOn(globalThis, 'fetch').mockImplementation(
    Object.assign(async () => new Response('', { status: 404 }), { preconnect }),
  )
}

test('a cast the name index cannot give fails the build, which leaves the last deploy up', async () => {
  refused()

  const works = [{ id: 'moonlit-harbor', tag: 'moonlit_harbor', lang: null, held: [] }]

  await expect(fetchCasts(works, () => undefined)).rejects.toThrow()
})

test('a name the name index cannot give fails the build too', async () => {
  refused()

  const works = [
    { id: 'moonlit-harbor', name: 'Moonlit Harbor', characters: [{ id: 'nell', danbooru: 'harbor_nell' }] },
  ]

  await expect(fetchPeople(works)).rejects.toThrow()
})

test('a character named by hand takes that name without asking the name index', async () => {
  refused()

  const works = [
    {
      id: 'moonlit-harbor',
      name: 'Moonlit Harbor',
      characters: [{ id: 'nell', danbooru: 'harbor_nell', person: 'Nell' }],
    },
  ]

  expect(await fetchPeople(works)).toEqual({ 'moonlit-harbor/nell': 'Nell' })
})

test('a recorded work keeps its hand numbers and drops what does not read', () => {
  expect(
    recordedWorks({
      works: [
        {
          id: 'moonlit-harbor',
          name: 'Moonlit Harbor',
          art: { steam: '420', anilist: 7, picture: 'http://example.test/plain.png' },
          characters: [{ id: 'nell', anilist: 12, picture: 'https://example.test/nell.png' }, { anilist: 13 }],
        },
        { id: 'no-name' },
      ],
    }),
  ).toEqual([
    {
      id: 'moonlit-harbor',
      name: 'Moonlit Harbor',
      art: { anilist: 7, steam: '420' },
      characters: [{ id: 'nell', anilist: 12, picture: 'https://example.test/nell.png' }],
    },
  ])
  expect(recordedWorks(null)).toEqual([])
})
