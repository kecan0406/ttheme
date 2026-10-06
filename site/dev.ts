import { existsSync, watch } from 'node:fs'
import { join } from 'node:path'
import { Elysia, file, NotFound } from 'elysia'
import { autoHead } from 'elysia/auto-head'
import { ASSETS, buildAssets, SITE } from './build'

await buildAssets(false)
const { site } = await import('./app/site')

const listeners = new Set<ReadableStreamDefaultController<string>>()
let pending: ReturnType<typeof setTimeout> | undefined

function rebuild() {
  clearTimeout(pending)
  pending = setTimeout(async () => {
    try {
      await buildAssets(false)
      for (const listener of listeners) listener.enqueue('data: reload\n\n')
    } catch (error) {
      process.stderr.write(`site: ${(error as Error).message}\n`)
    }
  }, 60)
}

watch(join(SITE, 'client'), { recursive: true }, rebuild)
watch(join(SITE, 'app', 'globals.css'), rebuild)

setInterval(() => {
  for (const listener of listeners) listener.enqueue(': ping\n\n')
}, 5000)

new Elysia()
  .use(autoHead())
  .get('/__reload', () => {
    let held: ReadableStreamDefaultController<string> | undefined
    const stream = new ReadableStream<string>({
      start(controller) {
        held = controller
        listeners.add(controller)
        controller.enqueue('retry: 300\n\n')
      },
      cancel() {
        if (held) listeners.delete(held)
      },
    })
    return new Response(stream, { headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-store' } })
  })
  .get('/assets/*', ({ params, set }) => {
    const name = params['*']
    if (!/^\w[\w.-]*$/.test(name) || !existsSync(join(ASSETS, name))) throw new NotFound()
    set.headers['cache-control'] = 'no-store'
    return file(join(ASSETS, name))
  })
  .use(site)
  .listen(Number(process.env.PORT ?? 3000), ({ url }) => console.log(`site on ${url}`))
