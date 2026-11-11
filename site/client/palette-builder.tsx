import { DraftEntries, DraftRoom } from '@/components/builder-drafts'
import { FilePanel, LinkPanel, MarketSteps } from '@/components/builder-export'
import {
  BaseRows,
  ChangedLabel,
  Checks,
  ContrastHead,
  FileNote,
  GateChecks,
  GateSummary,
  Lch,
  MarkTile,
  Modes,
  PairRows,
  Picker,
  PickerActions,
  PickerHead,
  PicturesBox,
  PlaneRows,
  SeedStrip,
  StartLabel,
  StatusText,
  Use,
} from '@/components/builder-parts'
import { StartEntries } from '@/components/builder-start'
import { Dots } from '@/components/dots'
import { PaneBody } from '@/components/mock-window'
import {
  askedDraft,
  type BuilderData,
  changedIn,
  changes,
  dirty,
  draftsOn,
  dropped,
  type Edit,
  editOf,
  followMirror,
  kept,
  listIn,
  madeMode,
  modeOfView,
  nameTrouble,
  newName,
  originIn,
  RETURNS,
  reread,
  reseeded,
  resetAll,
  restored,
  type Seeding,
  type Shelf,
  type Start,
  type Stored,
  startBlank,
  storedOf,
  TAB_KEY,
  type View,
  withSlot,
} from '@/lib/builder'
import {
  aboutOf,
  DOTS,
  dotsOf,
  draftListOf,
  exportProblem,
  fileOf,
  gateOf,
  linkOf,
  marketOf,
  modesOf,
  type PickerView,
  pickerOf,
  type RowFormat,
  ratioAt,
  rowsOf,
  type Sharing,
  type StartGroup,
  type StartList,
  seedRowsOf,
  seedsAtDefault,
  setDrafts,
  shared,
  sharingOf,
  slotVars,
  statusOf,
} from '@/lib/builder-view'
import { DRAFT_KEY, STORE } from '@/lib/drafts'
import type { Mode } from '@/lib/mode'
import { html } from '@/lib/render'
import { scenePanes } from '@/lib/scene-panes'
import { hueTrack } from '@/lib/slot-view'
import { BUILTIN } from '@/lib/themes'
import { FORMATS, type Pane, type Picture, type PictureCredit, type SlotFormat } from '@/lib/view-types'
import { textDraft, webCheck, webCode } from '@/lib/web-code'
import { type Hex, mix, type Oklch } from '../../src/core/color.ts'
import { codeOf, type Draft } from '../../src/core/draft.ts'
import { PLANE_BOTTOM, PLANE_TOP, reach } from '../../src/core/plane.ts'
import { marketplaceToml, readmeOf, repoFor } from '../../src/core/scaffold.ts'
import { lchIn, misses, SLOT_NAMES, slotLabel } from '../../src/core/slots.ts'
import {
  brightLinks,
  following,
  offsetOf,
  parseColor,
  partnerOf,
  placed,
  room,
  solveLightness,
} from '../../src/core/tune.ts'
import { zip } from '../../src/core/zip.ts'
import { announce, fill, readJson, reducedMotion } from './dom'
import { Inspector } from './inspector'
import { composing, typing } from './keys'
import type { OpenChange, PressedChange, ValueChange } from './ui/change'
import { press } from './ui/pressed'

interface Snapshot {
  made: Hex[]
  other: Edit['other']
}

interface Drag {
  plane: HTMLElement
  pointer: number
  frame: number
  at: [number, number] | null
}

interface Picking {
  slot: number
  keep: number
  hue: number | null
  drag: Drag | null
}

type Starts = { state: 'idle' | 'loading' | 'failed' } | { state: 'ready'; starts: Start[] }

const SAVE_MS = 400

const LEAST = { cols: 40, rows: 10 }

const at = (value: number) => `${(value * 100).toFixed(2)}%`

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value))

const freshId = () => crypto.randomUUID()

function snapshotOf(edit: Edit): Snapshot {
  return {
    made: [...edit.made],
    other: { base: edit.other.base ? [...edit.other.base] : null, tuned: { ...edit.other.tuned } },
  }
}

function readStore(): Stored | null {
  try {
    return storedOf(localStorage.getItem(STORE))
  } catch {
    return null
  }
}

function shelve(change: (stored: Stored) => Stored): Shelf {
  const stored = readStore()

  if (!stored) return { state: 'none' }
  const next = change(stored)

  if (next === stored) return { state: 'kept', stored }

  try {
    localStorage.setItem(STORE, JSON.stringify(next))

    return { state: 'kept', stored: next }
  } catch {
    return { state: 'refused', stored }
  }
}

function tabDraft(drafts: readonly Edit[]): Edit | undefined {
  try {
    const entry = performance.getEntriesByType('navigation')[0]

    if (!(entry instanceof PerformanceNavigationTiming) || !RETURNS.includes(entry.type)) return undefined
    const id = sessionStorage.getItem(TAB_KEY)

    return drafts.find((draft) => draft.id === id)
  } catch {
    return undefined
  }
}

function groupsOf(starts: Start[]): StartGroup[] {
  return [...Map.groupBy(starts, (start) => start.shelf)].map(([, palettes]) => {
    const { work, publisher } = palettes[0] as Start

    return {
      title: work?.name ?? 'originals',
      native: work ? work.native : publisher,
      lang: work?.lang ?? undefined,
      palettes: palettes.map((start) => ({
        name: start.name,
        label: start.name.slice(start.name.indexOf('/') + 1),
        words: start.words,
        publisher: work && start.publisher !== BUILTIN ? start.publisher : null,
        dots: start.dots,
        lead: start.lead,
      })),
    }
  })
}

class PaletteBuilder extends HTMLElement {
  #data: BuilderData | undefined
  #edit: Edit | undefined
  #view: View = 'made'
  #format: SlotFormat = 'hex'
  #rows: RowFormat = 'hex'
  #picker: Picking | null = null
  #where = true
  #only = false
  #history: Snapshot[] = []
  #future: Snapshot[] = []
  #last: string | undefined
  #links = new Map<number, Oklch>()
  #unlinked = new Set<number>()
  #seeding: Seeding | null = null
  #starts: Starts = { state: 'idle' }
  #draftQuery = ''
  #deleted: Edit | null = null
  #shelf: Shelf = { state: 'none' }
  #owed: { timer: number } | null = null
  #linkId: string | null = null
  #credits = new Map<string, PictureCredit | null>()
  #market = { owner: '', name: '', description: '' }
  #sharing: Sharing = { state: 'idle' }
  #urls = new Map<string, string>()
  #shown = new WeakMap<Element, string>()
  #queued: { frame: number; work: () => void } | null = null
  #grid = ''
  #panes = new Map<string, Pane>()
  #sizer: ResizeObserver | undefined
  #sizing = 0
  #follow = new ResizeObserver(() => this.#placePicker())
  #inspector = new Inspector(
    this,
    () => this.#named(),
    () => {
      const list = this.#list()

      return mix(list[1] as Hex, list[0] as Hex, 0.45)
    },
  )

  connectedCallback() {
    this.#data = readJson<BuilderData>(this, 'script[data-builder]')
    this.#shelf = reread(this.#shelf, readStore())
    const link = this.#data.link !== null
    const asked = link ? undefined : askedDraft(location.search, this.#drafts)
    const back = link ? undefined : (asked ?? tabDraft(this.#drafts))
    const fresh = link || back ? null : newName(location.search)
    this.#edit = back ?? editOf(this.#data.first.draft, this.#data.first.name, link, freshId(), Date.now())

    if (fresh !== null) {
      const blank = startBlank(this.#edit, null, freshId(), Date.now(), fresh)
      this.#seeding = blank.seeding
      this.#edit = blank.edit
    }

    if (link) this.#linkId = this.#edit.id
    this.#mark()
    this.#relink()
    this.addEventListener('click', this.#click)
    this.addEventListener('input', this.#input)
    this.addEventListener('change', this.#change)
    this.addEventListener('keydown', this.#key)
    this.addEventListener('pointerdown', this.#press)
    this.addEventListener('openchange', this.#opened)
    this.addEventListener('valuechange', this.#changed)
    this.addEventListener('pressedchange', this.#pressed)
    addEventListener('pagehide', this.#flush)
    addEventListener('storage', this.#synced)
    const term = this.querySelector<HTMLElement>('[data-term]')
    term?.addEventListener('pointerover', this.#inspector.over)
    term?.addEventListener('pointerleave', this.#inspector.leave)

    if (term) {
      this.#sizer = new ResizeObserver(() => {
        cancelAnimationFrame(this.#sizing)
        this.#sizing = requestAnimationFrame(() => this.#fit())
      })
      this.#sizer.observe(term)
    }

    const colors = this.querySelector('[data-panel-body="colors"]')

    if (colors) this.#follow.observe(colors)
    this.#fit()
    this.#render()
    this.#arrive(asked !== undefined)
    this.#renderDrafts()
    this.#tail()
    document.documentElement.removeAttribute('data-restoring')

    if (link) void this.#loadCredits()
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.#click)
    this.removeEventListener('input', this.#input)
    this.removeEventListener('change', this.#change)
    this.removeEventListener('keydown', this.#key)
    this.removeEventListener('pointerdown', this.#press)
    this.removeEventListener('openchange', this.#opened)
    this.removeEventListener('valuechange', this.#changed)
    this.removeEventListener('pressedchange', this.#pressed)
    removeEventListener('pagehide', this.#flush)
    removeEventListener('storage', this.#synced)
    this.#sizer?.disconnect()
    this.#follow.disconnect()
    cancelAnimationFrame(this.#sizing)
    this.#endDrag(false)
    this.#unqueue(false)
    this.#flush()

    for (const url of this.#urls.values()) URL.revokeObjectURL(url)
  }

  get #state(): Edit {
    return this.#edit as Edit
  }

  #list(): Hex[] {
    return listIn(this.#state, this.#view)
  }

  #named() {
    const list = this.#list()

    return list.map((hex, slot) => ({ hex, key: SLOT_NAMES[slot] as string, name: slotLabel(slot).name }))
  }

  #fill(target: Element | null, markup: string) {
    if (!target || this.#shown.get(target) === markup) return
    this.#shown.set(target, markup)
    fill(target, markup)
  }

  #relink() {
    this.#links = brightLinks(originIn(this.#state, this.#view))
    this.#unlinked = new Set()
  }

  #linked(): Set<number> {
    return new Set([...this.#links.keys()].filter((bright) => !this.#unlinked.has(bright)))
  }

  #remember(kind: string) {
    if (kind === this.#last && !kind.startsWith('!')) return
    this.#history.push(snapshotOf(this.#state))
    this.#future = []
    this.#last = kind

    if (this.#history.length > 200) this.#history.shift()
  }

  #settle() {
    this.#last = undefined
  }

  #commit(next: Edit) {
    this.#edit = { ...next, at: Date.now() }
    this.#render()
    this.#save()
  }

  #set(slot: number, hex: Hex, kind: string) {
    const edit = this.#state

    if (listIn(edit, this.#view)[slot] === hex) return
    this.#remember(kind)
    let next = withSlot(edit, this.#view, slot, hex)
    const moved = new Set([slot])

    for (const [bright, by] of this.#links) {
      if (this.#unlinked.has(bright)) continue
      const normal = bright - 8

      if (moved.has(bright) && !moved.has(normal)) {
        this.#unlinked.add(bright)
      } else if (moved.has(normal) && !moved.has(bright)) {
        const list = listIn(next, this.#view)
        next = withSlot(next, this.#view, bright, following(lchIn(list, list[normal] as Hex), by).hex)
      }
    }

    this.#commit(next)
  }

  #save() {
    window.clearTimeout(this.#owed?.timer)
    this.#owed = { timer: window.setTimeout(this.#flush, SAVE_MS) }
  }

  #flush = () => {
    const owed = this.#owed

    if (!owed) return
    window.clearTimeout(owed.timer)
    this.#owed = null
    this.#mark()
    this.#shelf = shelve((stored) => kept(stored, this.#state))
    this.#renderStatus()
    this.#renderDrafts()
  }

  #mark() {
    try {
      sessionStorage.setItem(TAB_KEY, this.#state.id)
    } catch {}
  }

  #synced = (event: StorageEvent) => {
    if (event.key !== STORE) return
    this.#shelf = reread(this.#shelf, readStore())
    this.#renderStatus()
    this.#renderDrafts()
  }

  #renderDrafts() {
    const drafts = this.#drafts
    const list = draftListOf(drafts, this.#state.id, this.#draftQuery, this.#deleted?.name ?? null, Date.now())
    this.#fill(this.querySelector('[data-drafts-list]'), html(<DraftEntries list={list} />))
    this.#fill(this.querySelector('[data-drafts-room]'), html(<DraftRoom list={list} />))
    const count = this.querySelector<HTMLElement>('[data-drafts-count]')

    if (count) {
      count.hidden = drafts.length === 0
      count.textContent = String(drafts.length)
    }

    const search = this.querySelector<HTMLElement>('[data-drafts-search]')

    if (search) search.hidden = drafts.length === 0
  }

  #deleteDraft(id: string) {
    const edit = readStore()?.drafts.find((draft) => draft.id === id)

    if (!edit || id === this.#state.id) return
    this.#shelf = shelve((stored) => dropped(stored, id))
    const gone = this.#shelf.state === 'kept'

    if (gone) this.#deleted = edit
    this.#renderStatus()
    this.#renderDrafts()

    if (!gone) return
    this.querySelector<HTMLElement>('[data-draft-undo]')?.focus()
    announce(`deleted ${edit.name}`)
  }

  #undoDelete() {
    const gone = this.#deleted

    if (!gone) return
    this.#shelf = shelve((stored) => restored(stored, gone))
    const back = this.#shelf.state === 'kept'

    if (back) this.#deleted = null
    this.#renderStatus()
    this.#renderDrafts()

    if (!back) return
    this.querySelector<HTMLElement>(`[data-draft-open="${gone.id}"]`)?.focus()
    announce(`${gone.name} is back`)
  }

  #schedule(work: () => void) {
    if (this.#queued) {
      this.#queued.work = work

      return
    }

    const queued = {
      work,
      frame: requestAnimationFrame(() => {
        this.#queued = null
        queued.work()
      }),
    }

    this.#queued = queued
  }

  #unqueue(run: boolean) {
    const queued = this.#queued

    if (!queued) return
    cancelAnimationFrame(queued.frame)
    this.#queued = null

    if (run) queued.work()
  }

  #render() {
    const edit = this.#state
    const list = this.#list()
    const missed = misses(list)
    const changed = changedIn(edit, this.#view)
    const gate = gateOf(list)
    const mock = this.querySelector<HTMLElement>('[data-mock]')

    for (const part of slotVars(list).split(';')) {
      const [name, value] = part.split(':') as [string, string]
      mock?.style.setProperty(name, value)
    }

    this.#fill(this.querySelector('[data-bar-dots]'), html(<Dots colors={dotsOf(list, DOTS)} />))
    const edits = changes(edit)
    const shown = this.querySelector<HTMLElement>('[data-changed]')
    this.#fill(this.querySelector('[data-changed-label]'), html(<ChangedLabel count={edits} />))

    if (shown) {
      shown.hidden = edits === 0 && !this.#only
      press(shown, this.#only)
    }

    this.#enable('[data-undo]', this.#history.length > 0)
    this.#enable('[data-redo]', this.#future.length > 0)
    this.#enable('[data-reset]', edits > 0)
    this.#renderName()

    const open = this.#picker?.slot ?? null
    const rows = rowsOf(list, missed, changed, this.#rows, open, this.#linked(), this.#only)
    this.#fill(this.querySelector('[data-base-rows]'), html(<BaseRows rows={rows.base} />))
    this.#fill(this.querySelector('[data-pair-rows]'), html(<PairRows pairs={rows.pairs} />))
    const empty = this.querySelector<HTMLElement>('[data-rows-empty]')

    if (empty) empty.hidden = !(this.#only && rows.empty)
    this.#fill(this.querySelector('[data-gate-summary]'), html(<GateSummary gate={gate} />))
    const names = this.#named().map((slot) => slot.name)
    this.#fill(this.querySelector('[data-gate-checks]'), html(<GateChecks gate={gate} names={names} />))
    const made = madeMode(edit)
    const editing = modeOfView(edit, this.#view)

    for (const button of this.querySelectorAll<HTMLElement>('[data-edit-modes] [data-slot="toggle"]')) {
      press(button, button.dataset.value === editing)
      const dot = button.querySelector<HTMLElement>('[data-made-dot]')

      if (dot) dot.hidden = button.dataset.value !== made
    }

    this.#renderPicker()
    this.#renderAbout()
    this.#renderSeeds()
    this.#renderStatus()
    this.#renderExport()
    this.#renderShared()
    this.#inspector.redraw()
    this.#light()
  }

  #renderShared() {
    const on = this.#state.id === this.#linkId
    const touched = on && dirty(this.#state)

    for (const part of this.querySelectorAll<HTMLElement>('[data-link-only]')) part.hidden = !on
    const add = this.querySelector<HTMLElement>('[data-add]')

    if (add) add.hidden = !on || touched
    const exporting = this.querySelector<HTMLElement>('[data-bar] [data-export-open]')

    if (exporting) exporting.hidden = on && !touched
    const note = this.querySelector<HTMLElement>('[data-touched-note]')

    if (note) note.hidden = !touched
  }

  async #loadCredits() {
    try {
      const response = await fetch(`${location.pathname.replace(/\/$/, '')}/credits.json${location.search}`)

      if (!response.ok) return

      for (const picture of (await response.json()) as Picture[]) this.#credits.set(picture.post, picture.credit)
      this.#renderAbout()
    } catch {}
  }

  #enable(selector: string, on: boolean) {
    const button = this.querySelector<HTMLButtonElement>(selector)

    if (button) button.disabled = !on
  }

  #renderName() {
    const edit = this.#state
    const problem = nameTrouble(edit.name)

    for (const input of this.querySelectorAll<HTMLInputElement>('[data-name], [data-about-name]')) {
      if (input.value !== edit.name && document.activeElement !== input) input.value = edit.name
      input.setAttribute('aria-invalid', String(problem !== undefined))
    }

    const shown = this.querySelector<HTMLElement>('[data-name-problem]')

    if (shown) {
      shown.hidden = problem === undefined
      shown.textContent = problem ? `the name ${problem}` : ''
    }

    const title = this.querySelector('[data-export-name]')

    if (title) title.textContent = edit.name
    this.#fill(this.querySelector('[data-start-label]'), html(<StartLabel source={edit.source} />))
  }

  #renderStatus() {
    const status = statusOf(this.#state, this.#shelf)
    this.#fill(document.querySelector('[data-status]'), html(<StatusText status={status} />))
  }

  #renderAbout() {
    const edit = this.#state
    const shown = aboutOf(edit, this.#view)

    const about = {
      ...shown,
      pictures: shown.pictures.map((picture) => ({ ...picture, credit: this.#credits.get(picture.post) ?? null })),
    }

    const box = this.querySelector<HTMLElement>('[data-panel-body="about"]')

    if (!box) return
    this.#fill(this.querySelector('[data-file-note]'), html(<FileNote about={about} />))
    this.#fill(this.querySelector('[data-mark-tile]'), html(<MarkTile about={about} />))
    this.#fill(this.querySelector('[data-modes]'), html(<Modes modes={modesOf(edit)} />))
    const pictures = this.querySelector('[data-pictures]')

    if (pictures && !pictures.contains(document.activeElement))
      this.#fill(pictures, html(<PicturesBox about={about} />))

    for (const input of this.querySelectorAll<HTMLInputElement>('[data-meta]')) {
      if (input.value !== about.subject && document.activeElement !== input) input.value = about.subject

      input.setAttribute('aria-invalid', String(about.unread))
    }
  }

  #renderSeeds() {
    const seeds = this.#seeding?.seeds ?? null
    const colors = this.querySelector<HTMLElement>('[data-panel-body="colors"]')
    const body = this.querySelector<HTMLElement>('[data-panel-body="seeds"]')
    const first = this.querySelector('[data-first-tab]')

    if (first) first.textContent = seeds ? 'seeds' : 'colors'

    if (body) body.hidden = !seeds

    if (colors) colors.hidden = seeds !== null

    if (!seeds) return
    const fresh = this.querySelector<HTMLElement>('[data-seed-default]')

    if (fresh) fresh.hidden = !seedsAtDefault(seeds)

    for (const row of seedRowsOf(seeds)) {
      const shown = this.querySelector(`[data-seed-value="${row.key}"]`)

      if (shown) shown.textContent = row.shown
      const input = this.querySelector<HTMLInputElement>(`[data-seed="${row.key}"]`)

      if (input && document.activeElement !== input && Number(input.value) !== row.value)
        input.value = String(row.value)
    }

    this.#fill(this.querySelector('[data-seed-strip]'), html(<SeedStrip list={this.#state.made} />))
    const gate = gateOf(this.#state.made)
    const passed = this.querySelector('[data-seed-gate]')

    if (passed) passed.textContent = `${gate.passed} / ${gate.lines.length} pass`
  }

  #pickerView(slot: number): PickerView {
    const edit = this.#state
    const list = this.#list()
    const link = slot >= 4 ? (this.#linked().has(slot >= 12 ? slot : slot + 8) ? 'on' : 'off') : null

    return pickerOf(
      list,
      originIn(edit, this.#view),
      slot,
      misses(list),
      this.#data?.uses[slot] ?? [],
      link,
      this.#format,
      this.#where,
    )
  }

  #renderPicker() {
    const picker = this.#picker

    if (!picker) return
    const p = this.#pickerView(picker.slot)
    const { s } = p
    this.#fill(this.querySelector('[data-picker-head]'), html(<PickerHead p={p} />))

    if (picker.hue !== s.hue) {
      picker.hue = s.hue
      this.#fill(this.querySelector('[data-plane-rows]'), html(<PlaneRows s={s} />))
    }

    this.#place('[data-thumb-plane]', s.x, s.y)
    this.#place('[data-thumb-hue]', s.along, 0.5)
    this.#place('[data-thumb-contrast]', p.partner.at, 0.5)
    const origin = p.origin

    for (const [selector, x, y] of [
      ['[data-origin-plane]', origin?.x, origin?.y],
      ['[data-origin-hue]', origin?.along, 0.5],
    ] as const) {
      const mark = this.querySelector<HTMLElement>(selector)

      if (!mark) continue
      mark.hidden = !origin

      if (origin && x !== undefined && y !== undefined) this.#place(selector, x, y)
    }

    this.#fill(this.querySelector('[data-lch]'), html(<Lch s={s} />))
    this.#fill(this.querySelector('[data-contrast-head]'), html(<ContrastHead p={p} />))
    this.#value('[data-plane-l]', Math.round(Number(s.lch[0]) * 100))
    this.#value('[data-plane-c]', Math.round(s.x * 100))
    this.#value('[data-hue]', Math.round(s.hue) % 360)
    this.#value('[data-contrast]', Math.round(p.partner.at * 1000))
    this.querySelector('[data-contrast]')?.setAttribute('aria-valuetext', `${p.partner.ratio.toFixed(2)} to 1`)
    const value = this.querySelector<HTMLInputElement>('[data-value]')
    const text = s.formats[p.format]

    if (value && document.activeElement !== value) {
      value.value = text
      value.setAttribute('aria-invalid', 'false')
      this.querySelector<HTMLElement>('[data-bad]')?.toggleAttribute('hidden', true)
    }

    const copy = this.querySelector<HTMLElement>('[data-picker-card] [data-copy]')

    if (copy) copy.dataset.copy = text
    this.#fill(this.querySelector('[data-checks]'), html(<Checks s={s} />))
    this.#fill(this.querySelector('[data-use]'), html(<Use s={s} panes={this.#data?.panes ?? []} />))
    const where = this.querySelector('[data-picker-card] [data-where]')

    if (where) press(where, this.#where)
    this.#fill(this.querySelector('[data-picker-actions]'), html(<PickerActions p={p} />))
  }

  #place(selector: string, x: number, y: number) {
    const mark = this.querySelector<HTMLElement>(selector)

    if (!mark) return
    mark.style.left = at(x)
    mark.style.top = at(y)
  }

  #value(selector: string, value: number) {
    const input = this.querySelector<HTMLInputElement>(selector)

    if (input && document.activeElement !== input && Number(input.value) !== value) input.value = String(value)
  }

  #openSlot(slot: number) {
    const data = this.#data
    const box = this.querySelector<HTMLElement>('[data-picker]')

    if (!data || !box) return
    this.#select('colors')

    if (this.#seeding) this.#keepSeeds()
    const group = this.querySelector(`[data-row="${slot}"]`)?.closest('details')

    if (group?.open === false) group.open = true
    else if (group?.hasAttribute('data-closed'))
      group.querySelector<HTMLElement>(':scope > [data-slot="collapsible-trigger"]')?.click()
    this.#pick(slot)
    this.#render()
    this.#placePicker()
    box.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' })
  }

  #pick(slot: number) {
    const data = this.#data
    const box = this.querySelector<HTMLElement>('[data-picker]')

    if (!data || !box) return
    this.#endDrag(false)
    this.#unqueue(false)
    this.#picker = { slot, keep: lchIn(this.#list(), this.#list()[slot] as Hex).c, hue: null, drag: null }
    this.#settle()
    this.#shown.delete(box)
    fill(box, html(<Picker p={this.#pickerView(slot)} track={hueTrack()} panes={data.panes} />))
    box.hidden = false
  }

  #placePicker() {
    const box = this.querySelector<HTMLElement>('[data-picker]')
    const row = this.#picker ? this.querySelector<HTMLElement>(`[data-row="${this.#picker.slot}"]`) : null

    if (!box || !row) return
    const anchor = row.closest<HTMLElement>('[data-pair]') ?? row
    box.style.top = `${anchor.offsetTop + anchor.offsetHeight + 4}px`
  }

  #close(refocus: boolean) {
    const picker = this.#picker
    const box = this.querySelector<HTMLElement>('[data-picker]')

    if (!picker) return
    this.#endDrag(false)
    this.#unqueue(false)
    this.#picker = null
    this.#settle()

    if (box) {
      box.hidden = true
      box.replaceChildren()
      this.#shown.delete(box)
    }

    this.#render()

    if (refocus) this.querySelector<HTMLElement>(`[data-slot-open="${picker.slot}"]`)?.focus()
  }

  #light() {
    const mock = this.querySelector<HTMLElement>('[data-mock]')

    if (!mock) return

    if (this.#where && this.#picker) mock.dataset.lit = String(this.#picker.slot)
    else delete mock.dataset.lit
  }

  #tail() {
    for (const body of this.querySelectorAll<HTMLElement>('[data-tail]')) body.scrollTop = body.scrollHeight
  }

  #fit() {
    const term = this.querySelector<HTMLElement>('[data-term]')
    const pane = term?.querySelector<HTMLElement>('.mock-pane')

    if (!term || !pane || !this.#data) return
    const style = getComputedStyle(pane)
    const across = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight)
    const down = Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom)
    const cell = Number.parseFloat(style.fontSize) * 0.6
    const line = Number.parseFloat(style.lineHeight)
    const cols = Math.max(LEAST.cols, Math.floor((term.clientWidth - across) / cell))
    const rows = Math.max(LEAST.rows, Math.floor((term.clientHeight - down) / line))
    const grid = `${cols}x${rows}`

    if (grid === this.#grid) return
    this.#grid = grid
    const { panes, uses } = scenePanes(cols, rows)
    this.#panes = new Map(panes.map((one) => [one.name, one]))
    this.#data.uses = uses
    this.#inspector.release()
    this.#drawPane(term.querySelector<HTMLElement>('[data-pane-panel]:not([hidden])')?.dataset.panePanel ?? '')
    term.dataset.sized = ''
    this.#renderPicker()
  }

  #arrive(asked: boolean) {
    const hash = location.hash

    if (!asked && !hash) return
    const url = new URL(location.href)

    url.searchParams.delete(DRAFT_KEY)
    url.hash = ''
    history.replaceState(history.state, '', url)

    if (hash === '#builder-drafts') return this.#select('drafts')

    if (hash !== '#builder-start' && hash !== '#builder-open') return
    requestAnimationFrame(() => {
      this.querySelector<HTMLElement>('#builder-start')?.showPopover()

      if (hash !== '#builder-open') return
      const box = this.querySelector<HTMLDetailsElement>('details[data-open-box]')

      if (box) box.open = true
      this.querySelector<HTMLElement>('[data-open-text]')?.focus({ preventScroll: true })
    })
  }

  #select(panel: string) {
    this.querySelector<HTMLElement>(`[data-panels] [data-value="${panel}"]`)?.click()
  }

  #drawPane(name: string) {
    const pane = this.#panes.get(name)

    if (!pane) return
    this.#panes.delete(name)
    fill(this.querySelector(`[data-pane-panel="${name}"]`), html(<PaneBody pane={pane} />))
    this.#tail()
  }

  #changed = (event: CustomEvent<ValueChange>) => {
    const list = event.target as Element
    const { value } = event.detail

    if (list.matches('[data-edit-modes]')) {
      if (value === 'dark' || value === 'light') this.#setView(value)

      return
    }

    if (list.matches('[data-slot="combobox"]')) {
      const start = this.#starts.state === 'ready' ? this.#starts.starts.find((one) => one.name === value) : undefined

      if (start) this.#startFrom(start, false)
      else event.preventDefault()

      return
    }

    if (list.matches('[data-panes]')) {
      this.#inspector.release()
      this.#drawPane(value)
      requestAnimationFrame(() => this.#tail())

      return
    }

    if (!list.matches('[data-panels]')) return

    if (value === 'drafts') this.#renderDrafts()

    if (value !== 'colors') this.#close(false)
  }

  #pressed = (event: CustomEvent<PressedChange>) => {
    const toggle = event.target as HTMLElement
    const link = toggle.dataset.link

    if (link) return this.#toggleLink(Number(link))

    if (toggle.matches('[data-picker-link]')) {
      const slot = this.#picker?.slot ?? 0

      if (slot < 4) return event.preventDefault()

      return this.#toggleLink(slot >= 12 ? slot : slot + 8)
    }

    if (toggle.matches('[data-where]')) this.#where = event.detail.pressed
    else if (toggle.matches('[data-changed]')) this.#only = event.detail.pressed
    else return

    this.#render()
  }

  #opened = (event: CustomEvent<OpenChange>) => {
    const popup = event.target as Element
    const { open, reason } = event.detail

    if (!open) {
      const row = this.#picker ? this.querySelector(`[data-row="${this.#picker.slot}"]`) : null

      if (row && popup.contains(row)) this.#close(false)

      return
    }

    if (popup.matches('[data-open-box]') && reason === 'trigger-press')
      requestAnimationFrame(() => this.querySelector<HTMLElement>('[data-open-text]')?.focus({ preventScroll: true }))

    if (popup.matches('[data-export]')) this.#renderExport(true)

    if (popup.id !== 'builder-start') return
    this.#loadStarts()
    this.#renderStart()
  }

  #setView(mode: Mode) {
    const view: View = mode === madeMode(this.#state) ? 'made' : 'other'

    if (view === this.#view) return
    this.#view = view
    this.#settle()
    this.#relink()

    if (this.#picker) this.#pick(this.#picker.slot)
    this.#render()
    announce(`editing the ${mode} colors`)
  }

  #undo(back: boolean) {
    const from = back ? this.#history : this.#future
    const to = back ? this.#future : this.#history
    const snapshot = from.pop()

    if (!snapshot) return
    to.push(snapshotOf(this.#state))
    this.#settle()
    this.#edit = { ...this.#state, ...snapshot, at: Date.now() }
    this.#render()
    this.#save()
    announce(back ? 'undone' : 'redone')
  }

  #toggleLink(bright: number) {
    const normal = bright - 8
    const list = this.#list()

    if (this.#linked().has(bright)) {
      this.#unlinked.add(bright)
    } else {
      this.#links.set(bright, offsetOf(lchIn(list, list[normal] as Hex), lchIn(list, list[bright] as Hex)))
      this.#unlinked.delete(bright)
    }

    this.#render()
  }

  #startFrom(start: { name: string; draft: Draft }, own: boolean) {
    this.#flush()
    this.#seeding = null
    this.#edit = editOf(start.draft, start.name, own, freshId(), Date.now())
    this.#reset()
    this.#closeStart()
    announce(`started from ${start.name}`)
  }

  #reset(panel = 'colors') {
    this.#view = 'made'
    this.#history = []
    this.#future = []
    this.#only = false
    this.#unqueue(false)
    this.#settle()
    this.#relink()
    this.#close(false)
    this.#mark()
    this.#select(panel)
    this.#render()
    this.#renderDrafts()
  }

  #startDraft(id: string) {
    if (id === this.#state.id) return this.#select('colors')
    this.#flush()
    const draft = this.#drafts.find((stored) => stored.id === id)

    if (!draft) return
    this.#seeding = null
    this.#edit = { ...draft }
    this.#deleted = null
    this.#reset('drafts')
    announce(`opened ${draft.name}`)
  }

  #startBlank() {
    this.#flush()
    const blank = startBlank(this.#state, this.#seeding, freshId(), Date.now())
    this.#seeding = blank.seeding
    this.#edit = blank.edit
    this.#reset()
    this.#closeStart()
    this.querySelector<HTMLElement>('[data-seed]')?.focus()
  }

  #seed(key: string, value: number) {
    const seeding = this.#seeding
    const next = seeding ? reseeded(this.#state, seeding, key, value, Date.now()) : null

    if (!next) return
    this.#seeding = next.seeding
    this.#edit = next.edit
    this.#render()
    this.#save()
  }

  #keepSeeds() {
    this.#seeding = null
    this.#relink()
    this.#select('colors')
    this.#render()
    this.#save()
  }

  #cancelSeeds() {
    const seeding = this.#seeding

    if (!seeding) return
    const blank = this.#state.id
    window.clearTimeout(this.#owed?.timer)
    this.#owed = null
    this.#seeding = null
    this.#edit = seeding.before
    this.#shelf = shelve((stored) => dropped(stored, blank))
    this.#reset()
  }

  #closeStart() {
    this.querySelector<HTMLElement>('#builder-start')?.hidePopover()
  }

  #loadStarts() {
    if (this.#starts.state === 'loading' || this.#starts.state === 'ready') return
    this.#starts = { state: 'loading' }
    this.#renderStart()
    fetch('/builder/palettes.json')
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status))

        return response.json() as Promise<Start[]>
      })
      .then(
        (starts) => {
          this.#starts = { state: 'ready', starts }
        },
        () => {
          this.#starts = { state: 'failed' }
        },
      )
      .then(() => this.#renderStart())
  }

  #renderStart() {
    const target = this.querySelector('[data-start-list]')
    const starts = this.#starts

    const list: StartList =
      starts.state === 'ready'
        ? { state: 'ready', groups: groupsOf(starts.starts) }
        : { state: starts.state === 'failed' ? 'failed' : 'loading' }

    this.#fill(target, html(<StartEntries list={list} />))
  }

  async #openText(text: string, file?: string) {
    const error = this.querySelector<HTMLElement>('[data-open-error]')

    const say = (message: string) => {
      if (!error) return
      error.hidden = !message
      error.textContent = message
    }

    say('')

    try {
      const code = codeOf(text)

      if (code) {
        await webCheck(code)
        location.assign(encodeURI(`/builder/${code}`))

        return
      }

      const draft = textDraft(file ?? 'the text', text)
      this.#startFrom({ name: draft.name, draft }, true)
    } catch (failure) {
      say(`${file ?? (codeOf(text) ? 'the link' : 'the text')} does not open — ${(failure as Error).message}`)
    }
  }

  #url(key: string, blob: Blob): string {
    const old = this.#urls.get(key)

    if (old) URL.revokeObjectURL(old)
    const url = URL.createObjectURL(blob)
    this.#urls.set(key, url)

    return url
  }

  #renderExport(force = false) {
    const dialog = this.querySelector<HTMLDialogElement>('[data-export]')

    if (!dialog || (!dialog.open && !force)) return
    const file = fileOf(this.#state, this.#drafts)
    this.#fill(this.querySelector('[data-export-panel="toml"]'), html(<FilePanel view={file} />))
    const download = this.querySelector<HTMLAnchorElement>('[data-download-toml]')

    if (download && file.text) {
      download.href = this.#url('toml', new Blob([file.text], { type: 'application/toml' }))
      download.download = file.file
    }

    this.#renderLink()
    this.#renderMarket()
  }

  get #drafts(): Edit[] {
    return draftsOn(this.#shelf)
  }

  #renderLink() {
    const drafts = setDrafts(this.#state, this.#drafts)
    const was = this.#sharing
    const key = JSON.stringify(drafts)
    this.#sharing = drafts ? sharingOf(was, key) : { state: 'idle' }
    this.#drawLink()

    if (!drafts || this.#sharing === was) return
    webCode(drafts).then(
      (code) => this.#share(key, { code }),
      (failure: Error) => this.#share(key, { problem: failure.message }),
    )
  }

  #share(key: string, answer: { code: string } | { problem: string }) {
    const next = shared(this.#sharing, key, answer)

    if (next === this.#sharing) return
    this.#sharing = next
    this.#drawLink()
  }

  #drawLink() {
    const edit = this.#state
    const view = linkOf(this.#sharing, edit.name, exportProblem(edit))
    this.#fill(this.querySelector('[data-export-panel="link"]'), html(<LinkPanel view={view} />))
  }

  #renderMarket() {
    const edit = this.#state
    const { owner, name, description } = this.#market
    const view = marketOf(owner, name)
    const file = fileOf(edit, this.#drafts)
    const problem = view.problem ?? file.problem
    this.#fill(this.querySelector('[data-market-steps]'), html(<MarketSteps view={{ ...view, problem }} />))
    const download = this.querySelector<HTMLAnchorElement>('[data-download-zip]')

    if (!download || problem) return
    const identity = { owner, name }
    const repo = repoFor(identity)

    const bytes = zip(
      [
        { path: `${repo}/ttheme-marketplace.toml`, text: marketplaceToml(identity, description.trim() || undefined) },
        { path: `${repo}/README.md`, text: readmeOf(identity) },
        { path: `${repo}/sets/${file.file}`, text: file.text },
      ],
      new Date(),
    )

    download.href = this.#url('zip', new Blob([bytes.slice()], { type: 'application/zip' }))
    download.download = view.zip
  }

  #dragTo(picker: Picking, drag: Drag) {
    const { at, plane } = drag

    if (!at) return
    drag.at = null
    const box = plane.getBoundingClientRect()
    const x = clamp((at[0] - box.left) / box.width)
    const y = clamp((at[1] - box.top) / box.height)
    const l = PLANE_TOP - y * (PLANE_TOP - PLANE_BOTTOM)
    const { h } = lchIn(this.#list(), this.#list()[picker.slot] as Hex)
    const c = x * reach(l, h)
    picker.keep = c
    this.#set(picker.slot, placed(l, c, h).hex, `plane:${picker.slot}`)
  }

  #press = (event: PointerEvent) => {
    const plane = (event.target as Element | null)?.closest<HTMLElement>('[data-plane]')
    const picker = this.#picker

    if (!plane || !picker || event.button !== 0) return
    event.preventDefault()
    this.#endDrag(false)
    this.#unqueue(true)
    this.#settle()
    const drag: Drag = { plane, pointer: event.pointerId, frame: 0, at: [event.clientX, event.clientY] }
    picker.drag = drag
    plane.setPointerCapture(drag.pointer)
    plane.addEventListener('pointermove', this.#dragged)
    plane.addEventListener('pointerup', this.#lifted)
    plane.addEventListener('pointercancel', this.#lifted)
    plane.addEventListener('lostpointercapture', this.#lifted)
    this.#dragTo(picker, drag)
  }

  #dragged = (event: PointerEvent) => {
    const picker = this.#picker
    const drag = picker?.drag

    if (!picker || !drag || event.pointerId !== drag.pointer) return
    drag.at = [event.clientX, event.clientY]

    if (drag.frame) return
    drag.frame = requestAnimationFrame(() => {
      drag.frame = 0

      if (picker.drag === drag) this.#dragTo(picker, drag)
    })
  }

  #lifted = (event: PointerEvent) => {
    if (event.pointerId !== this.#picker?.drag?.pointer) return
    this.#endDrag(event.type === 'pointerup')
    this.querySelector<HTMLElement>('[data-plane-l]')?.focus({ preventScroll: true })
  }

  #endDrag(landed: boolean) {
    const picker = this.#picker
    const drag = picker?.drag

    if (!picker || !drag) return
    cancelAnimationFrame(drag.frame)

    if (landed) this.#dragTo(picker, drag)
    picker.drag = null
    this.#settle()
    drag.plane.removeEventListener('pointermove', this.#dragged)
    drag.plane.removeEventListener('pointerup', this.#lifted)
    drag.plane.removeEventListener('pointercancel', this.#lifted)
    drag.plane.removeEventListener('lostpointercapture', this.#lifted)

    if (drag.plane.hasPointerCapture(drag.pointer)) drag.plane.releasePointerCapture(drag.pointer)
  }

  #channel(kind: 'l' | 'c' | 'h' | 'contrast', value: number) {
    const picker = this.#picker

    if (!picker) return
    const { slot } = picker
    const list = this.#list()
    const now = lchIn(list, list[slot] as Hex)

    if (kind === 'contrast') {
      const partner = partnerOf(list, slot)
      const against = list[partner.against] as Hex
      const solved = solveLightness(list[slot] as Hex, now, picker.keep, against, ratioAt(value / 1000))
      this.#set(slot, solved.hex, `contrast:${slot}`)

      if (solved.stops !== undefined) announce(`the ratio stops at ${solved.stops.toFixed(2)} to 1 on this side`)

      return
    }

    if (kind === 'c') {
      picker.keep = (value / 100) * reach(now.l, now.h)
      this.#set(slot, placed(now.l, picker.keep, now.h).hex, `c:${slot}`)

      return
    }

    const l = kind === 'l' ? value / 100 : now.l
    const h = kind === 'h' ? value : now.h
    this.#set(slot, placed(l, Math.min(picker.keep, room(l, h)), h).hex, `${kind}:${slot}`)
  }

  #typed(input: HTMLInputElement) {
    const picker = this.#picker
    const color = parseColor(input.value)
    const bad = this.querySelector<HTMLElement>('[data-bad]')

    if (!picker) return
    const { slot } = picker

    if (!color) {
      input.setAttribute('aria-invalid', 'true')

      if (bad) bad.hidden = false

      return
    }

    input.setAttribute('aria-invalid', 'false')

    if (bad) bad.hidden = true
    picker.keep = lchIn(this.#list(), color).c
    this.#set(slot, color, '!typed')
    input.value = this.#pickerView(slot).s.formats[this.#format]
  }

  #rename(value: string) {
    const name = value.trim()

    if (name === this.#state.name) return
    this.#edit = { ...this.#state, name, at: Date.now() }
    this.#renderName()
    this.#renderAbout()
    this.#renderStatus()
    this.#renderExport()
    this.#renderShared()
    this.#save()
  }

  #click = (event: MouseEvent) => {
    const target = event.target as Element | null

    if (!target) return

    if (target.closest('[data-picker-close]')) return this.#close(true)

    const picker = this.#picker

    if (target.closest('[data-picker-back]') && picker) {
      const origin = originIn(this.#state, this.#view)
      const hex = origin[picker.slot] as Hex
      picker.keep = lchIn(origin, hex).c
      this.#set(picker.slot, hex, '!back')

      return
    }

    const opener = target.closest<HTMLElement>('[data-slot-open]')

    if (opener) {
      const slot = Number(opener.dataset.slotOpen)
      const checks = opener.closest<HTMLElement>('#builder-gate')

      if (checks) {
        checks.hidePopover()
        this.#select('colors')
      }

      if (picker?.slot === slot && !opener.closest('[data-inspector]')) return this.#close(true)

      return this.#openSlot(slot)
    }

    const run = target.closest<HTMLElement>('[data-mock] .r')

    if (run) return this.#inspector.pin(run)

    if (target.closest('[data-term]') && !target.closest('[data-inspector]')) return this.#inspector.release()

    if (target.closest('[data-undo]')) return this.#undo(true)

    if (target.closest('[data-redo]')) return this.#undo(false)

    if (target.closest('[data-reset]')) {
      this.#remember('!reset')
      this.#settle()
      this.#commit(resetAll(this.#state))
      this.#relink()
      announce('back to the colors it started from')

      return
    }

    if (target.closest('[data-follow-mirror]')) {
      this.#remember('!mirror')
      this.#settle()
      this.#commit(followMirror(this.#state))
      this.#relink()

      return
    }

    if (target.closest('[data-seeds-keep]')) return this.#keepSeeds()

    if (target.closest('[data-seeds-cancel]')) return this.#cancelSeeds()

    if (target.closest('[data-start-blank]')) return this.#startBlank()
    const gone = target.closest<HTMLElement>('[data-draft-delete]')?.dataset.draftDelete

    if (gone) return this.#deleteDraft(gone)
    const draft = target.closest<HTMLElement>('[data-draft-open]')?.dataset.draftOpen

    if (draft) return this.#startDraft(draft)

    if (target.closest('[data-draft-undo]')) return this.#undoDelete()

    if (target.closest('[data-start-retry]')) return this.#loadStarts()

    if (target.closest('[data-open-go]')) {
      void this.#openText(this.querySelector<HTMLTextAreaElement>('[data-open-text]')?.value ?? '')

      return
    }

    if (target.closest('[data-open-file]')) {
      this.querySelector<HTMLInputElement>('[data-open-input]')?.click()

      return
    }
  }

  #input = (event: Event) => {
    const input = event.target as HTMLInputElement

    if (input.matches('[data-name], [data-about-name]')) return this.#rename(input.value)

    if (input.matches('[data-plane-l]')) return this.#channel('l', Number(input.value))

    if (input.matches('[data-plane-c]')) return this.#channel('c', Number(input.value))

    if (input.matches('[data-hue]')) return this.#schedule(() => this.#channel('h', Number(input.value)))

    if (input.matches('[data-contrast]')) return this.#schedule(() => this.#channel('contrast', Number(input.value)))
    const seed = input.dataset.seed

    if (seed) return this.#schedule(() => this.#seed(seed, Number(input.value)))

    if (input.dataset.meta === 'subject') {
      const value = input.value.trim()
      const { subject: _, ...rest } = this.#state.meta
      this.#edit = { ...this.#state, meta: value ? { ...rest, subject: value } : rest, at: Date.now() }
      this.#renderAbout()
      this.#renderExport()
      this.#renderShared()
      this.#save()

      return
    }

    const market = input.dataset.market

    if (market === 'owner' || market === 'name' || market === 'description') {
      this.#market = {
        ...this.#market,
        [market]: market === 'description' ? input.value : input.value.trim().toLowerCase(),
      }
      this.#renderMarket()

      return
    }

    if (input.matches('[data-draft-search]')) {
      this.#draftQuery = input.value
      this.#renderDrafts()
    }
  }

  #change = (event: Event) => {
    const input = event.target as HTMLInputElement

    if (input.matches('[data-plane-l], [data-plane-c], [data-hue], [data-contrast]')) {
      this.#unqueue(true)

      return this.#settle()
    }

    if (input.matches('[data-value]')) return this.#typed(input)

    if (input.name === 'slot-format') {
      const format = FORMATS.find((name) => name === input.value)

      if (format) this.#format = format
      this.#render()

      return
    }

    if (input.name === 'row-format') {
      this.#rows = input.value === 'oklch' ? 'oklch' : 'hex'
      this.#render()

      return
    }

    if (input.matches('[data-keep-pictures]')) {
      this.#commit({ ...this.#state, keep: input.checked })

      return
    }

    if (input.matches('[data-open-input]')) {
      const file = input.files?.[0]

      if (file) void file.text().then((text) => this.#openText(text, file.name))
      input.value = ''
    }
  }

  #key = (event: KeyboardEvent) => {
    if (composing(event)) return

    if (event.key === 'Escape' && this.#picker && !(event.target as Element | null)?.closest('dialog, [popover]')) {
      event.preventDefault()
      this.#close(true)

      return
    }

    if (event.key === 'Escape' && this.#inspector.pinned) {
      event.preventDefault()
      this.#inspector.release()

      return
    }

    if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'z' && !typing(event.target)) {
      event.preventDefault()
      this.#undo(!event.shiftKey)

      return
    }

    if (event.key === 'Enter' && (event.target as Element | null)?.matches('[data-open-text]') && !event.shiftKey) {
      event.preventDefault()
      void this.#openText((event.target as HTMLTextAreaElement).value)

      return
    }

    if (event.key === 'Enter' && (event.target as Element | null)?.matches('[data-name], [data-about-name]')) {
      ;(event.target as HTMLInputElement).blur()
    }
  }
}

customElements.define('palette-builder', PaletteBuilder)
