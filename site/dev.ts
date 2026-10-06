import { watch } from 'node:fs'
import { join, normalize, sep } from 'node:path'
import { Elysia, NotFound } from 'elysia'
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

async function shipped(name: string): Promise<Response> {
  const local = normalize(join(ASSETS, name))
  const file = Bun.file(local)
  if (!local.startsWith(ASSETS + sep) || !(await file.exists())) throw new NotFound()
  return new Response(file, { headers: { 'content-type': file.type, 'cache-control': 'no-store' } })
}

new Elysia()
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
  .get('/assets/*', ({ params }) => shipped(params['*']))
  .use(site)
  .listen(Number(process.env.PORT ?? 3000), ({ url }) => console.log(`site on ${url}`))
