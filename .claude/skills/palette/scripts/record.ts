import { parseArgs } from 'node:util'
import { type Anchor, loadAnchors, readTheme, width } from './audit.ts'

const WRAP = 74
const GAP = '   '

function wrap(head: string, items: string[], sep: string): string[] {
  const lines: string[] = []
  let line = `  ${head}`
  let fresh = true
  for (const item of items) {
    if (!fresh && width(line) + sep.length + width(item) > WRAP) {
      lines.push(line)
      line = '  '
      fresh = true
    }
    line += fresh ? item : sep + item
    fresh = false
  }
  lines.push(line)
  return lines
}

const shown = ([part, hex]: Anchor) => `${hex.toLowerCase()} ${part}`

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: { anchors: { type: 'string' } },
  allowPositionals: true,
})
if (values.anchors === undefined || positionals.length === 0) {
  console.error('usage: bun record.ts --anchors <file> themes/<name>.toml [...]')
  process.exit(1)
}

const anchors = await loadAnchors(values.anchors)
const blocks: string[] = []
for (const file of positionals) {
  const { meta } = await readTheme(file)
  const entry = anchors[meta.name]
  const slots = entry?.slots ?? {}
  const lines = [`${meta.name} — ${meta.ansi_source}, signature ${meta.signature.join('/')}`]
  const measured = meta.signature.map((slot) => {
    const anchor = slots[slot]
    return anchor === undefined ? `${slot} unmeasured` : shown(anchor)
  })
  const stray = Object.entries(slots)
    .filter(([slot]) => !meta.signature.includes(slot))
    .map(([slot, anchor]) => `${shown(anchor)} (${slot}, not in signature)`)
  lines.push(...wrap('', [...measured, ...stray], GAP))
  if (entry !== undefined && entry.unused.length > 0)
    lines.push(...wrap('also measured: ', entry.unused.map(shown), GAP))
  if (entry?.note) lines.push(...wrap('note: ', entry.note.split(/\s+/).filter(Boolean), ' '))
  blocks.push(lines.join('\n'))
}
console.log(blocks.join('\n'))
