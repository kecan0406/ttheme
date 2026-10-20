import type { PaletteEntry } from '../../core/manifest.ts'
import { counted, inert } from '../../core/text.ts'
import { OFFICIAL, shownSource } from '../../store/sources.ts'
import { fit, wrapText } from '../ansi.ts'
import { type Bar, barLine, type Hint } from '../bar.ts'
import { type HubTab, hubBar } from '../hub.ts'
import { pageStep } from '../palette-prompt.ts'
import { MARKS, type Paint, SPINNER } from '../style.ts'
import type { Staged } from './staged.ts'
import type { BrowseResult, Report } from './types.ts'

export type Phase = 'browse' | 'review' | 'applying' | 'done'

export interface ReviewHost {
  readonly staged: Staged
  readonly p: Paint
  readonly hub: HubTab | undefined
  readonly color: boolean
  span(): number
  columns(): number
  beat(): number
  more(step: number, count: number): string
  redraw(): void
  apply(result: BrowseResult, report: Report): Promise<void>
}

export class Review {
  phase: Phase = 'browse'
  started = false
  stopped: Error | undefined
  log: string[] = []
  private offset = 0
  private working = ''
  private readonly host: ReviewHost

  constructor(host: ReviewHost) {
    this.host = host
  }

  open(): void {
    if (this.host.staged.dirty()) {
      this.phase = 'review'
      this.offset = 0
    }
  }

  steer(key: string): boolean {
    const closed = this.phase === 'done' && (key === 'enter' || key === 'esc')

    if (this.phase === 'review') {
      if (key === 'enter') {
        this.begin()
      } else if (key === 'esc') {
        this.phase = 'browse'
      }
    }

    const page = key === 'up' ? -1 : key === 'down' ? 1 : pageStep(key, this.host.span())

    if (page !== undefined) {
      this.scroll(page)
    }

    return closed
  }

  scroll(delta: number): void {
    this.offset = Number.isFinite(delta) ? Math.max(0, this.offset + delta) : delta > 0 ? Number.MAX_SAFE_INTEGER : 0
    this.host.redraw()
  }

  begin(): void {
    this.phase = 'applying'
    this.started = true
    this.offset = 0
    this.log = []
    this.working = ''

    const report: Report = {
      say: (line) => {
        this.log.push(...line.split('\n'))
        this.host.redraw()
      },
      status: (text) => {
        this.working = text
        this.host.redraw()
      },
    }

    this.host.apply(this.host.staged.result(), report).then(
      () => this.ended(),
      (error: Error) => this.ended(error),
    )
  }

  frame(cols: number, rows: number): string {
    const { p, hub } = this.host
    const width = cols - 1
    const review = this.phase === 'review'
    const lines = review ? this.reviewLines() : this.progressLines()

    const title =
      this.phase === 'review'
        ? `${p.bold('Review changes')}`
        : this.phase === 'applying'
          ? p.bold('Applying changes')
          : this.stopped
            ? `${p.error(MARKS.miss)} ${p.bold('Stopped')}`
            : `${p.bold(`${MARKS.ok} Applied`)} ${p.dim(this.summary() ? `(${this.summary()})` : '')}`

    const room = this.host.span()
    const most = Math.max(0, lines.length - room)
    const top = this.phase === 'applying' ? most : Math.min(this.offset, most)
    this.offset = top
    const shown = lines.slice(top, top + room)
    const below = lines.length - top - shown.length
    const body = [top > 0 ? ` ${this.host.more(-1, top)}` : '', ...shown]

    while (body.length < room + 1) {
      body.push('')
    }

    body.push(below > 0 ? ` ${this.host.more(1, below)}` : '')
    const scroll: Hint[] = most > 0 ? [['↑↓', 'scroll']] : []

    const bar: Bar = review
      ? { badge: 'BROWSE (APPLY)', keys: [...scroll, ['enter', 'apply']], right: ['esc', 'back'] }
      : this.phase === 'applying'
        ? { badge: 'BROWSE (APPLY)', note: 'Keys wait until it ends', keys: [] }
        : { badge: 'BROWSE (APPLY)', keys: scroll, right: ['enter', 'close'] }

    return [
      ...(hub ? [fit(hubBar(hub, this.host.color), width, false)] : []),
      fit(` ${title}`, width, false),
      ...body.map((line) => fit(line, width, false)),
      ` ${barLine(p, bar, width - 1)}`,
    ]
      .slice(0, rows)
      .join('\n')
  }

  private ended(error?: Error): void {
    this.working = ''
    this.stopped = error
    this.phase = 'done'
    this.offset = 0
    this.host.redraw()
  }

  private marketplaceChanges(): string[] {
    const { p, staged } = this.host
    const { installed, picked } = staged
    const rows: string[] = []

    for (const m of staged.adds.values()) {
      const auto = m.source !== OFFICIAL && staged.auto(m) ? 'updates on its own' : ''
      rows.push(
        `+ ${m.id}  ${p.dim([m.source === OFFICIAL ? 'The official marketplace' : m.shown, counted(m.entries.filter((e) => !e.default).length), auto].filter(Boolean).join(' · '))}`,
      )
    }

    for (const source of staged.removes) {
      const m = staged.marketplaces.find((x) => x.source === source)
      const stay = (m?.entries ?? []).filter((e) => !e.default && installed.has(e.name) && picked.has(e.name))
      rows.push(
        `- ${m?.id ?? source}  ${p.dim([m?.shown ?? shownSource(source), stay.length > 0 ? `its ${counted(stay.length)} installed keep working` : ''].filter(Boolean).join(' · '))}`,
      )
    }

    for (const [source, on] of staged.want) {
      const m = staged.marketplaces.find((x) => x.source === source)

      if (m) {
        rows.push(`${MARKS.auto} ${m.id}  ${p.dim(on ? 'updates on its own from now' : 'stops updating on its own')}`)
      }
    }

    return rows
  }

  private reviewLines(): string[] {
    const { p, staged } = this.host
    const marketplaces = this.marketplaceChanges()
    const { names, dropped } = staged.pending()
    const renew = new Set(staged.result().renew)
    const renewed = staged.entries().filter((e) => renew.has(e.name))
    const width = Math.max(0, ...[...names, ...dropped, ...renewed].map((e) => e.name.length))
    const palette = (sign: string, e: PaletteEntry) => `   ${sign} ${e.name.padEnd(width)}  ${p.dim(e.catalog ?? '')}`

    const counts = [
      names.length > 0 ? `${names.length} to install` : '',
      dropped.length > 0 ? `${dropped.length} to remove` : '',
      renewed.length > 0 ? `${renewed.length} to update` : '',
    ].filter(Boolean)

    return [
      ...(marketplaces.length > 0
        ? [` ${p.bold('Marketplaces')} ${p.dim(`(${marketplaces.length})`)}`, ...marketplaces.map((r) => `   ${r}`), '']
        : []),
      ...(counts.length > 0
        ? [
            ` ${p.bold('Palettes')} ${p.dim(`(${counts.join(' · ')})`)}`,
            ...names.map((e) => palette('+', e)),
            ...dropped.map((e) => palette('-', e)),
            ...renewed.map((e) => palette(MARKS.update, e)),
          ]
        : []),
    ]
  }

  private summary(): string {
    const { staged } = this.host
    const { names, dropped } = staged.pending()
    const added = staged.adds.size
    const renewed = staged.result().renew.length

    return [
      added > 0 ? `${added} marketplace${added === 1 ? '' : 's'} added` : '',
      staged.removes.size > 0 ? `${staged.removes.size} removed` : '',
      names.length > 0 ? `${names.length} installed` : '',
      dropped.length > 0 ? `${dropped.length} removed` : '',
      renewed > 0 ? `${renewed} updated` : '',
    ]
      .filter(Boolean)
      .join(' · ')
  }

  private progressLines(): string[] {
    const { p } = this.host
    const lines = this.log.map((line) => ` ${line}`)

    if (this.phase === 'applying') {
      const frame = SPINNER[this.host.beat() % SPINNER.length]
      lines.push(` ${p.dim(`${frame} ${this.working || 'Working…'}`)}`)
    } else if (this.stopped) {
      lines.push(
        '',
        ...wrapText(inert(this.stopped.message), Math.max(20, this.host.columns() - 6)).map(
          (l, i) => ` ${i === 0 ? p.error(MARKS.miss) : ' '} ${l}`,
        ),
      )
    }

    return lines
  }
}
