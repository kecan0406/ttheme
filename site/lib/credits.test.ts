import { expect, spyOn, test } from 'bun:test'
import { creditsOf, MOST_CREDITED } from '@/lib/credits'
import type { Picture } from '@/lib/view-types'

const { preconnect } = fetch

const held = Array.from({ length: 200 }, (_, at) => ({ site: 'yande', id: at + 1 }))

const rows: Picture[] = held.map((p) => ({ post: `yande.re #${p.id}`, href: null, framing: '', credit: null }))

const shared = { entry: { pictures: held }, pictures: rows }

test('one request asks a booru about a bounded number of posts', async () => {
  const fetched = spyOn(globalThis, 'fetch').mockImplementation(
    Object.assign(async () => new Response('[]'), { preconnect }),
  )

  try {
    const { pictures, complete } = await creditsOf(shared)

    expect(fetched.mock.calls.length).toBe(MOST_CREDITED)
    expect(pictures.length).toBe(held.length)
    expect(pictures.filter((picture) => picture.credit !== null).length).toBe(MOST_CREDITED)
    expect(complete).toBe(true)
  } finally {
    fetched.mockRestore()
  }
})
