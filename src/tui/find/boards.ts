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
} from '../../core/booru.ts'
import type { PaletteEntry } from '../../core/manifest.ts'
import { FACE } from '../../core/slots.ts'
import { fetchCount, fetchLent, fetchPost, fetchPosts } from '../../pictures/booru-net.ts'
import { type Frame, fitOrder, interleave, type Pick } from '../../pictures/fit.ts'
import type { Look, Renderer } from '../../pictures/render.ts'
import { kinKeys, near, type Size, sameKeys, sameSet } from '../../pictures/works.ts'
import { LOCAL, sourceLabel } from './attach.ts'
import type { Kept } from './kept.ts'
import type { Paint } from './paint.ts'
import { type FindView, gridLayout, type Stage, type Tile } from './screen.ts'
import { type Grid, previewPath, reason } from './session.ts'
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
  searching: boolean
  stage: Stage
  ranking?: { done: number; total: number }
  arrived: Set<string>
  error?: string
  note?: string
}

function blank(key: string, searching: boolean): Board {
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
    searching,
    stage: 'fetch',
    arrived: new Set(),
  }
}

function area(post: Post): number {
  return post.width * post.height
}

interface Host {
  view: FindView
  grid: () => Grid
  entry: PaletteEntry
  scratch: string
  signal: AbortSignal
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
  halt: () => void
  select: () => void
  scroll: () => void
}

export class Boards {
  board: Board
  readonly posts = new Map<number, Pick>()
  private gen = 0
  private pumping = 0
  private readonly boards = new Map<string, Board>()
  private readonly looking = new Map<number, Promise<Look | undefined>>()
  private readonly looked = new Map<number, Look>()
  private readonly matched = new Map<Post, number>()
  private aheading = false
  private readonly pages = new Map<string, Promise<Post[]>>()
  private showing?: Board

  private readonly view: FindView
  private readonly grid: () => Grid
  private readonly entry: PaletteEntry
  private readonly scratch: string
  private readonly signal: AbortSignal
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
  private readonly halt: () => void
  private readonly select: () => void
  private readonly scroll: () => void

  constructor(host: Host) {
    this.view = host.view
    this.grid = host.grid
    this.entry = host.entry
    this.scratch = host.scratch
    this.signal = host.signal
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
    this.halt = host.halt
    this.select = host.select
    this.scroll = host.scroll
    this.board = blank(this.boardKey, this.view.tag !== '')
    this.boards.set(this.board.key, this.board)
  }

  clear(): void {
    this.boards.clear()
  }

  alone(key: string, pick: Pick): void {
    ++this.gen
    this.forget()
    const board = blank(key, false)
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
    view.searching = board.searching
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
    view.stage = board.stage
    view.ranking = board.ranking
    view.sites = this.sites().map((site) => ({ name: site.name, arrived: board.arrived.has(site.name) }))
  }

  private single(board: Board, pick: Pick): void {
    board.searching = false
    this.posts.set(postKey(pick.site, pick.post.id), pick)
    board.groups = [{ posts: [pick], open: false }]
    board.checked = 1
    board.total = 1
    this.thumbs.want(pick)
    this.view.mode = 'try'
    this.show()
    this.select()
    this.paint.draw()
  }

  async jump(site: Site, id: number): Promise<void> {
    const gen = ++this.gen
    this.tabTo(site)
    this.forget()
    this.view.notice = undefined
    const board = blank(`${site.key}|post:${id}`, true)
    this.board = board
    this.boards.set(board.key, board)
    this.show()
    this.paint.draw()

    try {
      const post = await fetchPost(site, id, this.signal)

      if (gen !== this.gen) {
        return
      }

      if (!post) {
        board.searching = false
        board.error = `${site.name} has no post ${id}`
        this.view.notice = { text: board.error, tone: 'error' }
        this.show()
        this.paint.draw()

        return
      }

      this.single(board, { site, post })
    } catch (error) {
      this.fail(gen, error instanceof Error ? error : String(error), site)
    }
  }

  async turn(): Promise<void> {
    this.halt()
    this.forget()
    const known = this.boards.get(this.boardKey)

    if (!known) {
      await this.search()

      return
    }

    this.gen++
    this.board = known
    this.view.notice = known.error ? { text: known.error, tone: 'error' } : undefined
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
    const gen = ++this.gen
    const board = blank(this.boardKey, true)
    this.board = board
    this.boards.set(board.key, board)
    this.view.notice = undefined

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
      board.searching = false
    }

    this.show()
    this.paint.draw()
    void this.tally(gen, board, plans)

    try {
      const owned = await Promise.all(
        plans.map(async (plan) => ({ plan, owners: await this.kept.mateOwners(plan.site) })),
      )

      if (gen !== this.gen) {
        return
      }

      board.sources = owned.flatMap(({ plan: { site, tags }, owners }) => {
        const by = tagsOf(tags) + 1 <= site.tagBudget ? site.uploadedBy : undefined

        return [
          ...(by ? owners.keys().map((owner) => ({ site, tags: `${tags} ${by(owner)}`, page: 0, done: false })) : []),
          { site, tags, page: 0, done: false },
        ]
      })
      this.show()
      this.paint.draw()
      await this.pump()
    } catch (error) {
      this.fail(gen, error instanceof Error ? error : String(error))
    }
  }

  private async tally(gen: number, board: Board, plans: { site: Site; tags: string }[]): Promise<void> {
    const counts = await Promise.allSettled(plans.map(({ site, tags }) => fetchCount(site, tags, this.signal)))

    if (gen === this.gen) {
      board.total = counts.reduce(
        (sum, count) => sum + (count.status === 'fulfilled' && Number.isFinite(count.value) ? count.value : 0),
        0,
      )
      this.show()
      this.paint.draw()
    }
  }

  private fail(gen: number, error: Error | string, site = this.site()): void {
    if (gen !== this.gen || this.signal.aborted) {
      return
    }

    this.board.error = reason(site?.name ?? this.tabName(), error)
    this.board.searching = false
    this.view.notice = { text: this.board.error, tone: 'error' }
    this.show()
    this.paint.draw()
  }

  private drop(board: Board, site: Site, error: Error | string): void {
    for (const source of board.sources) {
      if (source.site === site) {
        source.done = true
      }
    }

    board.note = [board.note, reason(site.name, error)].filter(Boolean).join('  ')

    if (board.arrived.size === 0 && board.sources.every((source) => source.done)) {
      board.error = board.note

      if (board === this.board) {
        this.view.notice = { text: board.error, tone: 'error' }
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
      job = fetchPosts(site, tags, page, this.signal).then((posts) => this.borrow(site, posts))
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
          await fetchLent(
            asking.map((post) => post.md5),
            this.signal,
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
    board.stage = 'fetch'
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
      const ranking = { done: 0, total: head.length }
      board.ranking = ranking
      this.staged(board)
      await this.looks(head, () => {
        ranking.done++
        this.staged(board)
      })
      board.ranking = undefined

      if (!this.live(board)) {
        return
      }

      ordered = [...fitOrder(head, this.frame(), this.matched), ...rough.slice(head.length)]
    }

    board.stage = 'check'
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

    const next = board.queue.slice(0, this.need()).filter((pick) => !this.looking.has(postKey(pick.site, pick.post.id)))

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
        await this.look(picks[next++] as Pick)
        each?.()
      }
    }

    await Promise.all(Array.from({ length: THUMB }, lane))
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
    const gen = this.gen
    const board = this.board

    if (this.pumping === gen || board.sources.length === 0) {
      return
    }

    this.pumping = gen
    const flight: { pick: Pick; passed: Promise<boolean> }[] = []
    let page: Promise<void> | undefined

    try {
      board.searching = true

      while (gen === this.gen) {
        while (flight.length < PROBE && board.queue.length > 0 && this.wants()) {
          const pick = board.queue.shift() as Pick
          flight.push({ pick, passed: this.vet(pick) })
        }

        this.ahead(board)

        if (!page && board.queue.length < PROBE && board.sources.some((s) => !s.done) && this.wants()) {
          const job = this.round(board).then(() => {
            if (page === job) {
              page = undefined
            }
          })

          job.catch(() => {})
          page = job
        }

        const head = flight.shift()

        if (!head) {
          if (!page) {
            break
          }

          await page
          this.show()
          this.paint.draw()
          continue
        }

        const passed = await head.passed

        if (gen !== this.gen) {
          return
        }

        board.checked++

        if (passed) {
          this.admit(head.pick)
        }

        this.show()
        this.paint.draw()
      }

      if (gen === this.gen) {
        board.searching = false
        this.show()
        this.paint.draw()
      }
    } catch (error) {
      this.fail(gen, error instanceof Error ? error : String(error))
    } finally {
      if (this.pumping === gen) {
        this.pumping = 0
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
    const [passed] = await Promise.all([this.passes(pick), this.look(pick)])

    return passed
  }

  private async passes({ site, post }: Pick): Promise<boolean> {
    return this.view.preset === 'all' || site.vouched || this.kept.transparent(site, post)
  }

  private admit(pick: Pick): void {
    const { site, post } = pick
    const board = this.board
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
