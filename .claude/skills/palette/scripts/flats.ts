import { parseArgs } from 'node:util'
import { argbFromHex, Hct } from '@material/material-color-utilities'

interface Flat {
  hex: string
  count: number
  hue: number
  chroma: number
  tone: number
  label: string
}

const USAGE = 'usage: bun flats.ts <image> [--crop x,y,w,h] [--quant N] [--top K] [--median] [--no-bg]'
const OPAQUE = 250
const PAIR_HUE = 20
const PAIR_CHROMA = 12
const PAIR_TONE = { min: 3, max: 30 }

const fail = (message: string): never => {
  console.error(message)
  process.exit(1)
}
const run = (cmd: string[]) => {
  const proc = Bun.spawnSync(cmd, { stdout: 'pipe', stderr: 'pipe' })
  if (proc.exitCode !== 0) fail(proc.stderr.toString().trim() || `${cmd[0]} exited ${proc.exitCode}`)
  return proc.stdout
}
const hex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`
const hueDiff = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360
  return Math.min(d, 360 - d)
}
const pct = (n: number, total: number) => `${((n / total) * 100).toFixed(1)}%`.padStart(6)
const hctText = (h: { hue: number; chroma: number; tone: number }) =>
  `H ${String(Math.round(h.hue)).padStart(3)}  C ${String(Math.round(h.chroma)).padStart(3)}  T ${String(Math.round(h.tone)).padStart(3)}`

function flat(color: string, count: number): Flat {
  const h = Hct.fromInt(argbFromHex(color))
  return { hex: color, count, hue: h.hue, chroma: h.chroma, tone: h.tone, label: '' }
}

function paired(a: Flat, b: Flat): boolean {
  return (
    hueDiff(a.hue, b.hue) <= PAIR_HUE &&
    Math.abs(a.chroma - b.chroma) <= PAIR_CHROMA &&
    Math.abs(a.tone - b.tone) >= PAIR_TONE.min &&
    Math.abs(a.tone - b.tone) <= PAIR_TONE.max
  )
}

function label(flats: Flat[]) {
  for (const f of flats) {
    const partners = flats.filter((o) => o !== f && paired(f, o))
    if (partners.length === 0) continue
    const above = partners.filter((o) => o.tone > f.tone)
    if (above.length === 0) {
      f.label = 'lit'
      continue
    }
    const lit = above.reduce((best, o) => (o.tone > best.tone ? o : best))
    f.label = `shadow of ${lit.hex}`
  }
}

function median(histogram: Uint32Array, total: number): number {
  let seen = 0
  for (let v = 0; v < 256; v++) {
    seen += histogram[v] as number
    if (seen * 2 >= total) return v
  }
  return 255
}

const cli = () => {
  try {
    return parseArgs({
      args: Bun.argv.slice(2),
      allowPositionals: true,
      options: {
        crop: { type: 'string' },
        quant: { type: 'string' },
        top: { type: 'string' },
        median: { type: 'boolean', default: false },
        'no-bg': { type: 'boolean', default: false },
      },
    })
  } catch {
    return fail(USAGE)
  }
}
const { values, positionals } = cli()
const image = positionals.length === 1 ? (positionals[0] as string) : fail(USAGE)

const crop = values.crop?.split(',').map(Number)
if (crop && (crop.length !== 4 || crop.some((n) => !Number.isInteger(n) || n < 0))) fail(USAGE)
const quant = values.quant === undefined ? 0 : Number(values.quant)
if (values.quant !== undefined && (!Number.isInteger(quant) || quant < 2 || quant > 256)) fail(USAGE)
const top = values.top === undefined ? 12 : Number(values.top)
if (!Number.isInteger(top) || top < 1) fail(USAGE)

const [width, height] = run([
  'ffprobe',
  '-v',
  'error',
  '-select_streams',
  'v:0',
  '-show_entries',
  'stream=width,height',
  '-of',
  'csv=p=0:s=x',
  image,
])
  .toString()
  .trim()
  .split('x')
  .map(Number) as [number, number]

const filter = crop ? ['-vf', `crop=${crop[2]}:${crop[3]}:${crop[0]}:${crop[1]}`] : []
const bytes = run([
  'ffmpeg',
  '-v',
  'error',
  '-i',
  image,
  ...filter,
  '-frames:v',
  '1',
  '-sws_flags',
  'accurate_rnd+full_chroma_int',
  '-f',
  'rawvideo',
  '-pix_fmt',
  'rgba',
  '-',
])

const pixels = bytes.length / 4
const counts = new Map<number, number>()
const sums = new Map<number, [number, number, number]>()
const channels = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)] as const
const step = quant ? 256 / quant : 1
let opaque = 0
for (let i = 0; i < bytes.length; i += 4) {
  if ((bytes[i + 3] as number) < OPAQUE) continue
  const r = bytes[i] as number
  const g = bytes[i + 1] as number
  const b = bytes[i + 2] as number
  opaque++
  channels[0][r] = (channels[0][r] as number) + 1
  channels[1][g] = (channels[1][g] as number) + 1
  channels[2][b] = (channels[2][b] as number) + 1
  const key = quant
    ? (Math.floor(r / step) << 16) | (Math.floor(g / step) << 8) | Math.floor(b / step)
    : (r << 16) | (g << 8) | b
  counts.set(key, (counts.get(key) ?? 0) + 1)
  if (quant) {
    const sum = sums.get(key) ?? [0, 0, 0]
    sum[0] += r
    sum[1] += g
    sum[2] += b
    sums.set(key, sum)
  }
}

const size = crop ? `${width}×${height}, crop ${crop[2]}×${crop[3]} at ${crop[0]},${crop[1]}` : `${width}×${height}`
console.log(`image   ${size}`)
console.log(`opaque  ${opaque} of ${pixels} px (${pct(opaque, pixels).trim()})`)
if (opaque === 0) process.exit(0)
console.log(`${quant ? `buckets ${counts.size} at ${quant} levels` : `colors  ${counts.size} exact`}`)

const color = (key: number, count: number) => {
  if (!quant) return hex(key >> 16, (key >> 8) & 255, key & 255)
  const [r, g, b] = sums.get(key) as [number, number, number]
  return hex(r / count, g / count, b / count)
}
const flats: Flat[] = []
for (const [key, count] of [...counts].sort((a, b) => b[1] - a[1])) {
  const f = flat(color(key, count), count)
  if (values['no-bg'] && (f.tone > 97 || f.tone < 3)) continue
  flats.push(f)
  if (flats.length === top) break
}
label(flats)

console.log('')
for (const f of flats) console.log(`${f.hex}  ${pct(f.count, opaque)}  ${hctText(f)}  ${f.label}`.trimEnd())

if (values.median) {
  const m = hex(...(channels.map((c) => median(c, opaque)) as [number, number, number]))
  console.log('')
  console.log(`median  ${m}  ${hctText(flat(m, opaque))}`)
}
