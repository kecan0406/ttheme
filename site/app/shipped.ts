import files from 'virtual:shipped'
import { Elysia, NotFound } from 'elysia'

const HASHED = 'public, max-age=31536000, s-maxage=31536000, immutable'
const NAMED = 'public, max-age=604800, s-maxage=604800'

function ship(path: string): Response {
  const file = files[path]
  if (!file) throw new NotFound()
  return new Response(Buffer.from(file.data, 'base64'), {
    headers: { 'content-type': file.type, 'cache-control': path.startsWith('/assets/') ? HASHED : NAMED },
  })
}

export const shipped = new Elysia({ name: 'shipped' })
  .get('/assets/*', ({ params }) => ship(`/assets/${params['*']}`))
  .get('/fonts/*', ({ params }) => ship(`/fonts/${params['*']}`))
