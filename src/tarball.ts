import { gunzipSync } from 'node:zlib'

const BLOCK = 512
const LIMIT = 64 * 1024 * 1024
const text = new TextDecoder()

function field(header: Uint8Array, from: number, length: number): string {
  const bytes = header.subarray(from, from + length)
  const end = bytes.indexOf(0)
  return text.decode(end < 0 ? bytes : bytes.subarray(0, end))
}

function sizeOf(header: Uint8Array): number {
  if ((header[124] ?? 0) & 0x80) {
    throw new Error('the archive holds a file too large to be a palette')
  }
  const size = Number.parseInt(field(header, 124, 12).trim() || '0', 8)
  if (!Number.isFinite(size) || size < 0) {
    throw new Error('the archive has a header that does not read')
  }
  return size
}

function paxPath(data: Uint8Array): string | undefined {
  let at = 0
  let path: string | undefined
  while (at < data.length) {
    const space = data.indexOf(0x20, at)
    const length = space < 0 ? Number.NaN : Number.parseInt(text.decode(data.subarray(at, space)), 10)
    if (!Number.isFinite(length) || length <= 0) {
      break
    }
    const record = text.decode(data.subarray(space + 1, at + length - 1))
    const eq = record.indexOf('=')
    if (record.slice(0, eq) === 'path') {
      path = record.slice(eq + 1)
    }
    at += length
  }
  return path
}

function inflate(bytes: Uint8Array): Uint8Array {
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) {
    return bytes
  }
  try {
    return gunzipSync(bytes, { maxOutputLength: LIMIT })
  } catch (error) {
    throw new Error(
      error instanceof RangeError
        ? `the archive unpacks to more than ${LIMIT / 1024 / 1024} MB`
        : 'the archive is not a gzip file that reads',
    )
  }
}

export function untar(archive: Uint8Array): Map<string, Uint8Array> {
  const tar = inflate(archive)
  const files = new Map<string, Uint8Array>()
  let next: string | undefined
  let at = 0
  while (at + BLOCK <= tar.length) {
    const header = tar.subarray(at, at + BLOCK)
    if (header.every((b) => b === 0)) {
      break
    }
    const size = sizeOf(header)
    const data = tar.subarray(at + BLOCK, at + BLOCK + size)
    at += BLOCK + Math.ceil(size / BLOCK) * BLOCK
    const type = String.fromCharCode(header[156] ?? 0)
    if (type === 'x') {
      next = paxPath(data) ?? next
      continue
    }
    if (type === 'L') {
      next = field(data, 0, data.length)
      continue
    }
    const prefix = field(header, 257, 5) === 'ustar' ? field(header, 345, 155) : ''
    const path = next ?? (prefix ? `${prefix}/${field(header, 0, 100)}` : field(header, 0, 100))
    next = undefined
    if (type === '0' || type === '\0') {
      files.set(path.split('/').slice(1).join('/'), data)
    }
  }
  return files
}
