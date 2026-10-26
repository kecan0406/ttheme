import { aboutOf, mergeWorks, workOf } from '../../core/commons.ts'
import { swatch } from '../../core/manifest.ts'
import { ago, cells, counted, inert } from '../../core/text.ts'
import { type Listed, type ListedPalette, type Listing, listedMatches } from '../../store/marketplace-index.ts'
import { sameMarketplace, TOPIC } from '../../store/sources.ts'
import { fit, wrapText } from '../ansi.ts'
import type { Bar, Hint } from '../bar.ts'
import { Field } from '../field.ts'
import { capped } from '../keycaps.ts'
import { byWorkName, PaletteList, rowSpot } from '../palette-prompt.ts'
import { SEP, tabOf } from '../parts.ts'
import { ansiSquares, MARKS, type Paint } from '../style.ts'
import { button, EMPTY, lit } from './draw.ts'
import type { Network } from './network.ts'
import type { Staged } from './staged.ts'
import type { Detail, Found, Marketplace, Row } from './types.ts'

export interface SearchHost {
  readonly staged: Staged
  readonly network: Network
  readonly p: Paint
  readonly color: boolean
  readonly maxItems: number
  redraw(): void
  index(): Promise<Listing>
}

export class Search {
  readonly query = new Field()
  readonly results: PaletteList<Row>
  landing: string | undefined
  private listing: Listing | undefined
  private loading = false
  private loadError: string | undefined
  private readonly host: SearchHost

  constructor(host: SearchHost) {
    this.host = host
    this.results = new PaletteList<Row>({
      entries: [],
      works: [],
      picked: new Set(),
      layout: 'marketplaces',
      mode: 'cards',
      color: host.color,
      maxItems: host.maxItems,
      heads: () => [this.row({ kind: 'back' }, true)],
      extras: () => this.found(),
    })
  }

  open(typed: string, live: boolean): void {
    if (typed) {
      this.query.value = typed
    }

    this.results.setFilter(this.query.value)
    this.results.refresh()

    if (live && !this.listing) {
      this.load()
    }
  }

  typed(): void {
    this.results.setFilter(this.query.value)
  }

  clear(): void {
    this.query.value = ''
    this.typed()
  }

  paste(text: string): void {
    this.query.paste(text)
    this.typed()
  }

  lands(source: string): boolean {
    return this.landing !== undefined && sameMarketplace(this.landing, source)
  }

  load(): void {
    if (this.loading) {
      return
    }

    this.loading = true
    this.loadError = undefined
    this.host.redraw()
    this.host.index().then(
      (listing) => {
        this.loading = false
        this.listing = listing
        this.results.refresh()
        this.host.redraw()
      },
      (error: Error) => {
        this.loading = false
        this.loadError = inert(error.message)
        this.results.refresh()
        this.host.redraw()
      },
    )
  }

  focused(): Found | undefined {
    const row = this.results.focusedRow()

    return row?.kind === 'extra' ? row.extra.found : undefined
  }

  counts(): string {
    const parts = [
      ...(this.loading ? ['Loading…'] : []),
      ...(this.listing ? [`${this.matches().length} found`] : []),
      ...(this.listing?.offline ? [`offline, from ${ago(this.listing.at)}`] : []),
    ]

    return parts.length > 0 ? parts.join(SEP) : 'on GitHub'
  }

  bar(): Bar {
    const typed = this.query.value

    return {
      badge: 'SEARCH',
      keys: [...this.keys(), ...(typed ? [['bksp', 'edit'] as Hint] : []), ['?', 'keys']],
      right: typed ? ['esc', 'clear'] : ['esc', 'back'],
    }
  }

  detail(width: number): Detail {
    const found = this.focused()

    return found ? this.about(found, width) : EMPTY
  }

  private keys(): Hint[] {
    const found = this.focused()

    if (found?.kind === 'back') {
      return [['enter', 'back']]
    }

    if (found?.kind === 'state') {
      return this.loading ? [] : [['space', 'load']]
    }

    const source = found?.kind === 'listed' ? found.listed.source : undefined

    if (source === undefined) {
      return []
    }

    const { staged } = this.host
    const known = staged.known(source)

    if (!known) {
      return [
        ['space', 'add'],
        ['enter', 'add and go back'],
      ]
    }

    return [...(staged.adds.has(known.source) ? [['space', 'undo'] as Hint] : []), ['enter', 'go to it']]
  }

  private matches(): Listed[] {
    const query = this.query.value.trim()

    return (this.listing?.marketplaces ?? []).filter((m) => !query || listedMatches(m, query))
  }

  private found(): Row[] {
    const listed = this.matches()

    return listed.length > 0
      ? listed.map((m) => this.row({ kind: 'listed', listed: m }))
      : [this.row({ kind: 'state' })]
  }

  private row(found: Found, idle = false): Row {
    return {
      key: found.kind === 'listed' ? `listed ${found.listed.source}` : found.kind,
      ...(idle ? { idle } : {}),
      found,
      text: (focused: boolean, at: number) => this.line(found, focused, at),
    }
  }

  private line(found: Found, focused: boolean, at: number): string {
    const { p, staged, network } = this.host
    const after = (text: string) => (text ? `  ${p.dim(text)}` : '')

    if (found.kind === 'back') {
      return `   ${rowSpot(at, 'box', tabOf(p, '← Back', focused))}\n`
    }

    if (found.kind !== 'listed') {
      const [text, note] = this.stateOf()

      return button(p, at, focused, MARKS.search, text, after(note))
    }

    const m = found.listed
    const known = staged.known(m.source)
    const failure = network.failed.get(m.source)

    const facts = [
      `${MARKS.star}${m.stars}`,
      known ? this.addedNote(known) : counted(m.palettes.length),
      network.busy.get(m.source) ?? '',
    ].filter(Boolean)

    return lit(
      focused,
      `${rowSpot(at, 'box', `${known ? MARKS.on : MARKS.off} `)}${m.id}${after(facts.join(SEP))}${failure ? `  ${p.error(failure)}` : ''}`,
    )
  }

  private about(found: Found, width: number): Detail {
    const { p, staged, network } = this.host

    if (found.kind === 'back') {
      return { title: p.bold('Back'), lines: ['Back to your marketplaces'], brief: capped('enter goes back') }
    }

    if (found.kind !== 'listed') {
      const [text, note] = this.stateOf()
      const what = `Marketplaces people publish on GitHub, under the ${TOPIC} topic`

      return {
        title: p.bold('Marketplaces'),
        lines: [
          ...wrapText(what, width),
          '',
          ...wrapText([text, note].filter(Boolean).join(' — '), width),
          ...(this.loadError ? wrapText(this.loadError, width).map((l) => p.error(l)) : []),
          '',
          ...wrapText('Not listed yet? + Add marketplace adds one by its owner/repo', width),
        ],
        brief: [text, note].filter(Boolean).join(' — '),
      }
    }

    const m = found.listed
    const known = staged.known(m.source)

    const failure = known || network.busy.has(m.source) ? undefined : network.failed.get(m.source)

    const note = known
      ? this.addedNote(known)
      : (network.busy.get(m.source) ?? failure ?? capped('space adds it, enter adds it and goes back'))

    return {
      title: p.bold(m.id),
      lines: [
        p.dim(m.source),
        ...wrapText(m.about, width).map((l) => p.dim(l)),
        p.dim([`${MARKS.star} ${m.stars}`, ...(m.updated ? [`updated ${m.updated}`] : [])].join(SEP)),
        '',
        ...wrapText(note, width).map((l) => (failure ? p.error(l) : l)),
        '',
        ...this.paletteLines(m, width),
      ],
      brief: [counted(m.palettes.length), note].join(SEP),
      ...(failure ? { failed: true } : {}),
    }
  }

  private stateOf(): [string, string] {
    const query = this.query.value.trim()

    return this.loading
      ? ['Loading the marketplace list…', '']
      : this.loadError
        ? ['The marketplace list did not load', 'space retries']
        : !this.listing
          ? ['Load the marketplace list', 'space loads it']
          : query
            ? [`No marketplaces match '${query}'`, '']
            : ['No marketplaces yet', '']
  }

  private addedNote(known: Marketplace): string {
    return this.host.staged.adds.has(known.source) ? 'Will add' : 'Added'
  }

  private paletteLines(m: Listed, width: number): string[] {
    const { p, staged } = this.host
    const pad = Math.min(Math.max(...m.palettes.map((e) => cells(e.name))), Math.max(8, width - 16))

    const works = mergeWorks(
      staged.works(),
      m.works.map((w) => ({ ...w, characters: [] })),
    )

    const shelves = Map.groupBy(m.palettes, (e) => aboutOf(works, e.subject)?.work.id ?? '')
    const ids = [...shelves.keys()].filter(Boolean).sort(byWorkName(works))

    const line = (e: ListedPalette) => `  ${fit(e.name, pad)}${this.host.color ? `  ${ansiSquares(swatch(e))}` : ''}`

    return [
      ...ids.flatMap((id) => [p.dim(workOf(works, id)?.name ?? id), ...(shelves.get(id) ?? []).map(line)]),
      ...(shelves.get('') ?? []).map(line),
    ]
  }
}
