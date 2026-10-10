import { execFileSync } from 'node:child_process'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { Terminal } from '@xterm/headless'

interface Cell {
  char: string
  width: number
  fg: string
  bg: string
  ink: string
  ground: string
  attrs: string
}

interface Shown {
  background: string
  foreground: string
  ansi: string[]
}

const BLOCKS: Record<string, [number, number, number, number]> = {
  '▀': [0, 0, 1, 0.5],
  '▄': [0, 0.5, 1, 0.5],
  '█': [0, 0, 1, 1],
  '▌': [0, 0, 0.5, 1],
  '▐': [0.5, 0, 0.5, 1],
}

const CUBE = [0, 95, 135, 175, 215, 255]

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    rows: { type: 'string' },
    cols: { type: 'string' },
    emit: { type: 'string', default: 'png,txt' },
    against: { type: 'string' },
  },
})

const [capture, size, out] = positionals
const match = /^(\d+)x(\d+)$/.exec(size ?? '')
if (!capture || !match || !out) {
  console.error(
    'usage: bun tests/look.ts <capture.ansi> <cols>x<rows> <out> [--rows a-b] [--cols a-b] [--emit png,txt,styles] [--against <before.ansi>]',
  )
  process.exit(2)
}
const cols = Number(match[1])
const rows = Number(match[2])
const emit = new Set((values.emit ?? '').split(','))

function span(value: string | undefined, count: number): [number, number] {
  if (!value) {
    return [0, count - 1]
  }
  const [from, to] = value.split('-').map(Number)
  const first = Math.max(0, from ?? 0)
  return [first, Math.min(count - 1, to === undefined || Number.isNaN(to) ? first : to)]
}

const [top, bottom] = span(values.rows, rows)
const [left, right] = span(values.cols, cols)
const cropped = values.rows !== undefined || values.cols !== undefined

const fixture = JSON.parse(readFileSync(join(import.meta.dirname, 'fixture.json'), 'utf8')) as {
  palettes: (Shown & { default?: boolean })[]
}
const shown = fixture.palettes.find((p) => p.default) ?? fixture.palettes[0]
if (!shown) {
  throw new Error('tests/fixture.json has no palette')
}

function hex(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`
}

function indexed(n: number, palette: Shown): string {
  if (n < 16) {
    return palette.ansi[n] ?? palette.foreground
  }
  if (n < 232) {
    const at = n - 16
    const [r, g, b] = [Math.floor(at / 36), Math.floor(at / 6) % 6, at % 6].map((i) => CUBE[i] ?? 0)
    return hex(((r ?? 0) << 16) | ((g ?? 0) << 8) | (b ?? 0))
  }
  const grey = 8 + (n - 232) * 10
  return hex((grey << 16) | (grey << 8) | grey)
}

async function gridOf(file: string, palette: Shown): Promise<Cell[][]> {
  const term = new Terminal({ cols, rows, allowProposedApi: true })
  const lines = readFileSync(file, 'utf8').replace(/\n$/, '').split('\n').slice(0, rows)
  await new Promise<void>((done) => term.write(lines.map((line, i) => `\x1b[${i + 1};1H\x1b[0m${line}`).join(''), done))
  const grid: Cell[][] = []
  const buffer = term.buffer.active
  for (let y = 0; y < rows; y++) {
    const line = buffer.getLine(y)
    const row: Cell[] = []
    for (let x = 0; x < cols; x++) {
      const c = line?.getCell(x)
      if (!c) {
        continue
      }
      const ink = c.isFgDefault() ? '-' : c.isFgRGB() ? hex(c.getFgColor()) : String(c.getFgColor())
      const ground = c.isBgDefault() ? '-' : c.isBgRGB() ? hex(c.getBgColor()) : String(c.getBgColor())
      let fg = c.isFgDefault()
        ? palette.foreground
        : c.isFgRGB()
          ? hex(c.getFgColor())
          : indexed(c.getFgColor(), palette)
      let bg = c.isBgDefault()
        ? palette.background
        : c.isBgRGB()
          ? hex(c.getBgColor())
          : indexed(c.getBgColor(), palette)
      if (c.isInverse()) {
        ;[fg, bg] = [bg, fg]
      }
      const attrs = [
        c.isBold() ? 'b' : '',
        c.isDim() ? 'd' : '',
        c.isItalic() ? 'i' : '',
        c.isUnderline() ? 'u' : '',
        c.isInverse() ? 'r' : '',
      ].join('')
      row.push({ char: c.getChars(), width: c.getWidth(), fg, bg, ink, ground, attrs })
    }
    grid.push(row)
  }
  return grid
}

const grid = await gridOf(capture, shown)

function textOf(cells: Cell[]): string {
  return cells.map((c) => (c.width === 0 ? '' : c.char || ' ')).join('')
}

function runsOf(row: Cell[]): { at: string; style: string }[] {
  const runs: { at: string; style: string }[] = []
  let x = left
  while (x <= right && x < row.length) {
    const first = row[x] as Cell
    const key = `${first.ink} ${first.ground} ${first.attrs}`
    let end = x
    while (end <= right && end < row.length && `${row[end]?.ink} ${row[end]?.ground} ${row[end]?.attrs}` === key) {
      end++
    }
    if (key !== '- - ') {
      const text = textOf(row.slice(x, end)).trim()
      const clipped = text.length > 40 ? `${text.slice(0, 40)}…` : text
      runs.push({
        at: `${x}-${end - 1}`,
        style: `fg=${first.ink} bg=${first.ground}${first.attrs ? ` ${first.attrs}` : ''}${clipped ? ` ${JSON.stringify(clipped)}` : ''}`,
      })
    }
    x = end
  }
  return runs
}

const written: string[] = []

if (emit.has('txt')) {
  const ruler = Array.from({ length: right - left + 1 }, (_, i) =>
    (left + i) % 10 === 0 ? String(((left + i) / 10) % 10) : ' ',
  )
  const body = grid
    .slice(top, bottom + 1)
    .map((row, i) => `${String(top + i).padStart(2)}│${textOf(row.slice(left, right + 1)).trimEnd()}`)
  writeFileSync(`${out}.txt`, `  │${ruler.join('')}\n${body.join('\n')}\n`)
  written.push(`${out}.txt`)
}

if (emit.has('styles')) {
  const runs = grid.slice(top, bottom + 1).flatMap((row, i) => runsOf(row).map((r) => `${top + i} ${r.at} ${r.style}`))
  writeFileSync(
    `${out}.styles`,
    `# row cols fg bg [b bold, d dim, i italic, u underline, r reverse] text — a color is a palette slot (0-255), a truecolor #hex, or - for the default\n${runs.join('\n')}\n`,
  )
  written.push(`${out}.styles`)
}

if (emit.has('png')) {
  const cw = cropped ? 14 : 7
  const ch = cropped ? 28 : 14
  const font = Math.round(ch * 0.78)
  const width = (right - left + 1) * cw
  const height = (bottom - top + 1) * ch
  const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" font-family="Menlo, DejaVu Sans Mono, monospace" font-size="${font}">`,
    `<rect width="${width}" height="${height}" fill="${shown.background}"/>`,
  ]
  for (let y = top; y <= bottom; y++) {
    const row = grid[y] ?? []
    for (let x = left; x <= right; x++) {
      const c = row[x]
      if (!c || c.width === 0) {
        continue
      }
      const px = (x - left) * cw
      const py = (y - top) * ch
      const w = Math.max(1, c.width) * cw
      const dim = c.attrs.includes('d') ? ' opacity="0.55"' : ''
      if (c.bg !== shown.background) {
        svg.push(`<rect x="${px}" y="${py}" width="${w}" height="${ch}" fill="${c.bg}"/>`)
      }
      const block = BLOCKS[c.char]
      if (block) {
        const [bx, by, bw, bh] = block
        svg.push(
          `<rect x="${px + bx * w}" y="${py + by * ch}" width="${bw * w}" height="${bh * ch}" fill="${c.fg}"${dim}/>`,
        )
      } else if (c.char.trim()) {
        const weight = c.attrs.includes('b') ? ' font-weight="bold"' : ''
        const slant = c.attrs.includes('i') ? ' font-style="italic"' : ''
        svg.push(`<text x="${px}" y="${py + font}" fill="${c.fg}"${weight}${slant}${dim}>${xml(c.char)}</text>`)
      }
      if (c.attrs.includes('u')) {
        svg.push(`<rect x="${px}" y="${py + ch - 2}" width="${w}" height="1" fill="${c.fg}"/>`)
      }
    }
  }
  svg.push('</svg>')
  writeFileSync(`${out}.svg`, svg.join('\n'))
  try {
    execFileSync('rsvg-convert', ['-o', `${out}.png`, `${out}.svg`])
    written.push(`${out}.png`)
  } catch {
    console.error('look: no png — rsvg-convert is missing (brew install librsvg, apt install librsvg2-bin)')
  } finally {
    rmSync(`${out}.svg`, { force: true })
  }
}

console.log(written.join('\n'))

if (values.against) {
  const before = await gridOf(values.against, shown)
  const hint = (text: string) => text.replace(/Search…[^│]*/, 'Search… ‹hint›')
  const lines: string[] = []
  let moved = 0
  for (let y = top; y <= bottom; y++) {
    const was = before[y] ?? []
    const now = grid[y] ?? []
    const a = hint(textOf(was.slice(left, right + 1)).trimEnd())
    const b = hint(textOf(now.slice(left, right + 1)).trimEnd())
    const ra = runsOf(was).map((r) => ({ ...r, style: hint(r.style) }))
    const rb = runsOf(now).map((r) => ({ ...r, style: hint(r.style) }))
    const gone = ra.filter((r) => !rb.some((o) => o.style === r.style))
    const came = rb.filter((r) => !ra.some((o) => o.style === r.style))
    if (a === b && gone.length === 0 && came.length === 0) {
      continue
    }
    moved++
    const row = String(y).padStart(2)
    lines.push(
      ...(a === b ? [`${row}   ${b}`] : [`${row} - ${a}`, `${row} + ${b}`]),
      ...gone.map((r) => `     - ${r.at} ${r.style}`),
      ...came.map((r) => `     + ${r.at} ${r.style}`),
    )
  }
  console.log(
    moved
      ? `${moved} of ${bottom - top + 1} rows differ from before (- before, + now, then the styled runs that went or came):\n${lines.join('\n')}`
      : 'no row differs from before',
  )
}
