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
import { PaneBody } from '@/components/mock-window'
import { TitleDots } from '@/components/workspace-shell'
import {
  type BuilderData,
  blankEdit,
  changedIn,
  changes,
  dirty,
  dropped,
  type Edit,
  editOf,
  followMirror,
  kept,
  listIn,
  madeMode,
  modeOfView,
  nameTrouble,
  originIn,
  RETURNS,
  resetAll,
  restored,
  STORE,
  type Start,
  type Stored,
  storedOf,
  TAB_KEY,
  type View,
  withSlot,
} from '@/lib/builder'
import {
  aboutOf,
  dotsOf,
  draftListOf,
  exportProblem,
  fileOf,
  gateOf,
  type LinkView,
  marketOf,
  modesOf,
  type PickerView,
  pickerOf,
  type RowFormat,
  ratioAt,
  rowsOf,
  type StartGroup,
  type StartList,
  seedRowsOf,
  setDrafts,
  slotVars,
  statusOf,
} from '@/lib/builder-view'
import type { Mode } from '@/lib/mode'
import { html } from '@/lib/render'
import { scenePanes } from '@/lib/scene-panes'
import { hueTrack } from '@/lib/slot-view'
import { BUILTIN } from '@/lib/themes'
import { FORMATS, type Picture, type PictureCredit, type SlotFormat } from '@/lib/view-types'
import { textDraft, webCheck, webCode } from '@/lib/web-code'
import { type Hex, mix, type Oklch } from '../../src/core/color.ts'
import { codeOf, type Draft, shareLink } from '../../src/core/draft.ts'
import { PLANE_BOTTOM, PLANE_TOP, reach } from '../../src/core/plane.ts'
import { marketplaceToml, readmeOf, repoFor } from '../../src/core/scaffold.ts'
import { grow, SEED_FIELDS, SEEDS, type Seeds } from '../../src/core/seeds.ts'
import { FACE, lchIn, listOf, misses, SLOT_NAMES, slotLabel } from '../../src/core/slots.ts'
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
import { placeUnder } from './place'
import { tabKey } from './tabs'

interface Snapshot {
  made: Hex[]
  other: Edit['other']
}

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

function tabDraft(stored: Stored | null): Edit | undefined {
  try {
    const entry = performance.getEntriesByType('navigation')[0]

    if (!(entry instanceof PerformanceNavigationTiming) || !RETURNS.includes(entry.type)) return undefined
    const id = sessionStorage.getItem(TAB_KEY)

    return stored?.drafts.find((draft) => draft.id === id)
  } catch {
    return undefined
  }
}

function groupsOf(starts: Start[], query: string): StartGroup[] {
  const q = query.trim().toLowerCase()
  const hits = starts.filter((start) => !q || start.words.includes(q))

  return [...Map.groupBy(hits, (start) => start.shelf)].map(([, palettes]) => {
    const { work, publisher } = palettes[0] as Start

    return {
      title: work?.name ?? 'originals',
      native: work ? work.native : publisher,
      lang: work?.lang ?? undefined,
      palettes: palettes.map((start) => ({
        name: start.name,
        label: start.name.slice(start.name.indexOf('/') + 1),
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
  #open: number | null = null
  #where = true
  #only = false
  #history: Snapshot[] = []
  #future: Snapshot[] = []
  #last: string | undefined
  #links = new Map<number, Oklch>()
  #unlinked = new Set<number>()
  #keep = 0
  #seeds: Seeds | null = null
  #before: Edit | null = null
  #starts: Start[] | null = null
  #loading: Promise<void> | null = null
  #startFailed = false
  #query = ''
  #draftQuery = ''
  #deleted: { edit: Edit; at: number } | null = null
  #stored: Stored | null = null
  #linkId: string | null = null
  #credits = new Map<string, PictureCredit | null>()
  #saving = 0
  #market = { owner: '', name: '', description: '' }
  #link: { key: string; view: LinkView } | null = null
  #urls = new Map<string, string>()
  #shown = new WeakMap<Element, string>()
  #dragging: 'plane' | null = null
  #frame = 0
  #pending: (() => void) | null = null
  #grid = ''
  #sizer: ResizeObserver | undefined
  #sizing = 0
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
    this.#stored = readStore()
    const link = this.#data.link !== null
    const back = link ? undefined : tabDraft(this.#stored)
    this.#edit = back ?? editOf(this.#data.first.draft, this.#data.first.name, link, freshId(), Date.now())

    if (link) this.#linkId = this.#edit.id
    this.#mark()
    this.#relink()
    this.addEventListener('click', this.#click)
    this.addEventListener('input', this.#input)
    this.addEventListener('change', this.#change)
    this.addEventListener('keydown', this.#key)
    this.addEventListener('pointerdown', this.#press)
    this.addEventListener('toggle', this.#toggled, true)
    this.querySelector('#builder-start')?.addEventListener('beforetoggle', this.#placeStart)
    this.querySelector('#builder-add')?.addEventListener('beforetoggle', this.#placeAdd)
    this.querySelector('#builder-gate')?.addEventListener('beforetoggle', this.#placeGate)
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

    this.#fit()
    this.#render()
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
    this.removeEventListener('toggle', this.#toggled, true)
    removeEventListener('pagehide', this.#flush)
    removeEventListener('storage', this.#synced)
    this.#sizer?.disconnect()
    cancelAnimationFrame(this.#sizing)
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
    window.clearTimeout(this.#saving)
    this.#saving = window.setTimeout(this.#flush, SAVE_MS)
  }

  #flush = () => {
    if (!this.#saving) return
    window.clearTimeout(this.#saving)
    this.#saving = 0
    this.#mark()

    try {
      const stored = storedOf(localStorage.getItem(STORE))
      const next = kept(stored, this.#state)

      if (next !== stored) localStorage.setItem(STORE, JSON.stringify(next))
      this.#stored = next
    } catch {
      this.#stored = null
    }

    this.#renderStatus()
    this.#renderDrafts()
  }

  #mark() {
    try {
      sessionStorage.setItem(TAB_KEY, this.#state.id)
    } catch {}
  }

  #write(next: Stored) {
    try {
      localStorage.setItem(STORE, JSON.stringify(next))
      this.#stored = next
    } catch {
      this.#stored = null
    }
  }

  #synced = (event: StorageEvent) => {
    if (event.key !== STORE) return
    this.#stored = readStore()
    this.#renderStatus()
    this.#renderDrafts()
  }

  #renderDrafts() {
    const drafts = this.#stored?.drafts ?? []
    const list = draftListOf(drafts, this.#state.id, this.#draftQuery, this.#deleted?.edit.name ?? null, Date.now())
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
    const stored = readStore()
    const at = stored?.drafts.findIndex((draft) => draft.id === id) ?? -1
    const edit = stored?.drafts[at]

    if (!stored || !edit || id === this.#state.id) return
    this.#write(dropped(stored, id))
    this.#deleted = { edit, at }
    this.#renderDrafts()
    this.querySelector<HTMLElement>('[data-draft-undo]')?.focus()
    announce(`deleted ${edit.name}`)
  }

  #undoDelete() {
    const gone = this.#deleted
    const stored = readStore()

    if (!gone || !stored) return
    this.#write(restored(stored, gone.at, gone.edit))
    this.#deleted = null
    this.#renderDrafts()
    this.querySelector<HTMLElement>(`[data-draft-open="${gone.edit.id}"]`)?.focus()
    announce(`${gone.edit.name} is back`)
  }

  #schedule(work: () => void) {
    this.#pending = work

    if (this.#frame) return
    this.#frame = requestAnimationFrame(() => {
      this.#frame = 0
      const run = this.#pending
      this.#pending = null
      run?.()
    })
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

    this.#fill(this.querySelector('[data-bar-dots]'), html(<TitleDots dots={dotsOf(list, FACE)} />))
    const edits = changes(edit)
    const shown = this.querySelector<HTMLElement>('[data-changed]')
    this.#fill(this.querySelector('[data-changed-label]'), html(<ChangedLabel count={edits} />))

    if (shown) {
      shown.hidden = edits === 0 && !this.#only
      shown.setAttribute('aria-pressed', String(this.#only))
    }

    this.#enable('[data-undo]', this.#history.length > 0)
    this.#enable('[data-redo]', this.#future.length > 0)
    this.#enable('[data-reset]', edits > 0)
    this.#renderName()

    const rows = rowsOf(list, missed, changed, this.#rows, this.#open, this.#linked(), this.#only)
    this.#fill(this.querySelector('[data-base-rows]'), html(<BaseRows rows={rows.base} />))
    this.#fill(this.querySelector('[data-pair-rows]'), html(<PairRows pairs={rows.pairs} />))
    const empty = this.querySelector<HTMLElement>('[data-rows-empty]')

    if (empty) empty.hidden = !(this.#only && rows.empty)
    this.#fill(this.querySelector('[data-gate-summary]'), html(<GateSummary gate={gate} />))
    const names = this.#named().map((slot) => slot.name)
    this.#fill(this.querySelector('[data-gate-checks]'), html(<GateChecks gate={gate} names={names} />))
    const made = madeMode(edit)
    const editing = modeOfView(edit, this.#view)

    for (const button of this.querySelectorAll<HTMLElement>('[data-edit-mode]')) {
      button.setAttribute('aria-pressed', String(button.dataset.editMode === editing))
      const dot = button.querySelector<HTMLElement>('[data-made-dot]')

      if (dot) dot.hidden = button.dataset.editMode !== made
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
    const saved = this.#stored?.drafts.some((draft) => draft.id === this.#state.id) ?? false
    const status = statusOf(this.#state, this.#stored !== null, saved)
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
    const seeds = this.#seeds
    const colors = this.querySelector<HTMLElement>('[data-panel-body="colors"]')
    const body = this.querySelector<HTMLElement>('[data-panel-body="seeds"]')
    const first = this.querySelector('[data-first-tab]')

    if (first) first.textContent = seeds ? 'seeds' : 'colors'

    if (!seeds) {
      if (body && !body.hidden) {
        body.hidden = true

        if (colors && this.#panel() === 'colors') colors.hidden = false
      }

      return
    }

    if (body) body.hidden = this.#panel() !== 'colors'

    if (colors) colors.hidden = true

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

  #panel(): string {
    return this.querySelector<HTMLElement>('[data-panel][aria-selected="true"]')?.dataset.panel ?? 'colors'
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
    const box = this.querySelector<HTMLElement>('[data-picker]')
    const slot = this.#open

    if (!box || slot === null || box.hidden || !box.firstElementChild) return
    const p = this.#pickerView(slot)
    const { s } = p
    this.#fill(this.querySelector('[data-picker-head]'), html(<PickerHead p={p} />))
    const rows = this.querySelector<HTMLElement>('[data-plane-rows]')

    if (rows?.dataset.hue !== String(s.hue)) {
      if (rows) rows.dataset.hue = String(s.hue)
      this.#fill(rows, html(<PlaneRows s={s} />))
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
    this.querySelector('[data-picker-card] [data-where]')?.setAttribute('aria-pressed', String(this.#where))
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
    this.#showPanel('colors')

    if (this.#seeds) this.#keepSeeds()
    const row = this.querySelector<HTMLElement>(`[data-row="${slot}"]`)
    const group = row?.closest('details')

    if (group && !group.open) group.open = true
    this.#open = slot
    this.#keep = lchIn(this.#list(), this.#list()[slot] as Hex).c
    this.#settle()
    const p = this.#pickerView(slot)
    this.#shown.delete(box)
    fill(box, html(<Picker p={p} track={hueTrack()} panes={data.panes} />))
    box.hidden = false
    this.#render()
    this.#placePicker()
    box.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' })
  }

  #placePicker() {
    const box = this.querySelector<HTMLElement>('[data-picker]')
    const row = this.#open === null ? null : this.querySelector<HTMLElement>(`[data-row="${this.#open}"]`)

    if (!box || !row) return
    const anchor = row.closest<HTMLElement>('[data-pair]') ?? row
    box.style.top = `${anchor.offsetTop + anchor.offsetHeight + 4}px`
  }

  #close(refocus: boolean) {
    const slot = this.#open
    const box = this.querySelector<HTMLElement>('[data-picker]')

    if (slot === null) return
    this.#open = null
    this.#settle()

    if (box) {
      box.hidden = true
      box.replaceChildren()
      this.#shown.delete(box)
    }

    this.#render()

    if (refocus) this.querySelector<HTMLElement>(`[data-slot-open="${slot}"]`)?.focus()
  }

  #light() {
    const mock = this.querySelector<HTMLElement>('[data-mock]')

    if (!mock) return
    const slot = this.#where && this.#open !== null ? String(this.#open) : null

    if (mock.dataset.lit === (slot ?? '')) return
    mock.dataset.lit = slot ?? ''

    for (const run of mock.querySelectorAll<HTMLElement>('.r')) {
      run.toggleAttribute('data-lit', slot !== null && (run.dataset.t === slot || run.dataset.g === slot))
    }

    mock.toggleAttribute('data-where', slot !== null)
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

    for (const one of panes) fill(this.querySelector(`[data-pane-panel="${one.name}"]`), html(<PaneBody pane={one} />))
    this.#data.uses = uses
    this.#inspector.release()
    const mock = this.querySelector<HTMLElement>('[data-mock]')

    if (mock) delete mock.dataset.lit
    term.dataset.sized = ''
    this.#light()
    this.#tail()
    this.#renderPicker()
  }

  #showPanel(name: string) {
    for (const tab of this.querySelectorAll<HTMLElement>('[data-panel]')) {
      const on = tab.dataset.panel === name
      tab.setAttribute('aria-selected', String(on))
      tab.tabIndex = on ? 0 : -1
    }

    const colors = this.querySelector<HTMLElement>('[data-panel-body="colors"]')
    const seeds = this.querySelector<HTMLElement>('[data-panel-body="seeds"]')
    const about = this.querySelector<HTMLElement>('[data-panel-body="about"]')
    const drafts = this.querySelector<HTMLElement>('[data-panel-body="drafts"]')

    if (about) about.hidden = name !== 'about'

    if (drafts) drafts.hidden = name !== 'drafts'

    if (name === 'drafts') this.#renderDrafts()

    if (colors) colors.hidden = name !== 'colors' || this.#seeds !== null

    if (seeds) seeds.hidden = name !== 'colors' || this.#seeds === null

    if (name !== 'colors' && this.#open !== null) this.#close(false)
  }

  #showPane(name: string) {
    for (const tab of this.querySelectorAll<HTMLElement>('[data-pane]')) {
      const on = tab.dataset.pane === name
      tab.setAttribute('aria-selected', String(on))
      tab.tabIndex = on ? 0 : -1
    }

    for (const panel of this.querySelectorAll<HTMLElement>('[data-pane-panel]')) {
      panel.hidden = panel.dataset.panePanel !== name
    }

    this.#inspector.release()
    this.#tail()
  }

  #setView(mode: Mode) {
    const view: View = mode === madeMode(this.#state) ? 'made' : 'other'

    if (view === this.#view) return
    this.#view = view
    this.#settle()
    this.#relink()

    if (this.#open !== null) {
      const box = this.querySelector<HTMLElement>('[data-picker]')
      this.#keep = lchIn(this.#list(), this.#list()[this.#open] as Hex).c

      if (box && this.#data) {
        this.#shown.delete(box)
        fill(box, html(<Picker p={this.#pickerView(this.#open)} track={hueTrack()} panes={this.#data.panes} />))
      }
    }

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
    this.#leaveSeeds(false)
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
    this.#settle()
    this.#relink()
    this.#close(false)
    this.#mark()
    this.#showPanel(panel)
    this.#render()
    this.#renderDrafts()
  }

  #startDraft(id: string) {
    if (id === this.#state.id) return this.#showPanel('colors')
    this.#flush()
    const draft = this.#stored?.drafts.find((stored) => stored.id === id)

    if (!draft) return
    this.#leaveSeeds(false)
    this.#edit = { ...draft }
    this.#deleted = null
    this.#reset('drafts')
    announce(`opened ${draft.name}`)
  }

  #startBlank() {
    this.#flush()
    this.#leaveSeeds(false)
    this.#before = this.#state
    this.#seeds = { ...SEEDS }
    this.#edit = blankEdit(listOf(grow(this.#seeds)), freshId(), Date.now())
    this.#reset()
    this.#closeStart()
    this.querySelector<HTMLElement>('[data-seed]')?.focus()
  }

  #seed(key: string, value: number) {
    const seeds = this.#seeds
    const field = SEED_FIELDS.find((one) => one.key === key)

    if (!seeds || !field || Number.isNaN(value)) return
    this.#seeds = { ...seeds, [field.key]: clamp(value, field.min, field.max) }
    const made = listOf(grow(this.#seeds))
    const edit = this.#state
    this.#edit = { ...edit, made, origin: { made: [...made], other: edit.origin.other }, at: Date.now() }
    this.#render()
  }

  #keepSeeds() {
    this.#seeds = null
    this.#before = null
    this.#relink()
    this.#showPanel('colors')
    this.#render()
    this.#save()
  }

  #leaveSeeds(back: boolean) {
    if (!this.#seeds) return
    this.#seeds = null

    if (back && this.#before) this.#edit = this.#before
    this.#before = null
  }

  #closeStart() {
    this.querySelector<HTMLElement>('#builder-start')?.hidePopover()
  }

  #placeAdd = (event: Event) => {
    const pop = event.target as HTMLElement
    const button = this.querySelector('[data-add]')

    if ((event as ToggleEvent).newState === 'open' && button) placeUnder(pop, button, 'right')
  }

  #placeGate = (event: Event) => {
    const pop = event.target as HTMLElement
    const button = this.querySelector('[popovertarget="builder-gate"]')

    if ((event as ToggleEvent).newState === 'open' && button) placeUnder(pop, button, 'left')
  }

  #placeStart = (event: Event) => {
    const pop = event.target as HTMLElement
    const button = this.querySelector('[data-start]')

    if ((event as ToggleEvent).newState !== 'open' || !button) return
    placeUnder(pop, button, 'left')
    void this.#loadStarts()
    this.#renderStart()
  }

  async #loadStarts() {
    if (this.#starts || this.#loading) return
    this.#startFailed = false

    this.#loading = (async () => {
      try {
        const response = await fetch('/builder/palettes.json')

        if (!response.ok) throw new Error(String(response.status))
        this.#starts = (await response.json()) as Start[]
      } catch {
        this.#startFailed = true
      } finally {
        this.#loading = null
        this.#renderStart()
      }
    })()
  }

  #renderStart() {
    const target = this.querySelector('[data-start-list]')

    const list: StartList = this.#startFailed
      ? { state: 'failed' }
      : !this.#starts
        ? { state: 'loading' }
        : { state: 'ready', query: this.#query, groups: groupsOf(this.#starts, this.#query) }

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

  #openExport() {
    const dialog = this.querySelector<HTMLDialogElement>('[data-export]')

    if (!dialog) return
    const add = this.querySelector<HTMLElement>('#builder-add')

    if (add?.matches(':popover-open')) add.hidePopover()
    this.#renderExport(true)
    dialog.showModal()
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

    void this.#renderLink()
    this.#renderMarket()
  }

  get #drafts(): Edit[] {
    return this.#stored?.drafts ?? []
  }

  async #renderLink() {
    const edit = this.#state
    const problem = exportProblem(edit)
    const drafts = setDrafts(edit, this.#drafts)
    const key = JSON.stringify(drafts)
    const panel = this.querySelector('[data-export-panel="link"]')

    if (problem) {
      this.#link = null
      this.#fill(panel, html(<LinkPanel view={{ name: edit.name, link: null, code: null, failed: problem }} />))

      return
    }

    if (this.#link?.key === key) {
      this.#fill(panel, html(<LinkPanel view={{ ...this.#link.view, name: edit.name }} />))

      return
    }

    this.#fill(panel, html(<LinkPanel view={{ name: edit.name, link: null, code: null, failed: null }} />))

    try {
      const code = await webCode(drafts as Draft[])

      if (key !== JSON.stringify(setDrafts(this.#state, this.#drafts))) return
      this.#link = { key, view: { name: edit.name, link: shareLink(code), code, failed: null } }
    } catch (failure) {
      this.#link = { key, view: { name: edit.name, link: null, code: null, failed: (failure as Error).message } }
    }

    this.#fill(this.querySelector('[data-export-panel="link"]'), html(<LinkPanel view={this.#link.view} />))
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

  #showExportTab(name: string) {
    for (const tab of this.querySelectorAll<HTMLElement>('[data-export-tab]')) {
      const on = tab.dataset.exportTab === name
      tab.setAttribute('aria-selected', String(on))
      tab.tabIndex = on ? 0 : -1
    }

    for (const panel of this.querySelectorAll<HTMLElement>('[data-export-panel]')) {
      panel.hidden = panel.dataset.exportPanel !== name
    }
  }

  #planeAt(event: PointerEvent) {
    const plane = this.querySelector<HTMLElement>('[data-plane]')
    const slot = this.#open

    if (!plane || slot === null) return
    const box = plane.getBoundingClientRect()
    const x = clamp((event.clientX - box.left) / box.width)
    const y = clamp((event.clientY - box.top) / box.height)
    const l = PLANE_TOP - y * (PLANE_TOP - PLANE_BOTTOM)
    const { h } = lchIn(this.#list(), this.#list()[slot] as Hex)
    const c = x * reach(l, h)
    this.#keep = c
    this.#set(slot, placed(l, c, h).hex, `plane:${slot}`)
  }

  #press = (event: PointerEvent) => {
    const plane = (event.target as Element | null)?.closest<HTMLElement>('[data-plane]')

    if (!plane || event.button !== 0) return
    event.preventDefault()
    plane.setPointerCapture(event.pointerId)
    this.#dragging = 'plane'
    this.#settle()
    this.#planeAt(event)

    const move = (next: PointerEvent) => {
      if (this.#dragging === 'plane') this.#schedule(() => this.#planeAt(next))
    }

    const end = () => {
      this.#dragging = null
      this.#settle()
      plane.removeEventListener('pointermove', move)
      plane.removeEventListener('pointerup', end)
      plane.removeEventListener('pointercancel', end)
      this.querySelector<HTMLElement>('[data-plane-l]')?.focus({ preventScroll: true })
    }

    plane.addEventListener('pointermove', move)
    plane.addEventListener('pointerup', end)
    plane.addEventListener('pointercancel', end)
  }

  #channel(kind: 'l' | 'c' | 'h' | 'contrast', value: number) {
    const slot = this.#open

    if (slot === null) return
    const list = this.#list()
    const now = lchIn(list, list[slot] as Hex)

    if (kind === 'contrast') {
      const partner = partnerOf(list, slot)
      const against = list[partner.against] as Hex
      const solved = solveLightness(list[slot] as Hex, now, this.#keep, against, ratioAt(value / 1000))
      this.#set(slot, solved.hex, `contrast:${slot}`)

      if (solved.stops !== undefined) announce(`the ratio stops at ${solved.stops.toFixed(2)} to 1 on this side`)

      return
    }

    if (kind === 'c') {
      this.#keep = (value / 100) * reach(now.l, now.h)
      this.#set(slot, placed(now.l, this.#keep, now.h).hex, `c:${slot}`)

      return
    }

    const l = kind === 'l' ? value / 100 : now.l
    const h = kind === 'h' ? value : now.h
    this.#set(slot, placed(l, Math.min(this.#keep, room(l, h)), h).hex, `${kind}:${slot}`)
  }

  #typed(input: HTMLInputElement) {
    const slot = this.#open
    const color = parseColor(input.value)
    const bad = this.querySelector<HTMLElement>('[data-bad]')

    if (slot === null) return

    if (!color) {
      input.setAttribute('aria-invalid', 'true')

      if (bad) bad.hidden = false

      return
    }

    input.setAttribute('aria-invalid', 'false')

    if (bad) bad.hidden = true
    this.#keep = lchIn(this.#list(), color).c
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
    const panel = target.closest<HTMLElement>('[data-panel]')?.dataset.panel

    if (panel) return this.#showPanel(panel)
    const pane = target.closest<HTMLElement>('[data-pane]')?.dataset.pane

    if (pane) return this.#showPane(pane)
    const mode = target.closest<HTMLElement>('[data-edit-mode]')?.dataset.editMode

    if (mode === 'dark' || mode === 'light') return this.#setView(mode)

    if (target.closest('[data-picker-close]')) return this.#close(true)

    if (target.closest('[data-where]')) {
      this.#where = !this.#where
      this.#render()

      return
    }

    const link = target.closest<HTMLElement>('[data-link]')?.dataset.link

    if (link) return this.#toggleLink(Number(link))

    if (target.closest('[data-picker-link]') && this.#open !== null && this.#open >= 4) {
      return this.#toggleLink(this.#open >= 12 ? this.#open : this.#open + 8)
    }

    if (target.closest('[data-picker-back]') && this.#open !== null) {
      const origin = originIn(this.#state, this.#view)
      const hex = origin[this.#open] as Hex
      this.#keep = lchIn(origin, hex).c
      this.#set(this.#open, hex, '!back')

      return
    }

    const opener = target.closest<HTMLElement>('[data-slot-open]')

    if (opener) {
      const slot = Number(opener.dataset.slotOpen)
      const checks = opener.closest<HTMLElement>('#builder-gate')

      if (checks) {
        checks.hidePopover()
        this.#showPanel('colors')
      }

      if (this.#open === slot && !opener.closest('[data-inspector]')) return this.#close(true)

      return this.#openSlot(slot)
    }

    const run = target.closest<HTMLElement>('[data-mock] .r')

    if (run) return this.#inspector.pin(run)

    if (target.closest('[data-term]') && !target.closest('[data-inspector]')) return this.#inspector.release()

    if (target.closest('[data-changed]')) {
      this.#only = !this.#only
      this.#render()

      return
    }

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

    if (target.closest('[data-export-open]')) return this.#openExport()
    const tab = target.closest<HTMLElement>('[data-export-tab]')?.dataset.exportTab

    if (tab) return this.#showExportTab(tab)

    if (target.closest('[data-seeds-keep]')) return this.#keepSeeds()

    if (target.closest('[data-seeds-cancel]')) {
      this.#leaveSeeds(true)
      this.#reset()

      return
    }

    if (target.closest('[data-start-blank]')) return this.#startBlank()
    const from = target.closest<HTMLElement>('[data-start-from]')?.dataset.startFrom
    const start = from ? this.#starts?.find((one) => one.name === from) : undefined

    if (start) return this.#startFrom(start, false)
    const gone = target.closest<HTMLElement>('[data-draft-delete]')?.dataset.draftDelete

    if (gone) return this.#deleteDraft(gone)
    const draft = target.closest<HTMLElement>('[data-draft-open]')?.dataset.draftOpen

    if (draft) return this.#startDraft(draft)

    if (target.closest('[data-draft-undo]')) return this.#undoDelete()

    if (target.closest('[data-start-retry]')) {
      this.#startFailed = false
      this.#renderStart()
      void this.#loadStarts()

      return
    }

    const opening = target.closest<HTMLElement>('[data-start-open]')

    if (opening) {
      const box = this.querySelector<HTMLElement>('[data-open-box]')

      if (box) {
        box.hidden = !box.hidden
        opening.setAttribute('aria-expanded', String(!box.hidden))

        if (!box.hidden) this.querySelector<HTMLElement>('[data-open-text]')?.focus()
      }

      return
    }

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

    if (input.matches('[data-start-search]')) {
      this.#query = input.value
      this.#renderStart()

      return
    }

    if (input.matches('[data-draft-search]')) {
      this.#draftQuery = input.value
      this.#renderDrafts()
    }
  }

  #change = (event: Event) => {
    const input = event.target as HTMLInputElement

    if (input.matches('[data-plane-l], [data-plane-c], [data-hue], [data-contrast]')) return this.#settle()

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

  #toggled = (event: Event) => {
    const group = event.target

    if (!(group instanceof HTMLDetailsElement) || this.#open === null) return
    const row = this.querySelector(`[data-row="${this.#open}"]`)

    if (!group.open && row && group.contains(row)) this.#close(false)
    else this.#placePicker()
  }

  #key = (event: KeyboardEvent) => {
    if (composing(event)) return

    if (
      event.key === 'Escape' &&
      this.#open !== null &&
      !(event.target as Element | null)?.closest('dialog, [popover]')
    ) {
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

      return
    }

    tabKey(event, (tab) => {
      tab.focus()
      tab.click()
    })
  }
}

customElements.define('palette-builder', PaletteBuilder)
