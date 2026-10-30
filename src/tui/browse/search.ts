import { aboutOf, mergeWorks, spoken, type Work, workOf, workOfListed, worksFor } from '../../core/commons.ts'
import { swatch } from '../../core/manifest.ts'
import { askedOf, MAKE_URL, NAME_PAUSE, type NameHit, namedWorks, requestUrl } from '../../core/names.ts'
import { ago, cells, containsText, counted, inert } from '../../core/text.ts'
import { slugOf } from '../../core/theme.ts'
import { type Listed, type Listing, listedMatches } from '../../store/marketplace-index.ts'
import { sameMarketplace, TOPIC } from '../../store/sources.ts'
import { fit, wrapText } from '../ansi.ts'
import type { Bar, Hint } from '../bar.ts'
import { Field } from '../field.ts'
import { capped } from '../keycaps.ts'
import { byWorkName, PaletteList, rowSpot } from '../palette-prompt.ts'
import { SEP, tabOf } from '../parts.ts'
import { ansiSquares, MARKS, type Paint } from '../style.ts'
import { button, EMPTY, lit, whereOf } from './draw.ts'
import type { Network } from './network.ts'
import type { Staged } from './staged.ts'
import type { Detail, Found, Marketplace, Offer, Row } from './types.ts'

export interface SearchHost {
  readonly staged: Staged
  readonly network: Network
  readonly p: Paint
  readonly color: boolean
  readonly maxItems: number
  redraw(): void
  index(): Promise<Listing>
  names?: (query: string, signal: AbortSignal) => Promise<NameHit[]>
  visit(url: string): void
}

interface Named {
  query: string
  hits: NameHit[]
}

function plural(n: number, one: string): string {
  return `${n} ${one}${n === 1 ? '' : 's'}`
}

function wordsOfWork(w: Work): string[] {
  return [
    w.name,
    w.native ?? '',
    ...w.characters.flatMap((c) => [c.id, ...(c.native ?? []), c.danbooru ? spoken(c.danbooru) : '']),
  ]
}

export class Search {
  readonly query = new Field()
  readonly results: PaletteList<Row>
  landing: string | undefined
  private listing: Listing | undefined
  private loading = false
  private loadError: string | undefined
  private named: Named | undefined
  private naming: string | undefined
  private nameError: string | undefined
  private timer: ReturnType<typeof setTimeout> | undefined
  private asking: AbortController | undefined
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

    if (typed) {
      this.ask(this.query.value.trim())
    }
  }

  typed(): void {
    this.results.setFilter(this.query.value)
    this.later()
  }

  clear(): void {
    this.query.value = ''
    this.typed()
  }

  paste(text: string): void {
    this.query.paste(text)
    this.typed()
  }

  close(): void {
    clearTimeout(this.timer)
    this.asking?.abort()
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
    const { works, markets } = this.tally()

    const parts = [
      ...(this.loading ? ['Loading…'] : []),
      ...(this.naming ? ['Looking up names…'] : []),
      ...(works > 0
        ? [plural(works, 'work'), plural(markets, 'marketplace')]
        : this.listing
          ? [`${markets} found`]
          : []),
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

  private later(): void {
    clearTimeout(this.timer)
    const query = this.query.value.trim()

    if (!this.host.names || !query || this.named?.query === query) {
      return
    }

    this.timer = setTimeout(() => this.ask(query), NAME_PAUSE)
    this.timer.unref?.()
  }

  private ask(query: string): void {
    const names = this.host.names

    if (!names || !query || this.named?.query === query || this.naming === query) {
      return
    }

    clearTimeout(this.timer)
    this.asking?.abort()
    const asking = new AbortController()
    this.asking = asking
    this.naming = query
    this.nameError = undefined
    this.host.redraw()
    names(query, asking.signal).then(
      (hits) => {
        if (asking.signal.aborted) {
          return
        }

        const waiting = this.focused()?.kind
        this.naming = undefined
        this.named = { query, hits }
        this.results.refresh()

        if (waiting === 'state' || waiting === 'request' || waiting === 'make') {
          const first = this.found()[0]

          if (first && first.found?.kind !== 'state') {
            this.results.select(`extra ${first.key}`)
          }
        }

        this.host.redraw()
      },
      (error: Error) => {
        if (asking.signal.aborted) {
          return
        }

        this.naming = undefined
        this.nameError = inert(error.message)
        this.results.refresh()
        this.host.redraw()
      },
    )
  }

  private keys(): Hint[] {
    const found = this.focused()

    if (found?.kind === 'back') {
      return [['enter', 'back']]
    }

    if (found?.kind === 'state') {
      return this.loading ? [] : [['space', 'load']]
    }

    if (found?.kind === 'request' || found?.kind === 'make') {
      return [['enter', 'open']]
    }

    const source =
      found?.kind === 'listed' ? found.listed.source : found?.kind === 'offer' ? found.offer.source : undefined

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

  private works(): Work[] {
    return mergeWorks(
      this.host.staged.works(),
      (this.listing?.marketplaces ?? []).flatMap((m) => m.works.map(workOfListed)),
    )
  }

  private offers(works: readonly Work[], id: string): Offer[] {
    const { staged } = this.host

    const has = (subject: string | undefined) => {
      const about = aboutOf(works, subject)

      return about !== undefined && worksFor(about).includes(id)
    }

    const known = staged.active().flatMap((m) => {
      const palettes = m.entries.filter((e) => has(e.subject))

      return palettes.length > 0 ? [{ source: m.source, id: m.id, palettes, known: m }] : []
    })

    const listed = (this.listing?.marketplaces ?? []).flatMap((m) => {
      const palettes = staged.known(m.source) ? [] : m.palettes.filter((e) => has(e.subject))

      return palettes.length > 0 ? [{ source: m.source, id: m.id, palettes, listed: m }] : []
    })

    return [...known, ...listed]
  }

  private shelves(): { work: Work; offers: Offer[] }[] {
    const query = this.query.value.trim()

    if (!query) {
      return []
    }

    const works = this.works()
    const named = this.named?.query === query ? namedWorks(this.named.hits, works).works.map((w) => w.id) : []
    const local = works.filter((w) => containsText(wordsOfWork(w), query)).map((w) => w.id)

    return [...new Set([...named, ...local])].flatMap((id) => {
      const work = workOf(works, id)
      const offers = work ? this.offers(works, id) : []

      return work && offers.length > 0 ? [{ work, offers }] : []
    })
  }

  private matches(): Listed[] {
    const query = this.query.value.trim()

    return (this.listing?.marketplaces ?? []).filter((m) => !query || listedMatches(m, query))
  }

  private tally() {
    const shelves = this.shelves()

    const sources = new Set([
      ...shelves.flatMap((s) => s.offers.map((o) => o.source)),
      ...this.matches().map((m) => m.source),
    ])

    return { works: shelves.length, markets: sources.size }
  }

  private asked(): string | undefined {
    const query = this.query.value.trim()

    if (!query || this.naming === query) {
      return undefined
    }

    const hit = this.named?.query === query ? this.named.hits[0] : undefined

    return hit ? inert(askedOf(query, hit)) : query
  }

  private found(): Row[] {
    const shelves = this.shelves()
    const shown = new Set(shelves.flatMap((s) => s.offers.map((o) => o.source)))

    const rows = [
      ...shelves.flatMap(({ work, offers }) => [
        this.row({ kind: 'work', work, offers }),
        ...offers.map((offer) => this.row({ kind: 'offer', offer })),
      ]),
      ...this.matches()
        .filter((m) => !shown.has(m.source))
        .map((m) => this.row({ kind: 'listed', listed: m })),
    ]

    if (rows.length > 0) {
      return rows
    }

    const asked = this.asked()

    const offer = asked !== undefined && this.listing !== undefined

    return [
      this.row({ kind: 'state' }, offer),
      ...(offer ? [this.row({ kind: 'request', asked }), this.row({ kind: 'make' })] : []),
    ]
  }

  private row(found: Found, idle = false): Row {
    return {
      key: this.keyOf(found),
      ...(idle ? { idle } : {}),
      found,
      text: (focused: boolean, at: number) => this.line(found, focused, at),
    }
  }

  private keyOf(found: Found): string {
    switch (found.kind) {
      case 'listed':
        return `listed ${found.listed.source}`
      case 'work':
        return `work ${found.work.id}`
      case 'offer':
        return `offer ${found.offer.source} ${found.offer.palettes[0]?.name ?? ''}`
      default:
        return found.kind
    }
  }

  private line(found: Found, focused: boolean, at: number): string {
    const { p, staged, network } = this.host
    const after = (text: string) => (text ? `  ${p.dim(text)}` : '')

    if (found.kind === 'back') {
      return `   ${rowSpot(at, 'box', tabOf(p, '← Back', focused))}\n`
    }

    if (found.kind === 'request') {
      return button(p, at, focused, MARKS.link, 'Request a palette', after('ask for one on GitHub'))
    }

    if (found.kind === 'make') {
      return button(p, at, focused, MARKS.link, 'Make one', after('make it and publish it yourself'))
    }

    if (found.kind === 'work') {
      const count = found.offers.reduce((sum, o) => sum + o.palettes.length, 0)
      const native = found.work.native && found.work.native !== found.work.name ? `  ${p.dim(found.work.native)}` : ''

      return lit(
        focused,
        `${rowSpot(at, 'box', p.bold(found.work.name))}${native}${after([plural(found.offers.length, 'marketplace'), counted(count)].join(SEP))}`,
      )
    }

    if (found.kind === 'offer') {
      const { offer } = found
      const known = staged.known(offer.source)
      const failure = network.failed.get(offer.source)

      const facts = [
        offer.listed ? `${MARKS.star}${offer.listed.stars}` : whereOf(offer.source),
        counted(offer.palettes.length),
        ...(known && !offer.known
          ? [this.addedNote(known)]
          : offer.known && staged.adds.has(offer.source)
            ? ['Will add']
            : []),
        network.busy.get(offer.source) ?? '',
      ].filter(Boolean)

      return lit(
        focused,
        `  ${rowSpot(at, 'box', `${known ? MARKS.on : MARKS.off} `)}${offer.id}${after(facts.join(SEP))}${failure ? `  ${p.error(failure)}` : ''}`,
      )
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
    const { p, staged } = this.host

    if (found.kind === 'back') {
      return { title: p.bold('Back'), lines: ['Back to your marketplaces'], brief: capped('enter goes back') }
    }

    if (found.kind === 'request') {
      const what = `Asks for a built-in palette of ${found.asked} on GitHub, in a form your browser opens`

      return { title: p.bold('Request a palette'), lines: wrapText(what, width), brief: capped('enter opens the form') }
    }

    if (found.kind === 'make') {
      const what = 'How to make a palette from official art and publish it in a marketplace of your own'

      return { title: p.bold('Make one'), lines: wrapText(what, width), brief: capped('enter opens the guide') }
    }

    if (found.kind === 'work') {
      const count = found.offers.reduce((sum, o) => sum + o.palettes.length, 0)

      return {
        title: p.bold(found.work.name),
        lines: [
          ...(found.work.native && found.work.native !== found.work.name ? [p.dim(found.work.native)] : []),
          p.dim([plural(found.offers.length, 'marketplace'), counted(count)].join(SEP)),
          '',
          ...found.offers.flatMap((offer) => [
            `${staged.known(offer.source) ? MARKS.on : MARKS.off} ${offer.id}  ${p.dim(whereOf(offer.source))}`,
            ...this.swatched(offer.palettes, width),
          ]),
        ],
        brief: [plural(found.offers.length, 'marketplace'), counted(count)].join(SEP),
      }
    }

    if (found.kind === 'offer') {
      const { offer } = found
      const known = staged.known(offer.source)

      if (offer.listed && !known) {
        return this.listedAbout(offer.listed, width, offer)
      }

      return {
        title: p.bold(offer.id),
        lines: [
          p.dim(whereOf(offer.source)),
          ...(known?.description ? wrapText(known.description, width).map((l) => p.dim(l)) : []),
          '',
          ...wrapText(capped(known ? 'enter goes to it' : 'space adds it, enter adds it and goes back'), width),
          '',
          ...this.swatched(offer.palettes, width),
        ],
        brief: [counted(offer.palettes.length), known ? this.addedNote(known) : ''].filter(Boolean).join(SEP),
      }
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
          ...(this.nameError ? wrapText(this.nameError, width).map((l) => p.error(l)) : []),
          '',
          ...wrapText('Not listed yet? + Add marketplace adds one by its owner/repo', width),
        ],
        brief: [text, note].filter(Boolean).join(' — '),
      }
    }

    return this.listedAbout(found.listed, width)
  }

  private listedAbout(m: Listed, width: number, offer?: Offer): Detail {
    const { p, staged, network } = this.host
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
        ...(offer ? [...this.swatched(offer.palettes, width), ''] : []),
        ...this.paletteLines(m, width),
      ],
      brief: [counted(m.palettes.length), note].join(SEP),
      ...(failure ? { failed: true } : {}),
    }
  }

  private stateOf(): [string, string] {
    const query = this.query.value.trim()
    const asked = this.asked()

    return this.loading
      ? ['Loading the marketplace list…', '']
      : this.loadError
        ? ['The marketplace list did not load', 'space retries']
        : !this.listing
          ? ['Load the marketplace list', 'space loads it']
          : query && this.naming === query
            ? [`Looking up '${query}'…`, '']
            : query
              ? [asked && asked !== query ? `No marketplace has ${asked} yet` : `No marketplaces match '${query}'`, '']
              : ['No marketplaces yet', '']
  }

  private addedNote(known: Marketplace): string {
    return this.host.staged.adds.has(known.source) ? 'Will add' : 'Added'
  }

  private swatched(palettes: Offer['palettes'], width: number): string[] {
    const pad = Math.min(Math.max(...palettes.map((e) => cells(slugOf(e.name)))), Math.max(8, width - 16))

    return palettes.map((e) => `  ${fit(slugOf(e.name), pad)}${this.host.color ? `  ${ansiSquares(swatch(e))}` : ''}`)
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

    const line = (e: Listed['palettes'][number]) =>
      `  ${fit(e.name, pad)}${this.host.color ? `  ${ansiSquares(swatch(e))}` : ''}`

    return [
      ...ids.flatMap((id) => [p.dim(workOf(works, id)?.name ?? id), ...(shelves.get(id) ?? []).map(line)]),
      ...(shelves.get('') ?? []).map(line),
    ]
  }

  visitFocused(): boolean {
    const found = this.focused()

    if (found?.kind === 'request') {
      this.host.visit(requestUrl(found.asked))

      return true
    }

    if (found?.kind === 'make') {
      this.host.visit(MAKE_URL)

      return true
    }

    return false
  }
}
