import { crc32 } from './crc.ts'

export interface Packed {
  path: string
  text: string
}

const UTF8_NAMES = 0x0800
const MADE_ON_UNIX = 0x0314
const FILE_MODE = 0o100644 << 16

function dosTime(at: Date) {
  return {
    time: (at.getHours() << 11) | (at.getMinutes() << 5) | Math.floor(at.getSeconds() / 2),
    date: ((Math.max(1980, at.getFullYear()) - 1980) << 9) | ((at.getMonth() + 1) << 5) | at.getDate(),
  }
}

export function zip(files: readonly Packed[], at: Date): Uint8Array {
  const { time, date } = dosTime(at)
  const encoder = new TextEncoder()
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0

  for (const file of files) {
    const name = encoder.encode(file.path)
    const data = encoder.encode(file.text)
    const crc = crc32(data)
    const local = new Uint8Array(30 + name.length + data.length)
    const head = new DataView(local.buffer)
    head.setUint32(0, 0x04034b50, true)
    head.setUint16(4, 20, true)
    head.setUint16(6, UTF8_NAMES, true)
    head.setUint16(8, 0, true)
    head.setUint16(10, time, true)
    head.setUint16(12, date, true)
    head.setUint32(14, crc, true)
    head.setUint32(18, data.length, true)
    head.setUint32(22, data.length, true)
    head.setUint16(26, name.length, true)
    head.setUint16(28, 0, true)
    local.set(name, 30)
    local.set(data, 30 + name.length)

    const central = new Uint8Array(46 + name.length)
    const entry = new DataView(central.buffer)
    entry.setUint32(0, 0x02014b50, true)
    entry.setUint16(4, MADE_ON_UNIX, true)
    entry.setUint16(6, 20, true)
    entry.setUint16(8, UTF8_NAMES, true)
    entry.setUint16(10, 0, true)
    entry.setUint16(12, time, true)
    entry.setUint16(14, date, true)
    entry.setUint32(16, crc, true)
    entry.setUint32(20, data.length, true)
    entry.setUint32(24, data.length, true)
    entry.setUint16(28, name.length, true)
    entry.setUint32(38, FILE_MODE >>> 0, true)
    entry.setUint32(42, offset, true)
    central.set(name, 46)

    locals.push(local)
    centrals.push(central)
    offset += local.length
  }

  const size = centrals.reduce((sum, central) => sum + central.length, 0)
  const end = new Uint8Array(22)
  const tail = new DataView(end.buffer)
  tail.setUint32(0, 0x06054b50, true)
  tail.setUint16(8, files.length, true)
  tail.setUint16(10, files.length, true)
  tail.setUint32(12, size, true)
  tail.setUint32(16, offset, true)

  const out = new Uint8Array(offset + size + end.length)
  let written = 0

  for (const part of [...locals, ...centrals, end]) {
    out.set(part, written)
    written += part.length
  }

  return out
}
