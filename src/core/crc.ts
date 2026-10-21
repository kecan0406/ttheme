const TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n

  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  }

  return c >>> 0
})

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff

  for (const byte of bytes) {
    c = (TABLE[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8)
  }

  return (c ^ 0xffffffff) >>> 0
}
