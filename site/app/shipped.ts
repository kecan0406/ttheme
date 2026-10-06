import files from 'virtual:shipped'
import { Elysia, NotFound } from 'elysia'

const IMMUTABLE = 'public, max-age=31536000, s-maxage=31536000, immutable'

const decoded = new Map<string, Uint8Array>()

function ship(name: string): Response {
  const file = files[name]
  if (!file) throw new NotFound()
  let data = decoded.get(name)
  if (!data) {
    data = Buffer.from(file.data, 'base64')
    decoded.set(name, data)
  }
  return new Response(data, { headers: { 'content-type': file.type, 'cache-control': IMMUTABLE } })
}

export const shipped = new Elysia({ name: 'shipped' }).get('/assets/*', ({ params }) => ship(params['*']))
