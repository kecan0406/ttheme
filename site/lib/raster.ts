import { inflateRawSync } from 'node:zlib'
import { initWasm, Resvg } from '@resvg/resvg-wasm'
import { face, local, symbols, wasm } from './embed.ts' with { type: 'macro' }

const PACKED = {
  wasm: wasm('@resvg/resvg-wasm/index_bg.wasm'),
  display: face('@fontsource/nunito/900.css', 'nunito-latin-900-normal.woff2'),
  ui: face('@fontsource-variable/inter/index.css', 'inter-latin-wght-normal.woff2', 500),
  regular: local('JetBrainsMono-Regular.woff2'),
  bold: local('JetBrainsMono-Bold.woff2'),
  symbols: symbols('@fontsource/biz-udgothic/400.css', '☆★'),
}

const MEASURED = 4000

export interface Ink {
  x: number
  width: number
}

export interface Raster {
  family: { display: string; ui: string; mono: string }
  ink(text: string, family: string, size: number, weight: number, spacing: number): Ink
  fit(text: string, family: string, weight: number, width: number, max: number, em?: number): number
  png(svg: string): Buffer
}

function unpack(data: string): Uint8Array {
  return new Uint8Array(inflateRawSync(Buffer.from(data, 'base64')))
}

function familyOf(font: Uint8Array): string {
  const view = new DataView(font.buffer, font.byteOffset, font.byteLength)
  for (let table = 0, tables = view.getUint16(4); table < tables; table++) {
    const entry = 12 + table * 16
    if (String.fromCharCode(...font.subarray(entry, entry + 4)) !== 'name') continue
    const start = view.getUint32(entry + 8)
    const strings = start + view.getUint16(start + 4)
    for (let record = 0, records = view.getUint16(start + 2); record < records; record++) {
      const at = start + 6 + record * 12
      if (view.getUint16(at) !== 3 || view.getUint16(at + 6) !== 1) continue
      const from = strings + view.getUint16(at + 10)
      return new TextDecoder('utf-16be').decode(font.subarray(from, from + view.getUint16(at + 8)))
    }
  }
  throw new Error('a card font carries no family name')
}

async function start(): Promise<Raster> {
  const [engine, ...faces] = await Promise.all([
    PACKED.wasm,
    PACKED.display,
    PACKED.ui,
    PACKED.regular,
    PACKED.bold,
    PACKED.symbols,
  ])
  await initWasm(unpack(engine))
  const [display, ui, regular, bold, symbols] = faces.map(unpack) as [
    Uint8Array,
    Uint8Array,
    Uint8Array,
    Uint8Array,
    Uint8Array,
  ]
  const family = { display: familyOf(display), ui: familyOf(ui), mono: familyOf(regular) }
  const every = [display, ui, regular, bold, symbols]
  const only = new Map([
    [family.display, [display]],
    [family.ui, [ui]],
    [family.mono, [regular, bold]],
  ])
  const measured = new Map<string, Ink>()

  function view(fontBuffers: Uint8Array[]) {
    return { font: { fontBuffers, loadSystemFonts: false, defaultFontFamily: family.ui } }
  }

  function ink(text: string, name: string, size: number, weight: number, spacing: number): Ink {
    const key = `${name}|${size}|${weight}|${spacing}|${text}`
    const held = measured.get(key)
    if (held) return held
    const body = text.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="4000" height="${Math.ceil(size * 2)}"><text x="0" y="${size * 1.3}" font-family="${name}" font-size="${size}" font-weight="${weight}" letter-spacing="${spacing}" xml:space="preserve">${body}</text></svg>`
    const fonts = /[^\u0020-\u00ff]/.test(text) ? [...(only.get(name) ?? []), symbols] : (only.get(name) ?? every)
    const resvg = new Resvg(svg, view(fonts))
    const box = resvg.getBBox()
    resvg.free()
    const found = { x: box?.x ?? 0, width: box?.width ?? 0 }
    if (measured.size >= MEASURED) measured.clear()
    measured.set(key, found)
    return found
  }

  return {
    family,
    ink,
    fit(text, name, weight, width, max, em = 0) {
      const probe = 100
      const wide = ink(text, name, probe, weight, em * probe).width
      return wide === 0 ? max : Math.min(max, Math.floor((probe * width) / wide))
    },
    png(svg) {
      const resvg = new Resvg(svg, view(every))
      const image = resvg.render()
      const bytes = Buffer.from(image.asPng())
      image.free()
      resvg.free()
      return bytes
    },
  }
}

let started: Promise<Raster> | undefined

export function raster(): Promise<Raster> {
  started ??= start()
  return started
}
