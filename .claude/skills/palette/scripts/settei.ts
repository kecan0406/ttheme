import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { parseArgs } from 'node:util'

interface Image {
  name: string
  url: string
  width: number
  height: number
}

const USAGE = [
  'usage: bun settei.ts list <wiki> <prefix> [...] [--all]',
  '       bun settei.ts get <wiki> <file> [...] [--out <dir>] [--preview <px>]',
  '<wiki> is a fandom subdomain (nichijou) or a MediaWiki host (geass.miraheze.org); --api overrides the endpoint',
].join('\n')
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
const MIN_SIDE = 400
const STILL_RATIO = 16 / 9
const WIKIA_WIDTH = 1000

const fail = (message: string): never => {
  console.error(message)
  process.exit(1)
}

const { values, positionals } = (() => {
  try {
    return parseArgs({
      args: Bun.argv.slice(2),
      allowPositionals: true,
      options: {
        all: { type: 'boolean', default: false },
        out: { type: 'string', default: '.' },
        preview: { type: 'string', default: '800' },
        api: { type: 'string' },
      },
    })
  } catch (e) {
    return fail(`${(e as Error).message}\n${USAGE}`)
  }
})()
const [verb, wiki, ...names] = positionals
if ((verb !== 'list' && verb !== 'get') || wiki === undefined || names.length === 0) fail(USAGE)
const preview = Number(values.preview)
if (!Number.isInteger(preview) || preview < 0) fail(USAGE)

const host = wiki?.includes('.') ? wiki : `${wiki}.fandom.com`
const api = values.api ?? (host.endsWith('.fandom.com') ? `https://${host}/api.php` : `https://${host}/w/api.php`)

async function query(params: Record<string, string>): Promise<Record<string, unknown>> {
  const url = `${api}?${new URLSearchParams({ action: 'query', format: 'json', ...params })}`
  const res = await fetch(url, { headers: { 'user-agent': UA } }).catch(() => undefined)
  if (!res?.ok) fail(`${api}: ${res?.status ?? 'network error'}`)
  const body = await res.text()
  try {
    return JSON.parse(body).query ?? {}
  } catch {
    return fail(`${api}: answered ${body.trimStart().slice(0, 40)}… instead of JSON`)
  }
}

function hidden(image: Image): string | undefined {
  if (/\.gif$/i.test(image.name)) return 'gif'
  if (Math.min(image.width, image.height) < MIN_SIDE) return 'small'
  if (Math.abs(image.width / image.height - STILL_RATIO) < 0.02) return '16:9 still'
  return undefined
}

async function list() {
  const seen = new Map<string, Image>()
  for (const prefix of names) {
    const found = await query({ list: 'allimages', aiprefix: prefix, ailimit: '200', aiprop: 'url|dimensions' })
    for (const image of (found.allimages ?? []) as Image[]) seen.set(image.name, image)
  }
  const skipped = new Map<string, number>()
  const shown: Image[] = []
  for (const image of [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))) {
    const reason = values.all ? undefined : hidden(image)
    if (reason) skipped.set(reason, (skipped.get(reason) ?? 0) + 1)
    else shown.push(image)
  }
  for (const image of shown) console.log(`${`${image.width}x${image.height}`.padStart(10)}  ${image.name}`)
  if (skipped.size > 0)
    console.log(`hidden: ${[...skipped].map(([reason, n]) => `${n} ${reason}`).join(', ')} (--all shows them)`)
  if (seen.size === 0) console.log(`no files start with ${names.join(', ')}`)
}

function kind(bytes: Uint8Array): string | undefined {
  const at = (i: number, ...b: number[]) => b.every((v, j) => bytes[i + j] === v)
  if (at(0, 0x89, 0x50, 0x4e, 0x47)) return bytes[25] === 6 || bytes[25] === 4 ? 'png alpha' : 'png'
  if (at(0, 0xff, 0xd8, 0xff)) return 'jpeg'
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return 'webp'
  return undefined
}

function size(path: string): string {
  const proc = Bun.spawnSync(['sips', '-g', 'pixelWidth', '-g', 'pixelHeight', path], { stdout: 'pipe' })
  const [w, h] = [...proc.stdout.toString().matchAll(/: (\d+)/g)].map((m) => m[1])
  return w && h ? `${w}x${h}` : '?'
}

async function get() {
  const titles = names.map((n) => `File:${n.replace(/^File:/, '')}`)
  const found = await query({ prop: 'imageinfo', iiprop: 'url', titles: titles.join('|') })
  const pages = Object.values((found.pages ?? {}) as Record<string, { title: string; imageinfo?: { url: string }[] }>)
  await mkdir(join(values.out, 'sm'), { recursive: true })
  for (const page of pages) {
    const name = page.title.replace(/^File:/, '').replaceAll(' ', '_')
    const source = page.imageinfo?.[0]?.url
    if (!source) {
      console.log(`${name}: not on ${host}`)
      continue
    }
    const url = source.replace(
      /\/revision\/latest(\?cb=\d+)?$/,
      `/revision/latest/scale-to-width-down/${WIKIA_WIDTH}?format=original`,
    )
    const res = await fetch(url, {
      headers: {
        'user-agent': UA,
        referer: `https://${host}/`,
        'sec-fetch-dest': 'image',
        'sec-fetch-mode': 'no-cors',
        'sec-fetch-site': 'cross-site',
      },
    }).catch(() => undefined)
    const bytes = res?.ok ? new Uint8Array(await res.arrayBuffer()) : undefined
    const type = bytes && kind(bytes)
    if (!bytes || !type) {
      console.log(`${name}: ${res?.ok ? 'not an image (a challenge page?)' : (res?.status ?? 'network error')}`)
      continue
    }
    const path = join(values.out, name)
    await Bun.write(path, bytes)
    let small = ''
    if (preview > 0) {
      const target = join(values.out, 'sm', name)
      Bun.spawnSync(['sips', '-Z', String(preview), path, '--out', target], { stdout: 'ignore', stderr: 'ignore' })
      small = `  preview ${target}`
    }
    console.log(`${name}  ${size(path)}  ${type}  ${path}${small}`)
  }
}

await (verb === 'list' ? list() : get())
