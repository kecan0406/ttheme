import { existsSync, watch } from 'node:fs'
import { join } from 'node:path'
import { Elysia, file, NotFound, sse } from 'elysia'
import { autoHead } from 'elysia/auto-head'
import { ASSETS, buildAssets, commands, IMMUTABLE, SITE, snapshot } from './build'

await snapshot(false)

commands()

await buildAssets(false)

const { site } = await import('./app/site')

let pending: ReturnType<typeof setTimeout> | undefined
let stamp = Date.now().toString(36)
let rebuilt = Promise.withResolvers<void>()

function rebuild() {
  clearTimeout(pending)
  pending = setTimeout(async () => {
    try {
      await buildAssets(false)
      stamp = Date.now().toString(36)
      rebuilt.resolve()
      rebuilt = Promise.withResolvers<void>()
    } catch (error) {
      process.stderr.write(`site: ${(error as Error).message}\n`)
    }
  }, 60)
}

watch(join(SITE, 'client'), { recursive: true }, rebuild)

watch(join(SITE, 'app', 'globals.css'), rebuild)

new Elysia()
  .use(autoHead())
  .get('/__reload', async function* ({ request, set }) {
    set.headers['cache-control'] = 'no-store'
    yield sse({ retry: 300, data: stamp })

    while (!request.signal.aborted) {
      const seen = stamp
      await Promise.race([rebuilt.promise, Bun.sleep(5000)])

      yield stamp === seen ? sse({ event: 'ping' }) : sse({ data: stamp })
    }
  })
  .get('/assets/*', ({ params, set }) => {
    const name = params['*']

    if (!/^\w[\w.-]*$/.test(name) || !existsSync(join(ASSETS, name))) return new NotFound()
    set.headers['cache-control'] = name.endsWith('.woff2') ? IMMUTABLE : 'no-store'

    return file(join(ASSETS, name))
  })
  .use(site)
  .listen(Number(process.env.PORT ?? 3000), ({ url }) => console.log(`site on ${url}`))
