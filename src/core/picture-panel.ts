export type PictureSize = 'fill' | number

export const TUNE = { colors: 0, size: 1, position: 2, opacity: 3 } as const

export const TUNE_ROWS = [
  { label: 'Colors', row: 0 },
  { label: 'Size', row: 1 },
  { label: 'Position', row: 4 },
  { label: 'Opacity', row: 7 },
] as const

export const TUNE_COLORINGS = [
  ['original', 'original'],
  ['tone', 'tinted'],
] as const

export const TUNE_VALUE_AT = 12
export const TUNE_SPARE = 21
export const TUNE_TRACK_LEAST = 8
export const TUNE_SIZE_LEAST = 20
export const TUNE_SIZE_WHOLE = 100
export const STRIP = { rows: 3, gap: 3, most: 3, step: 2 } as const

export function tuneTrack(col: number, end: number): number {
  return Math.max(TUNE_TRACK_LEAST, end - col - TUNE_SPARE)
}

export function stripShown(count: number, cols: number, room: number): number {
  return Math.max(1, Math.min(count, STRIP.most, Math.floor((room + 1) / (cols + STRIP.gap))))
}

export function stripFirst(focus: number, count: number, show: number): number {
  return Math.max(0, Math.min(count - show, focus - Math.floor(show / 2)))
}

export function frameCells(cols: number): number {
  return 2 * (cols + 2) + 2 * STRIP.rows
}

export function orbitLit(cell: number, tip: number, cells: number): boolean {
  return (tip - cell + cells) % cells < Math.floor(cells / 3)
}

export function resized(size: PictureSize, step: number, fill: number): PictureSize {
  if (step < 0) {
    if (size !== 'fill') {
      return Math.max(TUNE_SIZE_LEAST, size + step)
    }

    if (!fill) {
      return size
    }

    return Math.max(TUNE_SIZE_LEAST, Math.max(TUNE_SIZE_WHOLE, fill) + step + 1)
  }

  return size === 'fill' || size + step > fill ? 'fill' : size + step
}
