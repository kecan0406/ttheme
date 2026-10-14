export const GLIDE = 16

const GLIDE_SHARE = 0.4

interface Chase {
  share?: number
  span?: number
}

export function chase(shown: number, target: number, { share = GLIDE_SHARE, span }: Chase = {}): number {
  let from = shown
  let gap = target - from

  if (gap === 0) {
    return target
  }

  if (span !== undefined && Math.abs(gap) > 2 * span) {
    from = target - Math.sign(gap) * span
    gap = target - from
  }

  return from + Math.sign(gap) * Math.max(1, Math.round(Math.abs(gap) * share))
}

export class Glide {
  private timer: NodeJS.Timeout | undefined
  private readonly step: () => boolean
  private readonly paint: () => void

  constructor(step: () => boolean, paint: () => void) {
    this.step = step
    this.paint = paint
  }

  start(): void {
    if (this.timer) {
      return
    }

    const tick = (): void => {
      const more = this.step()
      this.paint()
      this.timer = more ? setTimeout(tick, GLIDE) : undefined
    }

    this.timer = setTimeout(tick, GLIDE)
  }

  stop(): void {
    clearTimeout(this.timer)
    this.timer = undefined
  }
}
