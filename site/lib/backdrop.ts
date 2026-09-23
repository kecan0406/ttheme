import type { Placement, Tone } from './themes'

export interface Picture {
  source: HTMLCanvasElement
  width: number
  height: number
  clear: number
}

const SOLID = 25
const LONGEST = 1400

function channels(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]
}

export function readPicture(image: HTMLImageElement): Picture {
  const k = Math.min(1, LONGEST / Math.max(image.naturalWidth, image.naturalHeight))
  const w = Math.max(1, Math.round(image.naturalWidth * k))
  const h = Math.max(1, Math.round(image.naturalHeight * k))
  const scratch = document.createElement('canvas')
  scratch.width = w
  scratch.height = h
  const context = scratch.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D
  context.drawImage(image, 0, 0, w, h)
  const data = context.getImageData(0, 0, w, h).data
  let x0 = w
  let y0 = h
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if ((data[(y * w + x) * 4 + 3] ?? 0) > SOLID) {
        x0 = Math.min(x0, x)
        x1 = Math.max(x1, x)
        y0 = Math.min(y0, y)
        y1 = Math.max(y1, y)
      }
    }
  }
  if (x1 < 0) {
    x0 = 0
    y0 = 0
    x1 = w - 1
    y1 = h - 1
  }
  const width = x1 - x0 + 1
  const height = y1 - y0 + 1
  const out = new ImageData(width, height)
  let clear = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const from = ((y + y0) * w + x + x0) * 4
      const to = (y * width + x) * 4
      const alpha = data[from + 3] ?? 0
      if (alpha <= SOLID) clear++
      const gray = 0.299 * (data[from] ?? 0) + 0.587 * (data[from + 1] ?? 0) + 0.114 * (data[from + 2] ?? 0)
      out.data[to] = gray
      out.data[to + 1] = gray
      out.data[to + 2] = gray
      out.data[to + 3] = alpha
    }
  }
  const source = document.createElement('canvas')
  source.width = width
  source.height = height
  ;(source.getContext('2d') as CanvasRenderingContext2D).putImageData(out, 0, 0)
  return { source, width, height, clear: Math.round((clear * 100) / (width * height)) }
}

export function isCutout(picture: Picture, placement: Placement): boolean {
  return picture.clear >= placement.stands
}

function frame(picture: Picture, placement: Placement, W: number, H: number) {
  const { width: w, height: h } = picture
  if (!isCutout(picture, placement)) {
    if (w * H > h * W) {
      const cw = (h * W) / H
      return { sx: (w - cw) / 2, sy: 0, sw: cw, sh: h, dx: 0, dy: 0, dw: W, dh: H }
    }
    return { sx: 0, sy: 0, sw: w, sh: (w * H) / W, dx: 0, dy: 0, dw: W, dh: H }
  }
  let dh = Math.max(placement.tall * H, (placement.reach * W * h) / w)
  let dw = (dh * w) / h
  if (dw > placement.widest * W) {
    dw = placement.widest * W
    dh = (dw * h) / w
  }
  const dy = placement.headroom * H
  const shown = Math.min(1, (H - dy) / dh)
  return { sx: 0, sy: 0, sw: w, sh: h * shown, dx: W * (1 - placement.margin) - dw, dy, dw, dh: dh * shown }
}

export function layer(picture: Picture, placement: Placement, W: number, H: number): Uint8ClampedArray {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const context = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D
  context.imageSmoothingQuality = 'high'
  const f = frame(picture, placement, W, H)
  context.drawImage(picture.source, f.sx, f.sy, f.sw, f.sh, f.dx, f.dy, f.dw, f.dh)
  return context.getImageData(0, 0, W, H).data
}

export function paint(
  canvas: HTMLCanvasElement,
  gray: Uint8ClampedArray | null,
  background: string,
  tone: Tone,
  opacity: number,
): void {
  const { width, height } = canvas
  const context = canvas.getContext('2d') as CanvasRenderingContext2D
  const bg = channels(background)
  if (!gray) {
    context.fillStyle = background
    context.fillRect(0, 0, width, height)
    return
  }
  const to = channels(tone.color)
  const image = context.createImageData(width, height)
  const out = image.data
  for (let i = 0; i < out.length; i += 4) {
    const a = ((gray[i + 3] ?? 0) / 255) * opacity
    const g = (gray[i] ?? 0) / 255
    for (let c = 0; c < 3; c++) {
      const b = bg[c] as number
      out[i + c] = b * (1 - a) + (b + ((to[c] as number) - b) * g) * a
    }
    out[i + 3] = 255
  }
  context.putImageData(image, 0, 0)
}
