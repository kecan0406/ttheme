import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

type Rgb = [number, number, number]

const args = Bun.argv.slice(2)
if (args.length === 0) {
  console.error('usage: bun sample-colors.ts <image> [k]')
  process.exit(1)
}
const input = args[0] as string
const k = Math.max(2, Number(args[1] ?? '8'))

const workdir = mkdtempSync(join(tmpdir(), 'sample-colors-'))
const bmpPath = join(workdir, 'sample.bmp')
await Bun.$`sips -Z 96 -s format bmp ${input} --out ${bmpPath}`.quiet()

const bytes = new Uint8Array(await Bun.file(bmpPath).arrayBuffer())
const view = new DataView(bytes.buffer)
const offset = view.getUint32(10, true)
const width = view.getInt32(18, true)
const rawHeight = view.getInt32(22, true)
const bpp = view.getUint16(28, true)
if (bpp !== 24 && bpp !== 32) {
  console.error(`unsupported BMP depth ${bpp}`)
  process.exit(1)
}

const height = Math.abs(rawHeight)
const bytesPerPixel = bpp / 8
const stride = Math.ceil((width * bytesPerPixel) / 4) * 4
const pixels: Rgb[] = []
for (let y = 0; y < height; y++) {
  const row = offset + y * stride
  for (let x = 0; x < width; x++) {
    const p = row + x * bytesPerPixel
    pixels.push([bytes[p + 2] as number, bytes[p + 1] as number, bytes[p] as number])
  }
}

function distance(a: Rgb, b: Rgb): number {
  const dr = a[0] - b[0]
  const dg = a[1] - b[1]
  const db = a[2] - b[2]
  return dr * dr + dg * dg + db * db
}

const byLuma = [...pixels].sort((a, b) => a[0] * 3 + a[1] * 6 + a[2] - (b[0] * 3 + b[1] * 6 + b[2]))
let centroids: Rgb[] = Array.from({ length: k }, (_, i) => [
  ...(byLuma[Math.floor(((i + 0.5) * byLuma.length) / k)] as Rgb),
])

let assignment = new Array<number>(pixels.length).fill(0)
for (let iter = 0; iter < 24; iter++) {
  assignment = pixels.map((px) => {
    let best = 0
    let bestDist = Infinity
    centroids.forEach((c, i) => {
      const d = distance(px, c)
      if (d < bestDist) {
        bestDist = d
        best = i
      }
    })
    return best
  })
  centroids = centroids.map((c, i) => {
    const members = pixels.filter((_, p) => assignment[p] === i)
    if (members.length === 0) return c
    const sum = members.reduce<Rgb>((acc, m) => [acc[0] + m[0], acc[1] + m[1], acc[2] + m[2]], [0, 0, 0])
    return [sum[0] / members.length, sum[1] / members.length, sum[2] / members.length]
  })
}

const counts = new Array<number>(k).fill(0)
for (const a of assignment) counts[a] = (counts[a] as number) + 1

const hex = (c: Rgb) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`

const clusters = centroids
  .map((c, i) => ({ color: hex(c), share: ((counts[i] as number) / pixels.length) * 100 }))
  .sort((a, b) => b.share - a.share)
for (const { color, share } of clusters) console.log(`${color}  ${share.toFixed(1)}%`)
