import { createRequire } from 'node:module'

const { Terminal } = createRequire(import.meta.url)('@xterm/headless')
const [cols, rows] = process.argv.slice(2).map(Number)
const term = new Terminal({ cols, rows, scrollback: 0, allowProposedApi: true })

const text = () => {
  const buffer = term.buffer.active
  const lines = []
  for (let y = 0; y < term.rows; y++) {
    lines.push((buffer.getLine(buffer.viewportY + y)?.translateToString(true) ?? '').trimEnd())
  }
  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop()
  }
  return lines.join('\n')
}

let held = Buffer.alloc(0)
process.stdin.on('data', (chunk) => {
  held = Buffer.concat([held, chunk])
  while (held.length >= 5) {
    const size = held.readUInt32BE(1)
    if (held.length < 5 + size) {
      break
    }
    const kind = String.fromCharCode(held[0] ?? 0)
    const body = Uint8Array.from(held.subarray(5, 5 + size))
    held = held.subarray(5 + size)
    if (kind === 'd') {
      term.write(body)
    } else if (kind === 't') {
      term.write('', () => process.stdout.write(`${text()}\0`))
    }
  }
})
