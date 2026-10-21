import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { argbFromHex, Hct } from '@material/material-color-utilities'
import { MAX_PIXELS } from '../../../../src/core/booru.ts'
import { type Crop, type Flat, flatsOf } from '../../../../src/core/flats.ts'
import { decodeImage, isPng } from '../../../../src/core/png.ts'

const USAGE = 'usage: bun flats.ts <image> [--crop x,y,w,h] [--quant N] [--top K] [--median] [--no-bg]'

const fail = (message: string): never => {
  console.error(message)
  process.exit(1)
}
const pct = (n: number, total: number) => `${((n / total) * 100).toFixed(1)}%`.padStart(6)
const hctText = (h: { hue: number; chroma: number; tone: number }) =>
  `H ${String(Math.round(h.hue)).padStart(3)}  C ${String(Math.round(h.chroma)).padStart(3)}  T ${String(Math.round(h.tone)).padStart(3)}`
const label = (f: Flat) => (f.shadowOf ? `shadow of ${f.shadowOf}` : f.lit ? 'lit' : '')

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
const path = positionals.length === 1 ? (positionals[0] as string) : fail(USAGE)

const box = values.crop?.split(',').map(Number)
if (box && (box.length !== 4 || box.some((n) => !Number.isInteger(n) || n < 0))) fail(USAGE)
const crop: Crop | undefined = box && {
  x: box[0] as number,
  y: box[1] as number,
  width: box[2] as number,
  height: box[3] as number,
}
const quant = values.quant === undefined ? 0 : Number(values.quant)
if (values.quant !== undefined && (!Number.isInteger(quant) || quant < 2 || quant > 256)) fail(USAGE)
const top = values.top === undefined ? 12 : Number(values.top)
if (!Number.isInteger(top) || top < 1) fail(USAGE)

async function asPng(from: string): Promise<Uint8Array> {
  const out = join(tmpdir(), `ttheme-flats-${process.pid}.png`)
  const proc = Bun.spawnSync(['sips', '-s', 'format', 'png', from, '--out', out], { stdout: 'ignore', stderr: 'pipe' })
  if (proc.exitCode !== 0) throw new Error(`not a PNG or JPEG, and sips could not convert it: ${proc.stderr}`)
  const bytes = new Uint8Array(await Bun.file(out).arrayBuffer())
  await rm(out, { force: true })
  return bytes
}

let image: ReturnType<typeof decodeImage>
try {
  const bytes = new Uint8Array(await Bun.file(path).arrayBuffer())
  image = decodeImage(isPng(bytes) || (bytes[0] === 0xff && bytes[1] === 0xd8) ? bytes : await asPng(path), MAX_PIXELS)
} catch (e) {
  fail(`${path}: ${(e as Error).message}`)
}
let counted: ReturnType<typeof flatsOf>
try {
  counted = flatsOf(image, { crop, quant, top, extremes: !values['no-bg'] })
} catch (e) {
  fail((e as Error).message)
}

const size = crop
  ? `${image.width}×${image.height}, crop ${crop.width}×${crop.height} at ${crop.x},${crop.y}`
  : `${image.width}×${image.height}`
console.log(`image   ${size}`)
console.log(`opaque  ${counted.opaque} of ${counted.pixels} px (${pct(counted.opaque, counted.pixels).trim()})`)
if (counted.opaque === 0) process.exit(0)
console.log(`${quant ? `buckets ${counted.distinct} at ${quant} levels` : `colors  ${counted.distinct} exact`}`)

console.log('')
for (const f of counted.flats)
  console.log(`${f.hex}  ${pct(f.count, counted.opaque)}  ${hctText(f)}  ${label(f)}`.trimEnd())

if (values.median) {
  const h = Hct.fromInt(argbFromHex(counted.median))
  console.log('')
  console.log(`median  ${counted.median}  ${hctText(h)}`)
}
