import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import { fetchCasts, fetchPeople } from '@/lib/art-source'

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
