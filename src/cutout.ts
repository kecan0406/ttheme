import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { decodePng, type Rgba } from './png.ts'

const TIMEOUT = 30_000
const LEAST = 3
const MOST = 97

const SCRIPT = `ObjC.import('Vision')
ObjC.import('CoreImage')
ObjC.import('CoreGraphics')
function run(argv) {
  const error = Ref()
  const image = $.CIImage.imageWithContentsOfURL($.NSURL.fileURLWithPath(argv[0]))
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

export function removeBackground(input: string, output: string, signal: AbortSignal): Promise<Rgba> {
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
      if (code !== 0) {
        reject(new Error(failure.trim().split('\n').at(-1) || `osascript exited ${code}`))
        return
      }
      try {
        resolve(decodePng(new Uint8Array(readFileSync(output))))
      } catch (error) {
        reject(error)
      }
    })
  })
}
