import { inert } from '../../core/text.ts'
import type { BrowseIo, Marketplace } from './types.ts'

export interface Fresh {
  marketplace: Marketplace
  updates: string[]
}

export class Network {
  readonly busy = new Map<string, string>()
  readonly failed = new Map<string, string>()
  private readonly fetched = new Map<string, Marketplace>()
  private readonly staging = new Set<string>()
  private readonly inflight = new Set<Promise<unknown>>()
  private readonly io: BrowseIo
  private readonly redraw: () => void

  constructor(io: BrowseIo, redraw: () => void) {
    this.io = io
    this.redraw = redraw
  }

  track<T>(work: Promise<T>): Promise<T> {
    this.inflight.add(work)
    const done = () => this.inflight.delete(work)
    work.then(done, done)

    return work
  }

  async idle(): Promise<void> {
    await Promise.allSettled(this.inflight)
  }

  fetch(source: string, arrive: (marketplace: Marketplace) => void, lost: () => void): void {
    const got = this.fetched.get(source)

    if (got) {
      arrive(got)

      return
    }

    this.staging.add(source)

    if (this.busy.has(source)) {
      return
    }

    this.failed.delete(source)
    this.busy.set(source, 'Fetching…')
    this.track(this.io.fetch(source)).then(
      (marketplace) => {
        this.busy.delete(source)
        this.fetched.set(source, marketplace)

        if (this.staging.delete(source)) {
          arrive(marketplace)
        }

        this.redraw()
      },
      (error: Error) => {
        this.busy.delete(source)
        this.staging.delete(source)
        this.failed.set(source, inert(error.message))
        lost()
        this.redraw()
      },
    )
  }

  refresh(source: string, done: (fresh: Fresh) => void): void {
    if (this.busy.has(source)) {
      return
    }

    this.failed.delete(source)
    this.busy.set(source, 'Updating…')
    this.track(this.io.refresh(source)).then(
      (fresh) => {
        this.busy.delete(source)
        done(fresh)
        this.redraw()
      },
      (error: Error) => {
        this.busy.delete(source)
        this.failed.set(source, `Update failed: ${inert(error.message)}`)
        this.redraw()
      },
    )
  }

  unstage(source: string): void {
    this.staging.delete(source)
  }

  updating(): boolean {
    return this.busy.values().some((text) => text === 'Updating…')
  }
}
