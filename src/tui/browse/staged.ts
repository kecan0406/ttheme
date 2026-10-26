import { mergeWorks, type Sort, type Work, worldOrder } from '../../core/commons.ts'
import type { PaletteEntry } from '../../core/manifest.ts'
import { publisherOf } from '../../core/theme.ts'
import { type Refreshed, sameMarketplace } from '../../store/sources.ts'
import type { BrowseResult, Marketplace } from './types.ts'

export class Staged {
  readonly picked: Set<string>
  readonly adds = new Map<string, Marketplace>()
  readonly removes = new Set<string>()
  readonly want = new Map<string, boolean>()
  readonly renew = new Set<string>()
  readonly refreshed: Refreshed[] = []
  readonly installed: ReadonlySet<string>
  marketplaces: Marketplace[]
  private updates: Set<string>
  private readonly kept: PaletteEntry[]
  private readonly base: readonly Work[]
  private readonly sort: Sort

  constructor(opts: {
    marketplaces: Marketplace[]
    kept: PaletteEntry[]
    installed: string[]
    updates?: string[]
    works: readonly Work[]
    sort?: Sort
  }) {
    this.marketplaces = opts.marketplaces
    this.kept = opts.kept
    this.installed = new Set(opts.installed)
    this.updates = new Set(opts.updates ?? [])
    this.base = opts.works
    this.sort = opts.sort ?? 'abc'
    this.picked = new Set(opts.installed)
  }

  active(): Marketplace[] {
    return [...this.marketplaces.filter((m) => !this.removes.has(m.source)), ...this.adds.values()]
  }

  works(): Work[] {
    return mergeWorks(
      this.base,
      [...this.marketplaces, ...this.adds.values()].flatMap((m) => m.works),
    )
  }

  entries(): PaletteEntry[] {
    const listed = this.active().flatMap((m) => m.entries)
    const names = new Set(listed.map((e) => e.name))
    const orphans = new Map<string, PaletteEntry>()
    const dropped = this.marketplaces.filter((m) => this.removes.has(m.source)).flatMap((m) => m.entries)

    for (const entry of [...this.kept, ...dropped]) {
      if (this.installed.has(entry.name) && !names.has(entry.name)) {
        orphans.set(entry.name, entry)
      }
    }

    return worldOrder([...listed, ...orphans.values()], this.works(), this.sort)
  }

  membersOf(top: string): PaletteEntry[] {
    return this.entries().filter((e) => publisherOf(e.name) === top)
  }

  tops(): string[] {
    return this.active().map((m) => m.id)
  }

  named(id: string): Marketplace | undefined {
    return this.active().find((m) => m.id === id)
  }

  known(source: string): Marketplace | undefined {
    return [...this.marketplaces, ...this.adds.values()].find((m) => sameMarketplace(m.source, source))
  }

  auto(m: Marketplace): boolean {
    return this.want.get(m.source) ?? m.auto
  }

  outdated(name: string): boolean {
    return this.updates.has(name) && this.installed.has(name)
  }

  changes(): number {
    return this.adds.size + this.removes.size + this.want.size
  }

  count(): number {
    const { names, dropped } = this.pending()

    return this.changes() + names.length + dropped.length + this.result().renew.length
  }

  dirty(): boolean {
    const { picked, renew } = this.result()

    return (
      this.changes() > 0 ||
      renew.length > 0 ||
      picked.size !== this.installed.size ||
      !picked.isSubsetOf(this.installed)
    )
  }

  result(): BrowseResult {
    const names = new Set(this.entries().map((e) => e.name))

    return {
      picked: new Set(this.picked.values().filter((name) => names.has(name))),
      adds: [...this.adds.values()],
      removes: [...this.removes],
      auto: Object.fromEntries(this.want),
      renew: [...this.renew].filter((name) => this.updates.has(name) && this.picked.has(name) && names.has(name)),
      refreshed: this.refreshed,
    }
  }

  pending() {
    const entries = this.entries().filter((e) => !e.default)

    return {
      names: entries.filter((e) => this.picked.has(e.name) && !this.installed.has(e.name)),
      dropped: entries.filter((e) => this.installed.has(e.name) && !this.picked.has(e.name)),
    }
  }

  toggleAuto(m: Marketplace): void {
    const on = !this.auto(m)

    if (on === m.auto) {
      this.want.delete(m.source)
    } else {
      this.want.set(m.source, on)
    }
  }

  add(m: Marketplace): void {
    this.adds.set(m.source, m)
  }

  drop(source: string): void {
    this.adds.delete(source)
    this.want.delete(source)
  }

  remove(source: string): void {
    this.removes.add(source)
    this.want.delete(source)
  }

  unremove(source: string): boolean {
    return this.removes.delete(source)
  }

  refresh(source: string, marketplace: Marketplace, refreshed: Refreshed, updates: string[]): void {
    this.updates = new Set(updates)
    this.marketplaces = this.marketplaces.map((m) => (m.source === source ? marketplace : m))
    this.refreshed.push(refreshed)
  }

  toggleRenew(names: string[]): void {
    const due = names.filter((name) => this.outdated(name))

    if (due.length === 0) {
      return
    }

    const on = due.some((name) => !this.renew.has(name))

    for (const name of due) {
      if (on) {
        this.renew.add(name)
      } else {
        this.renew.delete(name)
      }
    }
  }
}
