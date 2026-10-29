import { contrast, type Hex } from './color.ts'
import { mixOk } from './oklab.ts'

export type Point = readonly [number, number]

type Arc = { center: Point; radius: number; from: number; to: number }

type Step = { line: Point } | { arc: Arc } | { curve: readonly [Point, Point, Point] }

export interface Stroke {
  start: Point
  steps: readonly Step[]
  width: number
  tone: 0 | 1 | 2
}

const CORNER: Point = [19.49, 31.5]

const TURN = Math.atan2(27.77 - 31.5, 22.82 - 19.49)

export const STROKES: readonly Stroke[] = [
  {
    start: [22.82, 27.77],
    steps: [{ arc: { center: CORNER, radius: 5, from: TURN, to: -TURN } }, { line: [13, 44] }],
    width: 8,
    tone: 2,
  },
  {
    start: [13, 19],
    steps: [{ line: [22.82, 27.77] }],
    width: 8,
    tone: 1,
  },
  {
    start: [34.55, 37.84],
    steps: [
      {
        curve: [
          [34.55, 42.1],
          [36.29, 45.55],
          [38.43, 45.55],
        ],
      },
      {
        curve: [
          [40.57, 45.55],
          [42.3, 43.41],
          [42.3, 40.78],
        ],
      },
      {
        curve: [
          [42.3, 43.41],
          [44.03, 45.55],
          [46.17, 45.55],
        ],
      },
      {
        curve: [
          [48.31, 45.55],
          [50.05, 42.1],
          [50.05, 37.84],
        ],
      },
    ],
    width: 4.9,
    tone: 0,
  },
]

export const GLYPH = { x: 9, y: 15, width: 43.5, height: 33 }

export const CENTER: Point = [28.6, 33.3]

export const TILE = 0.92

export const APP = 0.85

export const PIXELS: readonly (readonly [number, number, 0 | 1 | 2, number])[] = [
  [3, 4, 1, 0.6],
  [4, 4, 1, 1],
  [5, 4, 1, 0.5],
  [4, 5, 1, 0.6],
  [5, 5, 1, 1],
  [6, 5, 1, 0.5],
  [5, 6, 1, 0.6],
  [6, 6, 1, 1],
  [7, 6, 1, 0.4],
  [5, 7, 1, 0.25],
  [6, 7, 1, 1],
  [7, 7, 2, 1],
  [5, 8, 2, 0.25],
  [6, 8, 2, 1],
  [7, 8, 2, 1],
  [5, 9, 2, 0.6],
  [6, 9, 2, 1],
  [7, 9, 2, 0.4],
  [4, 10, 2, 0.6],
  [5, 10, 2, 1],
  [6, 10, 2, 0.5],
  [3, 11, 2, 0.6],
  [4, 11, 2, 1],
  [5, 11, 2, 0.5],
  [9, 9, 0, 1],
  [13, 9, 0, 1],
  [9, 10, 0, 1],
  [11, 10, 0, 1],
  [13, 10, 0, 1],
  [10, 11, 0, 1],
  [12, 11, 0, 1],
]

const cut = (value: number) => Math.round(value * 100) / 100

function endOf({ center, radius, to }: Arc): Point {
  return [center[0] + radius * Math.cos(to), center[1] + radius * Math.sin(to)]
}

export function pathOf({ start, steps }: Stroke): string {
  const parts = [`M${cut(start[0])} ${cut(start[1])}`]

  for (const step of steps) {
    if ('line' in step) parts.push(`L${cut(step.line[0])} ${cut(step.line[1])}`)
    else if ('arc' in step) {
      const [x, y] = endOf(step.arc)
      const sweep = step.arc.to > step.arc.from ? 1 : 0
      parts.push(`A${step.arc.radius} ${step.arc.radius} 0 0 ${sweep} ${cut(x)} ${cut(y)}`)
    } else parts.push(`C${step.curve.map(([x, y]) => `${cut(x)} ${cut(y)}`).join(' ')}`)
  }

  return parts.join('')
}

export function pointsOf({ start, steps }: Stroke): Point[] {
  const points: Point[] = [start]
  let at = start

  for (const step of steps) {
    if ('line' in step) {
      const [x, y] = step.line
      const count = Math.max(1, Math.ceil(Math.hypot(x - at[0], y - at[1]) / 0.5))
      const from = at

      for (let i = 1; i <= count; i++)
        points.push([from[0] + ((x - from[0]) * i) / count, from[1] + ((y - from[1]) * i) / count])
      at = step.line
    } else if ('arc' in step) {
      const { center, radius, from, to } = step.arc

      for (let i = 1; i <= 24; i++) {
        const turn = from + ((to - from) * i) / 24
        points.push([center[0] + radius * Math.cos(turn), center[1] + radius * Math.sin(turn)])
      }

      at = endOf(step.arc)
    } else {
      const [a, b, c] = step.curve
      const from = at

      for (let i = 1; i <= 24; i++) {
        const t = i / 24
        const u = 1 - t
        const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t] as const
        points.push([
          w[0] * from[0] + w[1] * a[0] + w[2] * b[0] + w[3] * c[0],
          w[0] * from[1] + w[1] * a[1] + w[2] * b[1] + w[3] * c[1],
        ])
      }

      at = c
    }
  }

  return points
}

export function marksOf(background: Hex, foreground: Hex, cursor: Hex, selection: Hex): Hex[] {
  return [cursor, selection, foreground].map((color) => {
    let mark = color

    for (let step = 1; step <= 20 && contrast(mark, background) < 3; step++) mark = mixOk(color, foreground, step / 20)

    return mark
  })
}

export function placed(scale: number): string {
  return `translate(32 32) scale(${scale}) translate(${-CENTER[0]} ${-CENTER[1]})`
}

export function glyphSvg(inks: readonly string[], transform: string): string {
  const paths = STROKES.map(
    (stroke) => `<path d='${pathOf(stroke)}' stroke='${inks[stroke.tone]}' stroke-width='${stroke.width}'/>`,
  )

  return `<g fill='none' stroke-linecap='round' stroke-linejoin='round' transform='${transform}'>${paths.join('')}</g>`
}

export function tileBody(background: string, hair: string, inks: readonly string[], line = 4): string {
  return `<rect x='${line / 2}' y='${line / 2}' width='${64 - line}' height='${64 - line}' rx='${14 - line / 2}' fill='${background}' stroke='${hair}' stroke-width='${line}'/>${glyphSvg(inks, placed(TILE))}`
}

export function tileSvg(background: string, hair: string, inks: readonly string[]): string {
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>${tileBody(background, hair, inks)}</svg>`
}
