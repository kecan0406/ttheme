import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { deltaE } from './delta.ts'

interface Colors {
  background: string
  foreground: string
  cursor: string
  selection_background: string
  ansi: string[]
}

interface ThemeDoc {
  meta: { name: string; group: string; ansi_source: string; signature: string[] }
  colors: Colors
}

type Measured = [string, string]

interface Anchor {
  slots: Record<string, Measured>
  unused: Measured[]
  source: string
  note: string
}

interface Variant {
  label: string
  colors: Colors
  signature: string[]
}

interface Theme {
  name: string
  group: string
  source: string
  signature: string[]
  colors: Colors
  anchor: Anchor | undefined
  art: string | undefined
}

interface Group {
  slug: string
  name: string
  themes: string[]
}

interface Choice {
  name: string
  keys: string[]
  labels: Record<string, string>
  sides: Record<string, string>
  art: boolean
  note: string
}

interface ClientData {
  groups: Group[]
  choices: Choice[]
}

interface PickDoc {
  variant: string
  against: string[]
  at: number
}

interface SignoffDoc {
  at: number
  note: string
}

interface Snapshot {
  docs: { id: string; data(): unknown }[]
}

interface Store {
  doc(path: string): { set(body: Record<string, unknown>): Promise<void> }
  collection(path: string): {
    onSnapshot(next: (snap: Snapshot) => void, error: (e: unknown) => void): () => void
  }
}

interface Runtime {
  use(name: string): Promise<unknown>
}

const HEX = /^#[0-9a-f]{6}$/i
const SLOT = /^(background|foreground|cursor|selection|ansi([0-9]|1[0-5]))$/
const NAME = /^[a-z0-9][a-z0-9_-]*$/
const KEY = /^[A-Za-z0-9_-]{1,24}$/
const LIMIT = 4 * 1024 * 1024
const THUMB = 360
const GOOD = 5
const BAD = 15
const TEXT = 4.5
const USAGE =
  'usage: bun board.ts --anchors <anchors.json> --out <board.html> [--variants <variants.json>] ' +
  '[--art <theme>=<image> ...] [--title "<Series> palettes"] <theme.toml> [...]'

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)

const grade = (d: number) => (d <= GOOD ? 'good' : d >= BAD ? 'bad' : 'mid')

const slug = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'series'

function color(value: unknown, where: string): string {
  if (typeof value !== 'string' || !HEX.test(value)) throw new Error(`${where}: not a #rrggbb color: ${String(value)}`)
  return value.toLowerCase()
}

function slots(list: unknown, where: string): string[] {
  if (!Array.isArray(list) || list.some((s) => typeof s !== 'string' || !SLOT.test(s)))
    throw new Error(`${where}: signature must list slots (background, foreground, cursor, selection, ansi0-15)`)
  return list as string[]
}

function colorsOf(raw: Partial<Colors> | undefined, where: string): Colors {
  if (!raw || !Array.isArray(raw.ansi) || raw.ansi.length !== 16) throw new Error(`${where}: ansi needs 16 colors`)
  return {
    background: color(raw.background, `${where}.background`),
    foreground: color(raw.foreground, `${where}.foreground`),
    cursor: color(raw.cursor, `${where}.cursor`),
    selection_background: color(raw.selection_background, `${where}.selection_background`),
    ansi: raw.ansi.map((c, i) => color(c, `${where}.ansi[${i}]`)),
  }
}

function slotColor(c: Colors, slot: string): string {
  if (slot === 'selection') return c.selection_background
  if (slot === 'background' || slot === 'foreground' || slot === 'cursor') return c[slot]
  const value = c.ansi[Number(slot.slice(4))]
  if (value === undefined) throw new Error(`unknown slot ${slot}`)
  return value
}

const channel = (v: number) => {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16)
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}

function contrast(a: string, b: string): number {
  const x = luminance(a)
  const y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

const ratio = (x: number) => `${x.toFixed(1)}:1`

function pairUp(from: string[], to: string[]): number[] {
  let best: number[] = []
  let least = Number.POSITIVE_INFINITY
  const walk = (at: number[], cost: number) => {
    if (cost >= least) return
    const i = at.length
    if (i === from.length) {
      least = cost
      best = at
      return
    }
    const free = to.map((_, j) => j).filter((j) => !at.includes(j))
    if (from.length - i > free.length) walk([...at, -1], cost)
    for (const j of free) walk([...at, j], cost + deltaE(from[i] as string, to[j] as string))
  }
  walk([], 0)
  return best
}

function readAnchors(raw: Record<string, unknown>): Record<string, Anchor> {
  const out: Record<string, Anchor> = {}
  for (const [name, value] of Object.entries(raw)) {
    const a = value as Partial<{ slots: Record<string, unknown>; unused: unknown[]; source: string; note: string }>
    const pair = (p: unknown, where: string): Measured => {
      if (!Array.isArray(p) || typeof p[0] !== 'string') throw new Error(`${where}: expected ["<part>", "#hex"]`)
      return [p[0], color(p[1], where)]
    }
    const measured: Record<string, Measured> = {}
    for (const [slot, p] of Object.entries(a.slots ?? {})) {
      if (!SLOT.test(slot)) throw new Error(`anchors.${name}: unknown slot ${slot}`)
      measured[slot] = pair(p, `anchors.${name}.slots.${slot}`)
    }
    out[name] = {
      slots: measured,
      unused: (a.unused ?? []).map((p, i) => pair(p, `anchors.${name}.unused[${i}]`)),
      source: typeof a.source === 'string' ? a.source : '',
      note: typeof a.note === 'string' ? a.note : '',
    }
  }
  return out
}

async function readTheme(file: string, anchors: Record<string, Anchor>): Promise<Theme> {
  const doc = Bun.TOML.parse(await Bun.file(file).text()) as unknown as Partial<ThemeDoc>
  const meta = doc.meta
  if (!meta || typeof meta.name !== 'string' || !NAME.test(meta.name)) throw new Error(`${file}: meta.name missing`)
  return {
    name: meta.name,
    group: typeof meta.group === 'string' ? meta.group : 'Ungrouped',
    source: typeof meta.ansi_source === 'string' ? meta.ansi_source : '',
    signature: slots(meta.signature, `${file}: meta.signature`),
    colors: colorsOf(doc.colors, `${file}: colors`),
    anchor: anchors[meta.name],
    art: undefined,
  }
}

function readVariants(raw: Record<string, unknown>, themes: Theme[]): Record<string, Record<string, Variant>> {
  const out: Record<string, Record<string, Variant>> = {}
  for (const [name, set] of Object.entries(raw)) {
    if (!NAME.test(name)) throw new Error(`variants: bad theme name ${name}`)
    const fallback = themes.find((t) => t.name === name)?.signature
    const entries: Record<string, Variant> = {}
    for (const [key, value] of Object.entries(set as Record<string, unknown>)) {
      if (!KEY.test(key) || key === 'none') throw new Error(`variants.${name}: bad key ${key}`)
      const v = value as Partial<{ label: string; colors: Colors; signature: unknown }>
      const signature = v.signature === undefined ? fallback : slots(v.signature, `variants.${name}.${key}`)
      if (!signature) throw new Error(`variants.${name}.${key}: no signature and no theme file to take it from`)
      entries[key] = {
        label: typeof v.label === 'string' ? v.label : key,
        colors: colorsOf(v.colors, `variants.${name}.${key}.colors`),
        signature,
      }
    }
    out[name] = entries
  }
  return out
}

function run(cmd: string[]): string {
  const r = Bun.spawnSync(cmd)
  if (r.exitCode !== 0) throw new Error(`${cmd.join(' ')}: ${r.stderr.toString().trim()}`)
  return r.stdout.toString()
}

async function thumbnail(path: string, dir: string, index: number): Promise<string> {
  if (!(await Bun.file(path).exists())) throw new Error(`--art: no such file ${path}`)
  const alpha = run(['sips', '-g', 'hasAlpha', path]).includes('hasAlpha: yes')
  const out = join(dir, `${index}.${alpha ? 'png' : 'jpg'}`)
  const format = alpha ? ['-s', 'format', 'png'] : ['-s', 'format', 'jpeg', '-s', 'formatOptions', '82']
  run(['sips', '-Z', String(THUMB), ...format, path, '--out', out])
  const bytes = Buffer.from(await Bun.file(out).arrayBuffer()).toString('base64')
  return `data:image/${alpha ? 'png' : 'jpeg'};base64,${bytes}`
}

function mark(c: Colors, slot: string): string {
  const hex = slotColor(c, slot)
  return slot === 'selection'
    ? `<b style="background:${hex};color:${c.foreground}" title="selection ${hex}">sel</b>`
    : `<i style="background:${hex}" title="${slot} ${hex}"></i>`
}

function card(c: Colors, signature: string[], name: string): string {
  const marks = signature.map((s) => mark(c, s)).join('')
  return `<div class="card" style="background:${c.background};color:${c.foreground}"><span>${esc(name)}</span><span class="dots">${marks}</span></div>`
}

function term(c: Colors, name: string): string {
  const a = c.ansi
  const paint = (i: number, text: string) => `<span style="color:${a[i]}">${text}</span>`
  const prompt = `${paint(4, `~/${esc(name)}`)} ${paint(5, '(main)')} $`
  return [
    `<div class="term" style="background:${c.background};color:${c.foreground}">`,
    `<div>${prompt} ls</div>`,
    `<div>${paint(4, 'src/')}&nbsp; ${paint(2, 'build.sh')}&nbsp; ${paint(6, 'docs@')}&nbsp; README.md</div>`,
    `<div>${prompt} git status</div>`,
    `<div>&nbsp;&nbsp;${paint(1, 'modified: src/tone.ts')}</div>`,
    `<div>&nbsp;&nbsp;${paint(2, 'new file: src/anchor.ts')}</div>`,
    `<div>${paint(3, 'warn:')} ${paint(8, 'chroma floor 32')}</div>`,
    `<div>${paint(1, 'error:')} identity lost ${paint(6, 'info')}</div>`,
    `<div><span class="sel" style="background:${c.selection_background}">selected text</span> $ <span class="cur" style="background:${c.cursor}"></span></div>`,
    `<div class="strip">${a.map((x, i) => `<i style="background:${x}" title="ansi${i} ${x}"></i>`).join('')}</div>`,
    '</div>',
  ].join('')
}

const swatch = (hex: string) => `<i class="sw" style="background:${hex}" title="${hex}"></i>`

function frame(c: Colors, slot: string, small = false): string {
  const hex = slotColor(c, slot)
  const inner =
    slot === 'selection'
      ? `<i style="background:${hex};color:${c.foreground}">sel</i>`
      : `<i style="background:${hex}"></i>`
  return `<span class="frame${slot === 'selection' ? ' chip' : ''}${small ? ' small' : ''}" style="background:${c.background}" title="${slot} ${hex}">${inner}</span>`
}

function measured(t: Theme): string {
  const a = t.anchor
  if (!a) return '<p class="muted small">앵커 파일에 이 캐릭터의 실측값이 없습니다.</p>'
  const row = (part: string, hex: string, slot: string, off: boolean) =>
    `<li${off ? ' class="off"' : ''}>${swatch(hex)}<span class="txt"><span>${esc(part)}</span><small class="mono">${hex}</small></span><span class="slot mono">${esc(slot)}</span></li>`
  const used = Object.entries(a.slots).map(([slot, [part, hex]]) => row(part, hex, slot, false))
  const spare = a.unused.map(([part, hex]) => row(part, hex, '안 씀', true))
  return `<ul class="anchors">${[...used, ...spare].join('')}</ul>`
}

function departures(
  t: Theme,
): { slot: string; outside: boolean; anchor: Measured | undefined; de: number | undefined }[] {
  const extra = Object.keys(t.anchor?.slots ?? {}).filter((s) => !t.signature.includes(s))
  return [...t.signature, ...extra].map((slot) => {
    const anchor = t.anchor?.slots[slot]
    return {
      slot,
      outside: !t.signature.includes(slot),
      anchor,
      de: anchor ? deltaE(anchor[1], slotColor(t.colors, slot)) : undefined,
    }
  })
}

function departure(t: Theme): string {
  const rows = departures(t).map((d) => {
    const from = d.anchor
      ? `<div class="pick">${swatch(d.anchor[1])}<span>${esc(d.anchor[0])}<small>${d.anchor[1]}</small></span></div>`
      : '<span class="muted">실측 없음</span>'
    const to = `<div class="final">${frame(t.colors, d.slot)}<span class="mono">${slotColor(t.colors, d.slot)}</span></div>`
    const de =
      d.de === undefined ? '<span class="muted">—</span>' : `<span class="de ${grade(d.de)}">${d.de.toFixed(1)}</span>`
    const out = d.outside ? '<small class="out">시그니처 밖</small>' : ''
    return `<tr><th scope="row"><span class="mono">${d.slot}</span>${out}</th><td>${from}</td><td class="arrow" aria-hidden="true">→</td><td>${to}</td><td>${de}</td></tr>`
  })
  return `<div class="scroll"><table class="dep"><thead><tr><th>슬롯</th><th>실측</th><th></th><th>최종</th><th>ΔE2000</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`
}

function themeSection(t: Theme): string {
  const flagged = departures(t).filter((d) => d.de !== undefined && d.de >= BAD).length
  const flag = flagged ? `<span class="flag">ΔE ${BAD}+ ${flagged}곳</span>` : ''
  const origin = t.anchor?.source ? ` · 실측 출처 ${esc(t.anchor.source)}` : ''
  const note = t.anchor?.note ? `<p class="note"><b>메모</b> ${esc(t.anchor.note)}</p>` : ''
  const art = t.art
    ? `<figure class="art"><img id="art-${t.name}" src="${t.art}" alt="${esc(t.name)} 원화"></figure>`
    : ''
  return `<section class="panel theme" id="t-${t.name}">
<div class="d-head"><span class="d-label">${esc(t.group)}</span><h2>${esc(t.name)}${flag}</h2><p>ANSI ${esc(t.source)}${origin}</p></div>
${note}
<div class="t-body${t.art ? '' : ' no-art'}">${art}<div class="block"><h3>실측 앵커</h3>${measured(t)}</div><div class="block preview"><h3>팔레트</h3>${card(t.colors, t.signature, t.name)}${term(t.colors, t.name)}</div></div>
<div class="block"><h3>실측 → 최종</h3>${departure(t)}</div>
</section>`
}

function side(name: string, v: Variant, anchor: Anchor | undefined): string {
  const c = v.colors
  const text = v.signature.filter((s) => s.startsWith('ansi')).map((s) => contrast(slotColor(c, s), c.background))
  const low = text.length ? Math.min(...text) : undefined
  const facts = [
    `<span>커서 <span class="mono">${ratio(contrast(c.cursor, c.background))}</span></span>`,
    `<span>선택 위 글자 <span class="mono">${ratio(contrast(c.foreground, c.selection_background))}</span></span>`,
    low === undefined
      ? ''
      : `<span>대표 글자색 최저 <span class="mono${low < TEXT ? ' low' : ''}">${ratio(low)}</span></span>`,
  ].join('')
  const parts = Object.values(anchor?.slots ?? {})
  const shown = v.signature.map((s) => slotColor(c, s))
  const pairs = pairUp(
    parts.map(([, hex]) => hex),
    shown,
  )
  const rows = parts.map(([part, hex], i) => {
    const j = pairs[i] ?? -1
    const slot = v.signature[j]
    if (j < 0 || slot === undefined)
      return `<div class="pair">${swatch(hex)}<span class="arrow">→</span><span class="muted">짝 없음</span><span class="part">${esc(part)}</span></div>`
    const d = deltaE(hex, shown[j] as string)
    return `<div class="pair">${swatch(hex)}<span class="arrow">→</span>${frame(c, slot, true)}<span class="part">${esc(part)} <span class="mono muted">${slot}</span></span><span class="de ${grade(d)}">${d.toFixed(1)}</span></div>`
  })
  const fidelity = rows.length
    ? `<div class="pairs"><span class="muted small">실측 → 이 안의 대표색 (ΔE2000)</span>${rows.join('')}</div>`
    : ''
  return `${card(c, v.signature, name)}${term(c, name)}<div class="facts">${facts}</div>${fidelity}`
}

function client(data: ClientData): void {
  const state: { picks: Record<string, PickDoc>; signoff: Record<string, SignoffDoc> } = { picks: {}, signoff: {} }
  const views: Record<string, { left: string; right: string }> = {}
  const dirty = new Set<string>()
  const queues = new Map<string, Promise<void>>()
  let who = data.choices[0]?.name ?? ''
  let store: Store | null = null

  const el = (id: string) => document.getElementById(id)
  const esc = (s: string) =>
    s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)
  const setSave = (text: string) => {
    const node = el('save-state')
    if (node) node.textContent = text
  }
  const when = (at: number) => new Date(at).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })
  const same = (a: string[] | undefined, b: string[]) => !!a && [...a].sort().join('|') === [...b].sort().join('|')

  const write = (path: string, body: Record<string, unknown>) => {
    const db = store
    if (!db) return
    const prev = queues.get(path) ?? Promise.resolve()
    queues.set(
      path,
      prev.then(async () => {
        setSave('저장 중…')
        try {
          await db.doc(path).set(body)
          setSave('저장됨')
        } catch (e) {
          const code = (e as { code?: string } | null)?.code
          setSave(code === 'invalid_argument' ? '이 보기에서는 저장할 수 없습니다' : '저장 실패 — 다시 눌러 주세요')
        }
      }),
    )
  }

  const viewOf = (c: Choice) => {
    const known = views[c.name]
    if (known) return known
    const saved = state.picks[c.name]?.against
    const fresh =
      saved && saved.length === 2 && saved.every((k) => c.keys.includes(k))
        ? { left: saved[0] as string, right: saved[1] as string }
        : { left: c.keys[0] ?? '', right: c.keys[1] ?? c.keys[0] ?? '' }
    views[c.name] = fresh
    return fresh
  }

  const renderPick = () => {
    const tabs = el('pick-tabs')
    const sides = el('pick-sides')
    const votes = el('pick-votes')
    const tally = el('pick-tally')
    const ref = el('pick-ref')
    const c = data.choices.find((x) => x.name === who)
    if (!tabs || !sides || !votes || !tally || !ref || !c) return
    tabs.innerHTML = data.choices
      .map((x) => {
        const p = state.picks[x.name]?.variant
        const done = p ? `<span class="done">${p === 'none' ? '×' : esc(p)}</span>` : ''
        return `<button type="button" class="tab" role="tab" data-who="${x.name}" aria-selected="${x.name === who}">${esc(x.name)}${done}</button>`
      })
      .join('')
    const art = c.art ? (el(`art-${c.name}`) as HTMLImageElement | null)?.src : undefined
    ref.innerHTML =
      (art ? `<img src="${art}" alt="${esc(c.name)} 원화">` : '') +
      (c.note ? `<p class="note small"><b>메모</b> ${esc(c.note)}</p>` : '')
    ref.hidden = !art && !c.note
    const v = viewOf(c)
    const half = (which: 'left' | 'right') => {
      const k = v[which]
      const seg = c.keys
        .map(
          (x) =>
            `<button type="button" data-side="${which}" data-k="${esc(x)}" aria-pressed="${x === k}">${esc(x)}</button>`,
        )
        .join('')
      return `<div class="side"><div class="seg" role="group" aria-label="${which === 'left' ? '왼쪽' : '오른쪽'} 안">${seg}</div><div class="muted small">${esc(k)} · ${esc(c.labels[k] ?? '')}</div>${c.sides[k] ?? ''}</div>`
    }
    sides.innerHTML = half('left') + half('right')
    const cur = state.picks[c.name]
    const pair = [v.left, v.right]
    const pressed = (k: string) => cur?.variant === k && same(cur.against, pair)
    votes.innerHTML =
      c.keys.length < 2
        ? '<span class="muted small">비교할 안이 하나뿐입니다.</span>'
        : v.left === v.right
          ? '<span class="muted small">양쪽에 서로 다른 안을 골라 주세요.</span>'
          : [
              [v.left, `왼쪽(${v.left})이 더 맞다`],
              [v.right, `오른쪽(${v.right})이 더 맞다`],
              ['none', '둘 다 아니다'],
            ]
              .map(
                ([k, label]) =>
                  `<button type="button" class="vote" data-vote="${esc(k as string)}" aria-pressed="${pressed(k as string)}">${esc(label as string)}</button>`,
              )
              .join('')
    const picked = data.choices.filter((x) => state.picks[x.name]).length
    const none = data.choices.filter((x) => state.picks[x.name]?.variant === 'none').length
    const last = cur
      ? ` · ${esc(c.name)} 저장된 선택 <b>${cur.variant === 'none' ? '둘 다 아님' : esc(cur.variant)}</b> (${cur.against.map(esc).join(' 대 ')}, ${when(cur.at)})`
      : ''
    tally.innerHTML = `고른 캐릭터 <b>${picked}/${data.choices.length}</b> · 둘 다 아님 <b>${none}</b>${last}`
    const pill = el('pill-pick')
    const count = pill?.querySelector('b')
    if (pill && count) {
      count.textContent = `${picked}/${data.choices.length}`
      pill.classList.toggle('set', picked === data.choices.length)
    }
  }

  const renderSignoff = () => {
    let done = 0
    for (const g of data.groups) {
      const doc = state.signoff[g.slug]
      if (doc) done++
      const status = el(`so-state-${g.slug}`)
      const button = el(`so-btn-${g.slug}`)
      const note = el(`so-note-${g.slug}`) as HTMLTextAreaElement | null
      if (status) {
        status.textContent = doc ? `승인됨 · ${when(doc.at)}` : '아직 승인 전'
        status.classList.toggle('ok', !!doc)
      }
      if (button) {
        button.textContent = doc ? '메모와 함께 다시 승인' : '이 시리즈 승인'
        button.setAttribute('aria-pressed', String(!!doc))
      }
      if (note && doc && !dirty.has(g.slug) && document.activeElement !== note && note.value !== doc.note)
        note.value = doc.note
    }
    const pill = el('pill-signoff')
    const count = pill?.querySelector('b')
    if (pill && count) {
      count.textContent = `${done}/${data.groups.length}`
      pill.classList.toggle('set', done === data.groups.length)
    }
  }

  document.addEventListener('click', (event) => {
    const target = event.target as Element | null
    if (!target) return
    const tab = target.closest<HTMLElement>('.tab')
    if (tab?.dataset.who) {
      who = tab.dataset.who
      renderPick()
      return
    }
    const seg = target.closest<HTMLElement>('.seg button')
    const current = data.choices.find((x) => x.name === who)
    if (seg && current) {
      const which = seg.dataset.side === 'right' ? 'right' : 'left'
      viewOf(current)[which] = seg.dataset.k ?? ''
      renderPick()
      return
    }
    const vote = target.closest<HTMLElement>('.vote')
    if (vote && current) {
      const v = viewOf(current)
      const doc: PickDoc = { variant: vote.dataset.vote ?? 'none', against: [v.left, v.right], at: Date.now() }
      state.picks[who] = doc
      renderPick()
      write(`picks/${who}`, { ...doc })
      return
    }
    const sign = target.closest<HTMLElement>('.sign')
    const group = sign?.dataset.group
    if (group) {
      const note = el(`so-note-${group}`) as HTMLTextAreaElement | null
      const doc: SignoffDoc = { at: Date.now(), note: note?.value ?? '' }
      state.signoff[group] = doc
      dirty.delete(group)
      renderSignoff()
      write(`signoff/${group}`, { ...doc })
    }
  })

  document.addEventListener('input', (event) => {
    const target = event.target as HTMLElement | null
    const group = target?.dataset.note
    if (group) dirty.add(group)
  })

  renderPick()
  renderSignoff()

  const runtime = (window as unknown as { claude?: Runtime }).claude
  const pending = runtime && typeof runtime.use === 'function' ? runtime.use('db') : Promise.resolve(null)
  pending
    .catch(() => null)
    .then((db) => {
      if (!db) {
        setSave('저장 안 됨')
        const offline = el('offline')
        if (offline) offline.hidden = false
        return
      }
      const live = db as Store
      store = live
      setSave('저장 연결됨')
      const follow = (name: 'picks' | 'signoff') =>
        live.collection(name).onSnapshot(
          (snap) => {
            const docs = Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]))
            if (name === 'picks') state.picks = docs as Record<string, PickDoc>
            else state.signoff = docs as Record<string, SignoffDoc>
            renderPick()
            renderSignoff()
          },
          () => setSave('저장 연결 끊김 — 새로고침해 주세요'),
        )
      if (data.choices.length) follow('picks')
      follow('signoff')
    })
}

const STYLE = `
:root {
  --ground: #eceef2;
  --surface: #ffffff;
  --sunk: #f4f5f7;
  --ink: #15171c;
  --muted: #5b6070;
  --line: #d6d9e0;
  --accent: #3d44c8;
  --accent-soft: #e3e4fa;
  --good: #1d7648;
  --good-soft: #dcefe4;
  --mid: #8a5a00;
  --mid-soft: #f6ecd8;
  --bad: #b3261e;
  --bad-soft: #f8e0dd;
  --sans: "IBM Plex Sans KR", "Apple SD Gothic Neo", "Noto Sans KR", system-ui, sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, monospace;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --ground: #0e0f13;
    --surface: #16181e;
    --sunk: #1c1f26;
    --ink: #e7e8ee;
    --muted: #9ba1b0;
    --line: #2b2e38;
    --accent: #a8acff;
    --accent-soft: #26284a;
    --good: #6fd39c;
    --good-soft: #15301f;
    --mid: #f0b35c;
    --mid-soft: #33260f;
    --bad: #ff8a80;
    --bad-soft: #3a1917;
    color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --ground: #0e0f13;
  --surface: #16181e;
  --sunk: #1c1f26;
  --ink: #e7e8ee;
  --muted: #9ba1b0;
  --line: #2b2e38;
  --accent: #a8acff;
  --accent-soft: #26284a;
  --good: #6fd39c;
  --good-soft: #15301f;
  --mid: #f0b35c;
  --mid-soft: #33260f;
  --bad: #ff8a80;
  --bad-soft: #3a1917;
  color-scheme: dark;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--ground); color: var(--ink); font-family: var(--sans); font-size: 15px; line-height: 1.6; overflow-x: hidden; }
.wrap { max-width: 1120px; margin: 0 auto; padding-inline: 20px; padding-block: 0 72px; }
a { color: var(--accent); }
h1, h2, h3 { text-wrap: balance; margin: 0; }
p { margin: 0; }
.mono { font-family: var(--mono); font-variant-numeric: tabular-nums; }
.muted { color: var(--muted); }
.small { font-size: 13px; }
.bar { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; background: color-mix(in srgb, var(--ground) 90%, transparent); backdrop-filter: blur(8px); border-bottom: 1px solid var(--line); }
.bar-in { max-width: 1120px; margin: 0 auto; padding: 10px 20px; display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; }
.bar-title { font-weight: 600; font-size: 14px; margin-right: auto; }
.pill { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; padding: 3px 10px; border-radius: 999px; background: var(--surface); border: 1px solid var(--line); color: var(--muted); text-decoration: none; }
.pill b { color: var(--ink); font-weight: 500; font-family: var(--mono); }
.pill.set { border-color: var(--accent); background: var(--accent-soft); }
.save-state { font-size: 12px; color: var(--muted); }
header.hero { padding-block: 36px 8px; display: grid; gap: 12px; max-width: 760px; }
.eyebrow { font-family: var(--mono); font-size: 12px; letter-spacing: .06em; color: var(--muted); }
.hero h1 { font-size: clamp(25px, 3.6vw, 34px); line-height: 1.28; font-weight: 600; letter-spacing: -.01em; }
.hero p { color: var(--muted); max-width: 66ch; }
.scale { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 13px; color: var(--muted); }
.scale b { color: var(--ink); font-family: var(--mono); font-weight: 500; }
.scale .good { color: var(--good); }
.scale .mid { color: var(--mid); }
.scale .bad { color: var(--bad); }
.notice { font-size: 13px; color: var(--mid); background: var(--mid-soft); border-radius: 8px; padding: 8px 12px; }
.part-head { margin-top: 40px; display: grid; gap: 6px; max-width: 800px; }
.part-head h2 { font-size: 23px; font-weight: 600; line-height: 1.35; }
.part-head p { color: var(--muted); }
section.panel { margin-top: 24px; background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 24px clamp(16px, 3vw, 28px); display: grid; gap: 20px; scroll-margin-top: 64px; min-width: 0; }
.d-head { display: grid; gap: 6px; max-width: 800px; }
.d-label { font-family: var(--mono); font-size: 12px; letter-spacing: .06em; color: var(--accent); }
.d-head h2 { font-size: 23px; font-weight: 600; line-height: 1.35; }
.d-head p { color: var(--muted); }
.block { display: grid; gap: 10px; align-content: start; min-width: 0; }
.block > h3 { font-size: 15px; font-weight: 600; }
.block > p { color: var(--muted); font-size: 14px; max-width: 80ch; }
.scroll { overflow-x: auto; padding-bottom: 4px; }
.cast-group { display: grid; gap: 8px; }
.cast-group h3 { font-size: 14px; font-weight: 600; color: var(--muted); }
.cast { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
a.cast-card { text-decoration: none; border-radius: 8px; display: block; }
a.cast-card:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.card { display: flex; align-items: center; justify-content: space-between; gap: 8px; border-radius: 8px; padding: 9px 12px; font-family: var(--mono); font-size: 13px; min-width: 0; }
.card > span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dots { display: flex; gap: 6px; align-items: center; flex: none; }
.dots i { width: 16px; height: 16px; border-radius: 50%; display: block; }
.dots b { font-weight: 500; font-size: 11px; line-height: 16px; padding: 0 8px; border-radius: 999px; }
.term { font-family: var(--mono); font-size: 13px; line-height: 1.6; border-radius: 8px; padding: 12px 14px; white-space: nowrap; overflow-x: auto; }
.term .sel { padding: 0 3px; }
.term .cur { display: inline-block; width: .6em; height: 1.1em; vertical-align: -2px; }
.strip { display: grid; grid-template-columns: repeat(8, 1fr); gap: 3px; margin-top: 8px; min-width: 200px; }
.strip i { height: 9px; border-radius: 2px; display: block; }
.note { font-size: 14px; color: var(--ink); background: var(--mid-soft); border-left: 3px solid var(--mid); border-radius: 8px; padding: 10px 14px; }
.note b { color: var(--mid); font-weight: 600; margin-right: 6px; }
.flag { display: inline-block; margin-left: 10px; font-size: 12px; font-weight: 500; padding: 1px 9px; border-radius: 999px; background: var(--bad-soft); color: var(--bad); vertical-align: 4px; }
.t-body { display: grid; grid-template-columns: 180px minmax(0, 1fr) minmax(0, 1.3fr); gap: 18px; align-items: start; }
.t-body.no-art { grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr); }
figure.art { margin: 0; background: var(--sunk); border: 1px solid var(--line); border-radius: 10px; padding: 8px; display: grid; place-items: center; }
figure.art img { display: block; max-width: 100%; max-height: 280px; object-fit: contain; }
.sw { width: 26px; height: 26px; border-radius: 6px; display: block; flex: none; box-shadow: inset 0 0 0 1px rgba(127,127,127,.35); }
.anchors { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.anchors li { display: grid; grid-template-columns: 26px minmax(0, 1fr) auto; gap: 10px; align-items: center; font-size: 13.5px; }
.anchors .txt { display: grid; line-height: 1.3; min-width: 0; }
.anchors .txt small { color: var(--muted); font-size: 11.5px; }
.anchors .slot { font-size: 11.5px; color: var(--accent); background: var(--accent-soft); border-radius: 4px; padding: 0 6px; }
.anchors li.off { color: var(--muted); }
.anchors li.off .sw { opacity: .5; }
.anchors li.off .slot { color: var(--muted); background: var(--sunk); }
table.dep { border-collapse: separate; border-spacing: 0; width: 100%; min-width: 540px; font-size: 13.5px; }
table.dep th, table.dep td { padding: 8px 10px; border-bottom: 1px solid var(--line); vertical-align: middle; text-align: left; }
table.dep thead th { font-size: 12.5px; color: var(--muted); font-weight: 500; border-bottom-width: 1.5px; }
table.dep tbody th { font-weight: 500; white-space: nowrap; }
table.dep .out { display: block; font-size: 11px; font-weight: 400; color: var(--mid); }
table.dep .arrow { color: var(--muted); width: 1%; }
.pick { display: flex; align-items: center; gap: 8px; }
.pick span { line-height: 1.35; }
.pick small { display: block; font-family: var(--mono); font-size: 11px; color: var(--muted); }
.final { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.frame { width: 54px; height: 34px; border-radius: 7px; padding: 7px; display: grid; flex: none; }
.frame i { border-radius: 4px; display: block; box-shadow: inset 0 0 0 1px rgba(127,127,127,.3); font-style: normal; font-family: var(--mono); font-size: 10px; font-weight: 500; line-height: 20px; text-align: center; }
.frame.chip i { border-radius: 999px; }
.frame.small { width: 40px; height: 24px; padding: 4px; }
.frame.small i { line-height: 16px; font-size: 9px; }
.de { font-family: var(--mono); font-weight: 500; font-size: 14px; font-variant-numeric: tabular-nums; }
.de.good { color: var(--good); }
.de.mid { color: var(--mid); }
.de.bad { color: var(--bad); }
.pick-body { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 14px; align-items: start; }
.pick-body.bare { grid-template-columns: minmax(0, 1fr); }
.ref { display: grid; gap: 8px; align-content: start; }
.ref img { display: block; max-width: 100%; max-height: 240px; object-fit: contain; background: var(--sunk); border: 1px solid var(--line); border-radius: 10px; padding: 6px; }
.ref .note { padding: 8px 10px; }
.tabs { display: flex; flex-wrap: wrap; gap: 6px; }
.tab { font: inherit; font-size: 13px; padding: 4px 12px; border-radius: 999px; border: 1.5px solid var(--line); background: var(--sunk); color: var(--ink); cursor: pointer; }
.tab[aria-selected="true"] { border-color: var(--accent); background: var(--accent-soft); }
.tab .done { color: var(--good); font-family: var(--mono); font-size: 11px; margin-left: 4px; }
.tab:focus-visible, .seg button:focus-visible, .vote:focus-visible, .sign:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.sides { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.side { display: grid; gap: 8px; align-content: start; min-width: 0; }
.seg { display: inline-flex; flex-wrap: wrap; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; justify-self: start; }
.seg button { font: inherit; font-size: 12.5px; padding: 4px 11px; border: none; background: var(--sunk); color: var(--ink); cursor: pointer; border-right: 1px solid var(--line); }
.seg button:last-child { border-right: none; }
.seg button[aria-pressed="true"] { background: var(--accent); color: var(--surface); }
.facts { font-size: 12.5px; color: var(--muted); display: flex; flex-wrap: wrap; gap: 4px 14px; }
.facts .low { color: var(--bad); }
.pairs { display: grid; gap: 5px; }
.pair { display: flex; align-items: center; gap: 8px; font-size: 12.5px; }
.pair .sw { width: 22px; height: 22px; }
.pair .arrow { color: var(--muted); }
.pair .part { flex: 1; min-width: 0; }
.pair .de { font-size: 13px; }
.votes { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.vote, .sign { font: inherit; font-size: 13.5px; padding: 7px 16px; border-radius: 8px; border: 1.5px solid var(--line); background: var(--sunk); color: var(--ink); cursor: pointer; }
.vote:hover, .sign:hover { border-color: var(--accent); }
.vote[aria-pressed="true"], .sign[aria-pressed="true"] { border-color: var(--accent); background: var(--accent-soft); font-weight: 600; }
.tally { font-size: 13px; color: var(--muted); }
.tally b { color: var(--ink); font-family: var(--mono); font-weight: 500; }
.signoffs { display: grid; gap: 16px; }
.signoff { display: grid; gap: 8px; border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px; background: var(--sunk); }
.signoff-head { display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: baseline; }
.signoff-head h3 { font-size: 16px; font-weight: 600; }
.so-state { font-size: 13px; color: var(--muted); }
.so-state.ok { color: var(--good); }
.signoff textarea { font: inherit; font-size: 14px; color: var(--ink); background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; min-height: 64px; resize: vertical; width: 100%; }
.signoff textarea:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.sign { justify-self: start; }
@media (max-width: 900px) {
  .t-body { grid-template-columns: 150px minmax(0, 1fr); }
  .t-body.no-art { grid-template-columns: minmax(0, 1fr); }
  .t-body > .preview { grid-column: 1 / -1; }
}
@media (max-width: 720px) {
  .wrap, .bar-in { padding-inline: 16px; }
  section.panel { padding: 20px 16px; }
  .sides, .pick-body { grid-template-columns: minmax(0, 1fr); }
  .ref img { max-height: 180px; }
}
@media (max-width: 560px) {
  .t-body { grid-template-columns: minmax(0, 1fr); }
  figure.art img { max-height: 220px; }
}
@media (prefers-reduced-motion: no-preference) {
  .tab, .vote, .sign, .seg button { transition: background-color .15s, border-color .15s; }
}
`

function page(title: string, themes: Theme[], groups: Group[], choices: Choice[]): string {
  const multi = groups.length > 1
  const cast = groups
    .map((g) => {
      const cards = g.themes
        .map((name) => themes.find((t) => t.name === name))
        .filter((t): t is Theme => t !== undefined)
        .map((t) => `<a class="cast-card" href="#t-${t.name}">${card(t.colors, t.signature, t.name)}</a>`)
        .join('')
      return `<div class="cast-group">${multi ? `<h3>${esc(g.name)}</h3>` : ''}<div class="cast">${cards}</div></div>`
    })
    .join('')
  const pickNo = 3
  const signNo = choices.length ? 4 : 3
  const pick = choices.length
    ? `<section class="panel" id="pick">
<div class="d-head"><span class="d-label">${pickNo} · 두 안 비교</span><h2>표시된 캐릭터는 두 안씩 비교해 고르기</h2><p>캐릭터를 고르고 양쪽에 비교할 안을 정한 뒤 원화에 더 맞는 쪽을 누르세요. 둘 다 아니면 「둘 다 아니다」를 누르세요. 한 번에 둘만 비교하는 편이 여럿을 한꺼번에 보는 것보다 판단이 안정적입니다.</p></div>
<div class="tabs" id="pick-tabs" role="tablist" aria-label="캐릭터"></div>
<div class="pick-body${choices.some((c) => c.art || c.note) ? '' : ' bare'}"><div class="ref" id="pick-ref"></div><div class="sides" id="pick-sides"></div></div>
<div class="votes" id="pick-votes"></div>
<div class="tally" id="pick-tally"></div>
</section>`
    : ''
  const signoffs = groups
    .map(
      (g) => `<div class="signoff">
<div class="signoff-head"><h3>${esc(g.name)}</h3><span class="muted small">${g.themes.map(esc).join(' · ')}</span><span class="so-state" id="so-state-${g.slug}">아직 승인 전</span></div>
<label class="muted small" for="so-note-${g.slug}">메모 (승인과 함께 저장)</label>
<textarea id="so-note-${g.slug}" data-note="${g.slug}" placeholder="예: kisara는 D로, 나머지는 그대로"></textarea>
<button type="button" class="sign" id="so-btn-${g.slug}" data-group="${g.slug}" aria-pressed="false">이 시리즈 승인</button>
</div>`,
    )
    .join('')
  const data: ClientData = { groups, choices }
  const json = JSON.stringify(data).replace(/</g, '\\u003c')
  const pickPill = choices.length
    ? `<a class="pill" id="pill-pick" href="#pick">두 안 비교 <b>0/${choices.length}</b></a>`
    : ''
  return `<title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans+KR:wght@400;500;600&display=swap">
<style>${STYLE}</style>
<div class="bar"><div class="bar-in">
<span class="bar-title">${esc(title)}</span>
<a class="pill" href="#cast">캐스트 <b>${themes.length}</b></a>
${pickPill}
<a class="pill" id="pill-signoff" href="#signoff">승인 <b>0/${groups.length}</b></a>
<span class="save-state" id="save-state">저장 연결 중…</span>
</div></div>
<div class="wrap">
<header class="hero">
<span class="eyebrow">ttheme · palette skill · swatch board</span>
<h1>${esc(title)}</h1>
<p>캐스트를 나란히 본 뒤, 캐릭터마다 설정화에서 잰 색이 최종 팔레트에서 얼마나 달라졌는지 확인하세요. 자동 검사는 표시만 합니다. 표시된 캐릭터는 두 안씩 비교해 고르고, 마지막에 시리즈를 승인해 주세요.</p>
<div class="scale"><span>색 차이는 <b>ΔE2000</b></span><span><b>≈1</b> 구분 어려움</span><span><b>2–5</b> 가까운 색</span><span><b>10+</b> 확실히 다른 색</span><span><b>30+</b> 다른 계열</span><span><b class="good">≤${GOOD}</b> · <b class="mid">${GOOD}–${BAD}</b> · <b class="bad">${BAD}+</b></span></div>
<div class="notice" id="offline" hidden>이 보기에서는 저장 기능을 쓸 수 없어 선택과 승인이 기록되지 않습니다. claude.ai에서 열면 저장됩니다.</div>
</header>
<section class="panel" id="cast">
<div class="d-head"><span class="d-label">1 · 캐스트</span><h2>시리즈를 한눈에</h2><p>사이트 카드와 같은 모양입니다. 오른쪽 표시 셋이 대표색이고, selection 대표색은 어두운 배경에서 점으로는 사라져 <b>sel</b> 칩으로 그립니다. 같은 시리즈인데 서로 무관해 보이거나 두 캐릭터가 한 팔레트처럼 겹치면 문제입니다. 카드를 누르면 그 캐릭터로 갑니다.</p></div>
${cast}
</section>
<div class="part-head"><span class="d-label">2 · 캐릭터별</span><h2>실측 색과 최종 팔레트</h2><p>왼쪽은 설정화에서 잰 색(회색은 쓰지 않은 색), 오른쪽은 최종 팔레트입니다. 아래 표는 대표 슬롯마다 실측 색이 최종 색으로 얼마나 옮겨 갔는지 보여 줍니다.</p></div>
${themes.map(themeSection).join('\n')}
${pick}
<section class="panel" id="signoff">
<div class="d-head"><span class="d-label">${signNo} · 승인</span><h2>시리즈 승인</h2><p>보드 전체를 보고 이 시리즈를 받아들일 때 누르세요. 메모는 승인과 함께 저장됩니다.</p></div>
<div class="signoffs">${signoffs}</div>
</section>
</div>
<script>(${client.toString()})(${json})</script>
`
}

if (import.meta.main) {
  const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    allowPositionals: true,
    options: {
      anchors: { type: 'string' },
      out: { type: 'string' },
      variants: { type: 'string' },
      art: { type: 'string', multiple: true },
      title: { type: 'string' },
    },
  })
  if (!values.anchors || !values.out || positionals.length === 0) {
    console.error(USAGE)
    process.exit(1)
  }
  const anchors = readAnchors(await Bun.file(values.anchors).json())
  const themes = await Promise.all(positionals.map((file) => readTheme(file, anchors)))
  const missing = themes.filter((t) => !t.anchor).map((t) => t.name)
  if (missing.length) console.error(`no anchors for: ${missing.join(', ')}`)
  const dir = mkdtempSync(join(tmpdir(), 'board-'))
  try {
    for (const [i, spec] of (values.art ?? []).entries()) {
      const at = spec.indexOf('=')
      const theme = themes.find((t) => t.name === spec.slice(0, at))
      if (at < 1 || !theme) throw new Error(`--art ${spec}: expected <theme>=<image> for a theme on the board`)
      theme.art = await thumbnail(spec.slice(at + 1), dir, i)
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
  const groups: Group[] = []
  for (const t of themes) {
    const g = groups.find((x) => x.name === t.group)
    if (g) g.themes.push(t.name)
    else groups.push({ slug: slug(t.group), name: t.group, themes: [t.name] })
  }
  const variants = values.variants ? readVariants(await Bun.file(values.variants).json(), themes) : {}
  const choices: Choice[] = Object.entries(variants).map(([name, set]) => {
    const theme = themes.find((t) => t.name === name)
    const anchor = anchors[name]
    return {
      name,
      keys: Object.keys(set),
      labels: Object.fromEntries(Object.entries(set).map(([k, v]) => [k, v.label])),
      sides: Object.fromEntries(Object.entries(set).map(([k, v]) => [k, side(name, v, anchor)])),
      art: Boolean(theme?.art),
      note: anchor?.note ?? '',
    }
  })
  const title = values.title ?? `${groups.map((g) => g.name).join(' · ')} palettes`
  const html = page(title, themes, groups, choices)
  await Bun.write(values.out, html)
  const size = Buffer.byteLength(html)
  console.log(
    `wrote ${values.out} (${(size / 1024).toFixed(0)} KB, ${themes.length} themes, ${choices.length} comparisons, ` +
      `db: picks/<theme>, signoff/${groups.map((g) => g.slug).join('|')})`,
  )
  if (size > LIMIT) {
    console.error(`page is ${(size / 1024 / 1024).toFixed(1)} MB, over the 4 MB budget — pass fewer --art images`)
    process.exit(1)
  }
}
