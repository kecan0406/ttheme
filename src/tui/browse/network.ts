import { inert } from '../../core/text.ts'
import type { BrowseIo, Marketplace } from './types.ts'

interface Fresh {
  marketplace: Marketplace
  updates: string[]
}

type Status = { kind: 'fetching'; staging: boolean } | { kind: 'updating' } | { kind: 'failed'; why: string }

export class Network {
  private readonly sources = new Map<string, Status>()
  private readonly fetched = new Map<string, Marketplace>()
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

  busy(source: string): string | undefined {
    const status = this.sources.get(source)

    return status?.kind === 'fetching' ? 'Fetching…' : status?.kind === 'updating' ? 'Updating…' : undefined
  }

  failure(source: string): string | undefined {
    const status = this.sources.get(source)

    return status?.kind === 'failed' ? status.why : undefined
  }

  fail(source: string, why: string): void {
    this.sources.set(source, { kind: 'failed', why })
  }

  fetch(source: string, arrive: (marketplace: Marketplace) => void, lost: () => void): void {
    const got = this.fetched.get(source)

    if (got) {
      arrive(got)

      return
    }

    const status = this.sources.get(source)

    if (status?.kind === 'updating') {
      return
    }

    this.sources.set(source, { kind: 'fetching', staging: true })

    if (status?.kind === 'fetching') {
      return
    }

    this.track(this.io.fetch(source)).then(
      (marketplace) => {
        const landed = this.sources.get(source)
        this.sources.delete(source)
        this.fetched.set(source, marketplace)

        if (landed?.kind === 'fetching' && landed.staging) {
          arrive(marketplace)
        }

        this.redraw()
      },
      (error: Error) => {
        this.fail(source, inert(error.message))
        lost()
        this.redraw()
      },
    )
  }

  refresh(source: string, done: (fresh: Fresh) => void): void {
    if (this.busy(source) !== undefined) {
      return
    }

    this.sources.set(source, { kind: 'updating' })
    this.track(this.io.refresh(source)).then(
      (fresh) => {
        this.sources.delete(source)
        done(fresh)
        this.redraw()
      },
      (error: Error) => {
        this.fail(source, `Update failed: ${inert(error.message)}`)
        this.redraw()
      },
    )
  }

  unstage(source: string): void {
    if (this.sources.get(source)?.kind === 'fetching') {
      this.sources.set(source, { kind: 'fetching', staging: false })
    }
  }

  updating(): boolean {
    return this.sources.values().some((status) => status.kind === 'updating')
  }
}
