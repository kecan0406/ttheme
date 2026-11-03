import { edgeChroma } from './fix.ts'

export const PLANE_TOP = 0.98
export const PLANE_BOTTOM = 0.12

export const RAINBOW_L = 0.74
export const RAINBOW_C = 0.15

export const PLANE_CHROMA = 0.37

export function reach(l: number, h: number): number {
  return edgeChroma(l, h, PLANE_CHROMA)
}

export function shareOf(l: number, c: number, h: number): number {
  const most = reach(l, h)

  return most > 1e-6 ? Math.min(1, c / most) : 0
}
