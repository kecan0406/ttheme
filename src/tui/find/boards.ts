import {
  exposed,
  hidden,
  LENDER,
  lend,
  PAGE,
  type Post,
  postKey,
  previewOf,
  rated,
  rendition,
  SITES,
  type Site,
  tagsOf,
  wantedAccount,
} from '../../core/booru.ts'
import type { PaletteEntry } from '../../core/manifest.ts'
import { FACE } from '../../core/slots.ts'
import { type Frame, fitOrder, interleave, type Pick } from '../../pictures/fit.ts'
import type { Look, Renderer } from '../../pictures/render.ts'
import { kinKeys, near, type Size, sameKeys, sameSet } from '../../pictures/works.ts'
import { LOCAL, sourceLabel } from './attach.ts'
import type { Kept } from './kept.ts'
import type { Paint } from './paint.ts'
import { type BoardsView, gridLayout, type Notice, type Owns, type Stage, type Tile } from './screen.ts'
import { type Grid, type Net, previewPath, reason } from './session.ts'
import type { Tags } from './tags.ts'
import { THUMB, type Thumbs } from './thumbs.ts'

const PROBE = 12

const LOOKAHEAD = 2

interface Source {
  site: Site
  tags: string
  page: number
  done: boolean
}

interface Group {
  posts: Pick[]
  open: boolean
}

interface Board {
  key: string
  groups: Group[]
  sources: Source[]
  queue: Pick[]
  rounds: number
  roundOf: Map<Pick, number>
  last: Map<Source, { post: Post; set: string }>
  kin: Map<Pick, string[]>
  kindred: Map<string, Group>
  sizes: { size: Size; group: Group }[]
  seen: Set<number>
  same: Map<string, Pick>
  checked: number
  total: number
  focus: number
  top: number
  state: 'planning' | 'pumping' | 'resting'
  stage: Stage
  round?: Promise<void>
  arrived: Set<string>
  error?: string
  note?: string
  wants?: string
}

interface Vetting {
  pick: Pick
  passed: Promise<boolean>
}

function blank(key: string, state: Board['state']): Board {
  return {
    key,
    groups: [],
    sources: [],
    queue: [],
    rounds: 0,
    roundOf: new Map(),
    last: new Map(),
    kin: new Map(),
    kindred: new Map(),
    sizes: [],
    seen: new Set(),
    same: new Map(),
    checked: 0,
    total: 0,
    focus: 0,
    top: 0,
    state,
    stage: { step: 'fetch' },
    arrived: new Set(),
  }
}

function area(post: Post): number {
  return post.width * post.height
}

interface Host {
  view: Owns<BoardsView>
  grid: () => Grid
  entry: PaletteEntry
  scratch: string
  signal: AbortSignal
  net: Net
  renders: Renderer
  kept: Kept
  paint: Paint
  thumbs: Thumbs
  tags: Tags
  site: () => Site | undefined
  sites: () => Site[]
  tabName: () => string
  tabTo: (site: Site) => void
  forget: () => void
  select: () => void
  enter: () => void
  tell: (notice?: Notice) => void
  asks: (account: string) => void
}

export class Boards {
  board: Board
  readonly posts = new Map<number, Pick>()
  private readonly boards = new Map<string, Board>()
  private readonly looking = new Map<number, Promise<Look | undefined>>()
  private readonly looked = new Map<number, Look>()
  private readonly late = new Set<number>()
  private readonly matched = new Map<Post, number>()
  private aheading = false
  private readonly pages = new Map<string, Promise<Post[]>>()
  private showing?: Board

  private readonly view: Owns<BoardsView>
  private readonly grid: () => Grid
  private readonly entry: PaletteEntry
  private readonly scratch: string
  private readonly signal: AbortSignal
  private readonly net: Net
  private readonly renders: Renderer
  private readonly kept: Kept
  private readonly paint: Paint
  private readonly thumbs: Thumbs
  private readonly tags: Tags
  private readonly site: () => Site | undefined
  private readonly sites: () => Site[]
  private readonly tabName: () => string
  private readonly tabTo: (site: Site) => void
  private readonly forget: () => void
  private readonly select: () => void
  private readonly enter: () => void
  private readonly tell: (notice?: Notice) => void
  private readonly asks: (account: string) => void

  constructor(host: Host) {
    this.view = host.view
    this.grid = host.grid
    this.entry = host.entry
    this.scratch = host.scratch
    this.signal = host.signal
    this.net = host.net
    this.renders = host.renders
    this.kept = host.kept
    this.paint = host.paint
    this.thumbs = host.thumbs
    this.tags = host.tags
    this.site = host.site
    this.sites = host.sites
    this.tabName = host.tabName
    this.tabTo = host.tabTo
    this.forget = host.forget
    this.select = host.select
    this.enter = host.enter
    this.tell = host.tell
    this.asks = host.asks
    this.board = blank(this.boardKey, this.view.tag === '' ? 'resting' : 'planning')
    this.boards.set(this.board.key, this.board)
  }

  clear(): void {
    this.boards.clear()
  }

  noted(note?: string): void {
    this.view.note = note
  }

  wanted(): string | undefined {
    return this.board.wants
  }

  still(): void {
    this.board.state = 'resting'
    this.view.hunt = undefined
  }

  focus(index: number): void {
    const view = this.view

    if (view.tiles.length === 0) {
      return
    }

    const next = Math.max(0, Math.min(view.tiles.length - 1, index))

    if (next === view.focus) {
      return
    }

    view.focus = next
    this.board.focus = next
    this.scroll()
    this.paint.glide()
    void this.pump()

    if (view.mode.on !== 'grid') {
      this.select()
    }

    this.paint.draw()
  }

  scroll(): void {
    const view = this.view
    const { cols, rows } = this.grid()
    const { perRow, rowsVis } = gridLayout(cols, rows)
    const row = Math.floor(view.focus / perRow)

    if (row < view.top) {
      view.top = row
    }

    if (row > view.top + rowsVis - 1) {
      view.top = row - rowsVis + 1
    }

    this.board.top = view.top
  }

  alone(key: string, pick: Pick): void {
    this.forget()
    const board = blank(key, 'resting')
    this.board = board
    this.boards.set(board.key, board)
    this.single(board, pick)
  }

  private frame(): Frame {
    return { w: this.grid().cols * (this.grid().cell.w || 10), h: this.grid().rows * (this.grid().cell.h || 20) }
  }

  private get boardKey(): string {
    return `${this.site()?.key ?? 'all'}|${this.view.preset}|${this.view.order}`
  }

  private tileOf(pick: Pick, variants: number): Tile {
    const { site, post } = pick
    const key = postKey(site, post.id)
    const version = rendition(post) ?? post

    return {
      id: post.id,
      key,
      site: site.name,
      siteAnsi: site.ansi,
      width: version.width,
      height: version.height,
      reduced: version !== post,
      page: site === LOCAL ? '' : site.pageUrl(post.id),
      artist: site === LOCAL ? sourceLabel(post.source) : (post.named.artist[0] ?? ''),
      score: post.score,
      variants,
      mates: this.kept.matesOf(site, post.owner),
      thumb: this.thumbs.pathOf(key),
      missing: this.thumbs.missing(key),
    }
  }

  show(): void {
    const view = this.view
    const board = this.board
    view.tiles = board.groups.flatMap((group) =>
      group.open
        ? group.posts.map((pick) => this.tileOf(pick, 0))
        : [this.tileOf(group.posts[0] as Pick, group.posts.length)],
    )
    view.checked = board.checked
    view.total = board.total
    this.stageOf(board)
    view.note = board.note
    view.focus = Math.max(0, Math.min(board.focus, view.tiles.length - 1))
    view.top = board.top

    if (this.showing !== board) {
      this.showing = board
      this.paint.snap()
    }
  }

  private stageOf(board: Board): void {
    const view = this.view
    view.hunt = board.state === 'resting' ? undefined : board.stage
    view.sites = this.sites().map((site) => ({ name: site.name, arrived: board.arrived.has(site.name) }))
  }

  private single(board: Board, pick: Pick): void {
    board.state = 'resting'
    this.posts.set(postKey(pick.site, pick.post.id), pick)
    board.groups = [{ posts: [pick], open: false }]
    board.checked = 1
    board.total = 1
    this.thumbs.want(pick)
    this.enter()
    this.show()
    this.select()
    this.paint.draw()
  }

  async jump(site: Site, id: number): Promise<void> {
    this.tabTo(site)
    this.forget()
    this.tell()
    const board = blank(`${site.key}|post:${id}`, 'planning')
    this.board = board
    this.boards.set(board.key, board)
    this.show()
    this.paint.draw()

    try {
      const post = await this.net.fetchPost(site, id, this.signal)

      if (board !== this.board) {
        return
      }

      if (!post) {
        board.state = 'resting'
        board.error = `${site.name} has no post ${id}`
        this.tell({ text: board.error, tone: 'error' })
        this.show()
        this.paint.draw()

        return
      }

      this.single(board, { site, post })
    } catch (error) {
      this.fail(board, error instanceof Error ? error : String(error), site)
    }
  }

  async turn(): Promise<void> {
    this.forget()
    const known = this.boards.get(this.boardKey)

    if (!known) {
      await this.search()

      return
    }

    this.board = known
    this.tell(known.error ? { text: known.error, tone: 'error' } : undefined)
    this.show()
    this.paint.draw()
    await this.pump()
  }

  unfold(): void {
    const view = this.view
    let index = 0

    for (const group of this.board.groups) {
      const size = group.open ? group.posts.length : 1

      if (view.focus < index + size) {
        if (group.posts.length < 2) {
          return
        }

        group.open = !group.open
        this.board.focus = index
        this.thumbs.want(...group.posts.filter((pick) => !this.thumbs.known(postKey(pick.site, pick.post.id))))
        this.show()
        this.scroll()
        this.paint.glide()
        this.paint.draw()

        return
      }

      index += size
    }
  }

  async search(): Promise<void> {
    const board = blank(this.boardKey, 'planning')
    this.board = board
    this.boards.set(board.key, board)
    this.tell()

    const plans = this.sites().flatMap((site) => {
      const query = this.tags.query(site)

      return query ? [{ site, ...query }] : []
    })

    const missing = this.sites().filter((site) => !plans.some((plan) => plan.site === site))

    const notes = [
      ...plans.flatMap(({ notes }) => notes),
      ...(missing.length > 0
        ? [`${this.entry.name} has no tag on ${missing.map((site) => site.name).join(', ')}`]
        : []),
    ]

    board.note = notes.length > 0 ? notes.join('  ') : undefined

    if (plans.length === 0) {
      board.state = 'resting'
    }

    this.show()
    this.paint.draw()
    void this.tally(board, plans)

    try {
      const owned = await Promise.all(
        plans.map(async (plan) => ({ plan, owners: await this.kept.mateOwners(plan.site) })),
      )

      board.sources = owned.flatMap(({ plan: { site, tags }, owners }) => {
        const by = tagsOf(tags) + 1 <= site.tagBudget ? site.uploadedBy : undefined

        return [
          ...(by ? owners.keys().map((owner) => ({ site, tags: `${tags} ${by(owner)}`, page: 0, done: false })) : []),
          { site, tags, page: 0, done: false },
        ]
      })
      board.state = 'resting'

      if (board === this.board) {
        await this.pump()
      }
    } catch (error) {
      this.fail(board, error instanceof Error ? error : String(error))
    }
  }

  private async tally(board: Board, plans: { site: Site; tags: string }[]): Promise<void> {
    const counts = await Promise.allSettled(plans.map(({ site, tags }) => this.net.fetchCount(site, tags, this.signal)))

    board.total = counts.reduce(
      (sum, count) => sum + (count.status === 'fulfilled' && Number.isFinite(count.value) ? count.value : 0),
      0,
    )

    if (board === this.board) {
      this.show()
      this.paint.draw()
    }
  }

  private told(name: string, error: Error | string): string {
    const account = wantedAccount(error)
    const site = account ? SITES.find((one) => one.account?.setting === account) : undefined

    return site?.account ? `${site.name} wants ${site.account.wants} — a sets it` : reason(name, error)
  }

  private want(board: Board, error: Error | string): void {
    const account = wantedAccount(error)

    if (!account) {
      return
    }

    board.wants = account

    if (board === this.board && this.site()?.account?.setting === account) {
      this.asks(account)
    }
  }

  private fail(board: Board, error: Error | string, site = this.site()): void {
    if (this.signal.aborted) {
      return
    }

    board.error = this.told(site?.name ?? this.tabName(), error)
    board.state = 'resting'
    this.want(board, error)

    if (board === this.board) {
      this.tell({ text: board.error, tone: 'error' })
      this.show()
      this.paint.draw()
    }
  }

  private drop(board: Board, site: Site, error: Error | string): void {
    for (const source of board.sources) {
      if (source.site === site) {
        source.done = true
      }
    }

    board.note = [board.note, this.told(site.name, error)].filter(Boolean).join('  ')
    this.want(board, error)

    if (board.arrived.size === 0 && board.sources.every((source) => source.done)) {
      board.error = board.note

      if (board === this.board) {
        this.tell({ text: board.error, tone: 'error' })
      }
    }
  }

  private wants(): boolean {
    const { perRow, rowsVis } = gridLayout(this.grid().cols, this.grid().rows)

    return this.view.tiles.length < (this.board.top + rowsVis + LOOKAHEAD) * perRow
  }

  private need(): number {
    const { perRow, rowsVis } = gridLayout(this.grid().cols, this.grid().rows)

    return (rowsVis + LOOKAHEAD) * perRow
  }

  private live(board: Board): boolean {
    return this.boards.get(board.key) === board
  }

  private page(site: Site, tags: string, page: number): Promise<Post[]> {
    const key = `${site.key}|${tags}|${page}`
    let job = this.pages.get(key)

    if (!job) {
      job = this.net.fetchPosts(site, tags, page, this.signal).then((posts) => this.borrow(site, posts))
      this.pages.set(key, job)
      job.catch(() => this.pages.delete(key))
    }

    return job
  }

  private async borrow(site: Site, posts: Post[]): Promise<Post[]> {
    const asking = site === LENDER ? [] : posts.filter((post) => post.md5 !== '')

    if (asking.length > 0) {
      try {
        lend(
          asking,
          await this.net.fetchLent(
            asking.map((post) => post.md5),
            this.signal,
            true,
          ),
        )
      } catch {}
    }

    return posts
  }

  private staged(board: Board): void {
    if (board === this.board) {
      this.stageOf(board)
      this.paint.draw()
    }
  }

  private async round(board: Board): Promise<void> {
    board.stage = { step: 'fetch' }
    this.staged(board)

    const due = SITES.flatMap((site) => {
      const source = board.sources.find((s) => s.site === site && !s.done)

      return source ? [source] : []
    })

    const got = await Promise.all(
      due.map(async (source) => {
        try {
          const posts = await this.page(source.site, source.tags, source.page)
          board.arrived.add(source.site.name)
          this.staged(board)

          return { source, posts }
        } catch (error) {
          if (board.sources.every((s) => s.site === source.site) || this.signal.aborted) {
            throw error
          }

          this.drop(board, source.site, error instanceof Error ? error : String(error))

          return { source, posts: undefined }
        }
      }),
    )

    if (!this.live(board)) {
      return
    }

    const picks: Pick[] = []

    for (const { source, posts } of got) {
      if (!posts) {
        continue
      }

      source.page++
      source.done = posts.length < PAGE
      let last = board.last.get(source)

      for (const post of posts) {
        const set = last && sameSet(last.post, post) ? last.set : `set:${source.site.key}:${post.id}`
        last = { post, set }
        const key = postKey(source.site, post.id)

        if (board.seen.has(key)) {
          continue
        }

        board.seen.add(key)
        const pick = { site: source.site, post }

        if (this.eligible(pick)) {
          board.kin.set(pick, [set, ...kinKeys(source.site, post)])
          picks.push(pick)
        } else {
          board.checked++
        }
      }

      if (last) {
        board.last.set(source, last)
      }
    }

    const kept = this.dedupe(board, picks)
    const round = ++board.rounds
    let ordered: Pick[]

    if (this.view.order !== 'fit') {
      ordered = due.length > 1 ? interleave(kept) : kept
    } else {
      const rough = fitOrder(kept, this.frame(), this.matched)
      const head = rough.slice(0, this.need())
      const ranking = { step: 'rank' as const, done: 0, total: head.length }
      board.stage = ranking
      this.staged(board)
      await this.looks(head, () => {
        ranking.done++
        this.staged(board)
      })
      board.stage = { step: 'fetch' }

      if (!this.live(board)) {
        return
      }

      ordered = [...fitOrder(head, this.frame(), this.matched), ...rough.slice(head.length)]
    }

    board.stage = { step: 'check' }
    this.staged(board)

    for (const pick of ordered) {
      board.roundOf.set(pick, round)
    }

    board.queue.push(...ordered)
    this.ahead(board)
  }

  private ahead(board: Board): void {
    if (this.aheading || this.view.order !== 'fit' || !this.live(board)) {
      return
    }

    const next = board.queue
      .slice(0, this.need())
      .filter((pick) => !this.looking.has(postKey(pick.site, pick.post.id)) && !this.quiet(pick))

    if (next.length === 0) {
      return
    }

    this.aheading = true
    void this.looks(next).then(() => {
      this.aheading = false

      for (const round of new Set(next.map((pick) => board.roundOf.get(pick) ?? 0))) {
        this.resort(board, round)
      }

      this.ahead(board)
    })
  }

  private resort(board: Board, round: number): void {
    const at = board.queue.flatMap((pick, i) => (board.roundOf.get(pick) === round ? [i] : []))

    const sorted = fitOrder(
      at.map((i) => board.queue[i] as Pick),
      this.frame(),
      this.matched,
    )

    at.forEach((i, k) => {
      board.queue[i] = sorted[k] as Pick
    })
  }

  private dedupe(board: Board, picks: Pick[]): Pick[] {
    const out: Pick[] = []

    for (const pick of picks) {
      const keys = sameKeys(pick.post)
      const held = keys.map((key) => board.same.get(key)).find(Boolean)

      if (!held) {
        for (const key of keys) {
          board.same.set(key, pick)
        }

        out.push(pick)
        continue
      }

      board.checked++

      if (area(pick.post) <= area(held.post)) {
        continue
      }

      for (const key of [...keys, ...sameKeys(held.post)]) {
        board.same.set(key, pick)
      }

      const within = out.indexOf(held)

      if (within >= 0) {
        out[within] = pick
        continue
      }

      this.replace(board, held, pick)
    }

    return out
  }

  private replace(board: Board, held: Pick, pick: Pick): void {
    board.roundOf.set(pick, board.roundOf.get(held) ?? 0)
    const queued = board.queue.indexOf(held)

    if (queued >= 0) {
      board.queue[queued] = pick

      return
    }

    for (const group of board.groups) {
      const at = group.posts.indexOf(held)

      if (at >= 0) {
        group.posts[at] = pick
        this.posts.set(postKey(pick.site, pick.post.id), pick)
        this.thumbs.want(pick)

        return
      }
    }
  }

  private async looks(picks: Pick[], each?: () => void): Promise<void> {
    let next = 0

    const lane = async () => {
      while (next < picks.length) {
        await this.sight(picks[next++] as Pick)
        each?.()
      }
    }

    await Promise.all(Array.from({ length: THUMB }, lane))
  }

  private quiet(pick: Pick): boolean {
    return this.kept.pace.still(previewOf(pick.site, pick.post).site.key)
  }

  private async sight(pick: Pick): Promise<void> {
    const key = postKey(pick.site, pick.post.id)

    if (this.late.has(key) || this.quiet(pick)) {
      return
    }

    if (!(await this.kept.pace.wait(previewOf(pick.site, pick.post).site.key, this.look(pick)))) {
      this.late.add(key)
    }
  }

  private look(pick: Pick): Promise<Look | undefined> {
    const key = postKey(pick.site, pick.post.id)
    let job = this.looking.get(key)

    if (!job) {
      job = (async () => {
        const path = previewPath(this.scratch, pick)
        const from = previewOf(pick.site, pick.post)
        await this.kept.cached(from.site, path, from.url)
        const look = await this.renders.run({ job: 'match', from: path, colors: FACE.map((slot) => this.entry[slot]) })
        this.looked.set(key, look)
        this.matched.set(pick.post, look.match)

        return look
      })().catch(() => undefined)
      this.looking.set(key, job)
    }

    return job
  }

  async pump(): Promise<void> {
    const board = this.board

    if (board.state !== 'resting' || board.sources.length === 0) {
      return
    }

    board.state = 'pumping'
    this.staged(board)
    const flight: Vetting[] = []
    let failure: Error | string | undefined

    try {
      await this.pumped(board, flight)
    } catch (error) {
      failure = error instanceof Error ? error : String(error)
    }

    board.queue.unshift(...flight.map(({ pick }) => pick))
    board.state = 'resting'

    if (failure !== undefined) {
      board.round = undefined
      this.fail(board, failure)
    } else if (board === this.board) {
      this.show()
      this.paint.draw()
    }
  }

  private async pumped(board: Board, flight: Vetting[]): Promise<void> {
    while (board === this.board) {
      while (flight.length < PROBE && board.queue.length > 0 && this.wants()) {
        const pick = board.queue.shift() as Pick
        flight.push({ pick, passed: this.vet(pick) })
      }

      this.ahead(board)

      if (!board.round && board.queue.length < PROBE && board.sources.some((s) => !s.done) && this.wants()) {
        const round = this.round(board).then(() => {
          if (board.round === round) {
            board.round = undefined
          }
        })

        round.catch(() => {})
        board.round = round
      }

      const head = flight[0]

      if (head) {
        const passed = await head.passed

        if (board !== this.board) {
          return
        }

        flight.shift()
        board.checked++

        if (passed) {
          this.admit(board, head.pick)
        }
      } else if (board.round) {
        await board.round
      } else {
        return
      }

      if (board === this.board) {
        this.show()
        this.paint.draw()
      }
    }
  }

  private eligible({ site, post }: Pick): boolean {
    const version = rendition(post)

    if (!rated(site, post, this.view.rating) || exposed(post, this.view.block).length > 0 || !version) {
      return false
    }

    if (this.view.solo && post.solo === false) {
      return false
    }

    const { score, size, png } = this.view.narrow

    if (
      Math.min(post.width, post.height) < size ||
      (site.scored && post.score < score) ||
      (png && post.ext !== 'png') ||
      hidden(post, this.view.hide).length > 0 ||
      this.view.hideTags.some((tag) => post.tags.includes(tag))
    ) {
      return false
    }

    return this.view.preset === 'all'
      ? ['png', 'jpg', 'jpeg', ''].includes(version.ext)
      : ['png', ''].includes(post.ext)
  }

  private async vet(pick: Pick): Promise<boolean> {
    const [passed] = await Promise.all([this.passes(pick), this.sight(pick)])

    return passed
  }

  private async passes({ site, post }: Pick): Promise<boolean> {
    return this.view.preset === 'all' || site.vouched || this.kept.transparent(site, post)
  }

  private admit(board: Board, pick: Pick): void {
    const { site, post } = pick
    const key = postKey(site, post.id)
    this.posts.set(key, pick)
    const keys = board.kin.get(pick) ?? []
    const look = this.looked.get(key)
    const size = look && { hash: look.hash, width: post.width, height: post.height }
    const kindred = this.view.sets === 'fold' ? this.kindred(board, keys, size) : undefined

    if (kindred) {
      kindred.posts.push(pick)
      this.register(board, kindred, keys, size)

      if (kindred.open) {
        this.thumbs.want(pick)
      }

      return
    }

    const group = { posts: [pick], open: false }
    board.groups.push(group)
    this.register(board, group, keys, size)
    this.thumbs.want(pick)
  }

  private kindred(board: Board, keys: string[], size: Size | undefined): Group | undefined {
    for (const key of keys) {
      const group = board.kindred.get(key)

      if (group) {
        return group
      }
    }

    return size && board.sizes.find((held) => near(held.size, size))?.group
  }

  private register(board: Board, group: Group, keys: string[], size: Size | undefined): void {
    for (const key of keys) {
      if (!board.kindred.has(key)) {
        board.kindred.set(key, group)
      }
    }

    if (size) {
      board.sizes.push({ size, group })
    }
  }
}
