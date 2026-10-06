import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Elysia, file, NotFound } from 'elysia'

export const ASSETS = fileURLToPath(new URL('../public/assets/', import.meta.url))

export const IMMUTABLE = 'public, max-age=31536000, s-maxage=31536000, immutable'

export function shipped(cache: string) {
  return new Elysia({ name: 'shipped' }).get('/assets/*', ({ params, set }) => {
    const name = params['*']
    if (!/^\w[\w.-]*$/.test(name) || !existsSync(join(ASSETS, name))) throw new NotFound()
    set.headers['cache-control'] = cache
    return file(join(ASSETS, name))
  })
}
