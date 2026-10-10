import { inflateRawSync } from 'node:zlib'
import mozjpeg, { type MozJPEGModule } from '@jsquash/jpeg/codec/dec/mozjpeg_dec.js'
import { embedded } from './embed.ts' with { type: 'macro' }
import type { Rgba } from './png.ts'

export function exifTurn(tiff: Uint8Array): number {
  const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength)
  const little = tiff[0] === 0x49 && tiff[1] === 0x49
  if (tiff.length < 8 || (!little && (tiff[0] !== 0x4d || tiff[1] !== 0x4d))) {
    return 1
  }
  const ifd = view.getUint32(4, little)
  if (ifd + 2 > tiff.length) {
    return 1
  }
  for (let entry = ifd + 2, n = view.getUint16(ifd, little); n > 0 && entry + 12 <= tiff.length; n--, entry += 12) {
    if (view.getUint16(entry, little) === 0x0112) {
      const turn = view.getUint16(entry + 8, little)
      return turn >= 1 && turn <= 8 ? turn : 1
    }
  }
  return 1
}

export function jpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return null
  }
  let turn = 1
  let at = 2
  while (at + 9 < bytes.length) {
    if (bytes[at] !== 0xff) {
      at++
      continue
    }
    const marker = bytes[at + 1] as number
    if (marker === 0xff) {
      at++
      continue
    }
    const length = ((bytes[at + 2] as number) << 8) | (bytes[at + 3] as number)
    if (marker === 0xe1 && String.fromCharCode(...bytes.subarray(at + 4, at + 10)) === 'Exif\0\0') {
      turn = exifTurn(bytes.subarray(at + 10, Math.min(bytes.length, at + 2 + length)))
    }
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const height = ((bytes[at + 5] as number) << 8) | (bytes[at + 6] as number)
      const width = ((bytes[at + 7] as number) << 8) | (bytes[at + 8] as number)
      return turn >= 5 ? { width: height, height: width } : { width, height }
    }
    at += 2 + length
  }
  return null
}

let decoder: MozJPEGModule | undefined

function opened(): MozJPEGModule {
  if (decoder) {
    return decoder
  }
  const code = new WebAssembly.Module(
    inflateRawSync(Buffer.from(embedded('@jsquash/jpeg/codec/dec/mozjpeg_dec.wasm'), 'base64')),
  )
  const loaded = {
    noInitialRun: true,
    print: () => undefined,
    printErr: () => undefined,
    instantiateWasm: (
      imports: ConstructorParameters<typeof WebAssembly.Instance>[1],
      ready: (instance: WebAssembly.Instance) => void,
    ) => {
      const instance = new WebAssembly.Instance(code, imports)
      ready(instance)
      return instance.exports
    },
  } as unknown as MozJPEGModule
  void mozjpeg(loaded as never)
  if (typeof loaded.decode !== 'function') {
    throw new Error('the JPEG decoder did not start')
  }
  decoder = loaded
  return loaded
}

export function decodeJpeg(bytes: Uint8Array, limit: number): Rgba {
  const size = jpegSize(bytes)
  if (size && size.width * size.height > limit) {
    throw new Error(`${size.width}×${size.height} is over ${limit / 1e6} megapixels`)
  }
  let image: ReturnType<MozJPEGModule['decode']> = null
  try {
    image = opened().decode(bytes, true)
  } catch {
    image = null
  }
  if (!image) {
    throw new Error('not a JPEG image this decoder can read')
  }
  return {
    width: image.width,
    height: image.height,
    data: new Uint8Array(image.data.buffer, image.data.byteOffset, image.data.length),
  }
}
