import { spawn } from 'node:child_process'
import type { Rgba } from './png.ts'

const TIMEOUT = 30_000
const LEAST = 3
const MOST = 97
const EDGE = { from: 0.45, to: 0.75 }
const REACH = 2

export const MATTING = 1

const CURVE = Uint8Array.from({ length: 256 }, (_, level) =>
  Math.round(255 * Math.min(1, Math.max(0, (level / 255 - EDGE.from) / (EDGE.to - EDGE.from)))),
)

const SCRIPT = `ObjC.import('Vision')
ObjC.import('CoreImage')
ObjC.import('CoreGraphics')
function run(argv) {
  const error = Ref()
  const image = $.CIImage.imageWithContentsOfURLOptions($.NSURL.fileURLWithPath(argv[0]),
    $.NSDictionary.dictionaryWithObjectForKey($.NSNumber.numberWithBool(true), $.kCIImageApplyOrientationProperty))
  if (!image) throw new Error('unreadable image')
  const handler = $.VNImageRequestHandler.alloc.initWithCIImageOptions(image, $({}))
  const request = $.VNGenerateForegroundInstanceMaskRequest.alloc.init
  if (!handler.performRequestsError($([request]), error)) throw new Error('vision failed')
  if (request.results.count === 0) throw new Error('no foreground')
  const found = request.results.objectAtIndex(0)
  const buffer = found.generateMaskedImageOfInstancesFromRequestHandlerCroppedToInstancesExtentError(
    found.allInstances, handler, false, error)
  if (!buffer) throw new Error('mask failed')
  const written = $.CIContext.context.writePNGRepresentationOfImageToURLFormatColorSpaceOptionsError(
    $.CIImage.imageWithCVPixelBuffer(buffer), $.NSURL.fileURLWithPath(argv[1]), $.kCIFormatRGBA8,
    $.CGColorSpaceCreateWithName($.kCGColorSpaceSRGB), $({}), error)
  if (!written) throw new Error('write failed')
}`

export function canRemoveBackground(): boolean {
  return process.platform === 'darwin'
}

export function keepable(clear: number): boolean {
  return clear >= LEAST && clear <= MOST
}

export function matte(image: Rgba): Rgba {
  const { width, height } = image
  const data = image.data.slice()
  for (let at = 3; at < data.length; at += 4) {
    data[at] = CURVE[data[at] as number] as number
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4
      const a = data[at + 3] as number
      if (a === 0 || a === 255) {
        continue
      }
      let r = 0
      let g = 0
      let b = 0
      let n = 0
      for (let near = Math.max(0, y - REACH); near <= Math.min(height - 1, y + REACH); near++) {
        for (let across = Math.max(0, x - REACH); across <= Math.min(width - 1, x + REACH); across++) {
          const o = (near * width + across) * 4
          if (data[o + 3] === 255) {
            r += data[o] as number
            g += data[o + 1] as number
            b += data[o + 2] as number
            n++
          }
        }
      }
      if (n > 0) {
        data[at] = Math.round(r / n)
        data[at + 1] = Math.round(g / n)
        data[at + 2] = Math.round(b / n)
      }
    }
  }
  return { width, height, data }
}

export function removeBackground(input: string, output: string, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('osascript', ['-l', 'JavaScript', '-e', SCRIPT, input, output], {
      stdio: ['ignore', 'ignore', 'pipe'],
      signal: AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT)]),
    })
    let failure = ''
    child.stderr.on('data', (chunk: Buffer) => {
      failure += chunk
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(failure.trim().split('\n').at(-1) || `osascript exited ${code}`))
    })
  })
}
