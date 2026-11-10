import { setTimeout as sleep } from 'node:timers/promises'

interface Flow {
  last: number
  since: number
  waiting: number
  still: boolean
}

export class Pace {
  private readonly flows = new Map<string, Flow>()

  private readonly lull: number
  private readonly signal: AbortSignal
  private readonly stilled: (from: string) => void

  constructor(lull: number, signal: AbortSignal, stilled: (from: string) => void = () => {}) {
    this.lull = lull
    this.signal = signal
    this.stilled = stilled
  }

  came(from: string): void {
    const flow = this.flow(from)
    flow.last = Date.now()
    flow.still = false
  }

  still(from: string): boolean {
    return this.flow(from).still
  }

  async wait<T>(from: string, job: Promise<T>): Promise<boolean> {
    const flow = this.flow(from)

    if (flow.still) {
      return false
    }

    if (flow.waiting++ === 0) {
      flow.since = Date.now()
    }

    const done = new AbortController()

    try {
      return await Promise.race([
        job.then(
          () => true,
          () => true,
        ),
        this.quiet(from, flow, AbortSignal.any([this.signal, done.signal])),
      ])
    } finally {
      done.abort()
      flow.waiting--
    }
  }

  private async quiet(from: string, flow: Flow, signal: AbortSignal): Promise<boolean> {
    const left = () => Math.max(flow.last, flow.since) + this.lull - Date.now()

    try {
      for (let wait = left(); wait > 0 && !flow.still; wait = left()) {
        await sleep(wait, undefined, { signal })
      }

      if (!flow.still && flow.last <= flow.since) {
        flow.still = true
        this.stilled(from)
      }
    } catch {}

    return false
  }

  private flow(from: string): Flow {
    let flow = this.flows.get(from)

    if (!flow) {
      flow = { last: 0, since: 0, waiting: 0, still: false }
      this.flows.set(from, flow)
    }

    return flow
  }
}
