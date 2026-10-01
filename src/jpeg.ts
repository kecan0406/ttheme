import { inflateRawSync } from 'node:zlib'
import mozjpeg, { type MozJPEGModule } from '@jsquash/jpeg/codec/dec/mozjpeg_dec.js'
import { embedded } from './embed.ts' with { type: 'macro' }
import type { Rgba } from './png.ts'

export function jpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return null
  }
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
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return {
        height: ((bytes[at + 5] as number) << 8) | (bytes[at + 6] as number),
        width: ((bytes[at + 7] as number) << 8) | (bytes[at + 8] as number),
      }
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
