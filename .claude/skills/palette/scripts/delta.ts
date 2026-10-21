import { deltaE } from '../../../../src/core/color.ts'

export { deltaE }

const PERMUTATIONS = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
]

export function tripletDelta(a: string[], b: string[]): number {
  return Math.min(
    ...PERMUTATIONS.map(
      (p) =>
        (deltaE(a[0] as string, b[p[0] as number] as string) +
          deltaE(a[1] as string, b[p[1] as number] as string) +
          deltaE(a[2] as string, b[p[2] as number] as string)) /
        3,
    ),
  )
}
