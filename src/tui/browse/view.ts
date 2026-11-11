import type { PaletteEntry } from '../../core/manifest.ts'
import { cells } from '../../core/text.ts'
import { BUILTIN } from '../../core/theme.ts'
import { isRemote, TOPIC } from '../../store/sources.ts'
import { clip, fit, pieces, spread, wrapText } from '../ansi.ts'
import { type Bar, barLine, type Hint, toned } from '../bar.ts'
import { keysBox, overlay } from '../help.ts'
import { hubBar } from '../hub.ts'
import { capped } from '../keycaps.ts'
import type { Card, Scrolled } from '../palette-prompt.ts'
import { SEP } from '../parts.ts'
import { MARKS } from '../style.ts'
import { button, cap, EMPTY, FAILED, framed, MIN_ITEMS, more, whereOf } from './draw.ts'
import type { Laid, Shown } from './model.ts'
import { browseTopics } from './topics.ts'
import type { Detail, Found, Marketplace, Row } from './types.ts'

const LEFT_MIN = 40
const LEFT_MAX = 60
const PANEL_MIN = 42
const PANEL_KEEPS = 14
const WIDE = 94
const ROOMY = 22
const MIN_COLS = 40
const MIN_ROWS = 10

export interface Drawn {
  text: string
  laid: Laid
}

export function row(b: Shown, found: Found, idle = false): Row {
  return {
    key: found.kind === 'listed' ? `listed ${found.listed.source}` : found.kind,
    ...(idle ? { idle } : {}),
    found,
    text: (focused: boolean, at: number, held: boolean) => foundLine(b, found, focused, at, held),
  }
}

export function heads(b: Shown): Row[] {
  return [row(b, { kind: 'new' }, true), row(b, { kind: 'search' })]
}

export function status(b: Shown, marketplace: Marketplace): string {
  return b.staged.adds.has(marketplace.source)
    ? 'Will add'
    : (b.network.busy.get(marketplace.source) ?? (b.network.failed.has(marketplace.source) ? FAILED : ''))
}

export function about(b: Shown, top: string, members: PaletteEntry[], matching?: number): Card {
  const m = b.staged.named(top)
  const installed = members.filter((e) => b.staged.installed.has(e.name)).length
  const adding = members.filter((e) => b.staged.picked.has(e.name) && !b.staged.installed.has(e.name)).length
  const dropping = members.filter((e) => b.staged.installed.has(e.name) && !b.staged.picked.has(e.name)).length

  const counts = [
    ...(m && matching !== undefined ? [`${matching} of ${m.entries.length} match`] : []),
    ...(m && matching === undefined ? [`${m.entries.length} available`] : []),
    ...(installed > 0 || !m ? [`${installed} installed`] : []),
    ...(adding > 0 ? [`${adding} to install`] : []),
    ...(dropping > 0 ? [`${dropping} to remove`] : []),
    ...(m && m.source !== BUILTIN && !(b.staged.adds.has(m.source) && isRemote(m.source)) ? [cap(m.status)] : []),
  ]

  return {
    added: m !== undefined,
    lines: [b.p.dim(m ? whereOf(m.source) : 'Not added'), b.p.dim(counts.join(SEP))],
  }
}

export function badge(b: Shown, id: string): string {
  const m = b.staged.named(id)

  if (!m) {
    return ''
  }

  const auto = isRemote(m.source) && b.staged.auto(m) ? `${MARKS.auto} auto-update` : ''
  const state = status(b, m)
  const failed = state === FAILED ? `  ${b.p.error(state)}` : state ? `  ${b.p.dim(state)}` : ''

  return `${auto ? `  ${b.p.dim(auto)}` : ''}${failed}`
}

export function foundLine(b: Shown, found: Found, focused: boolean, at: number, held: boolean): string {
  const after = (text: string) => `  ${b.p.dim(text)}`

  return found.kind === 'new'
    ? button(b.p, at, focused, '+', 'Add marketplace', after('owner/repo or a folder'), { held })
    : button(b.p, at, focused, MARKS.search, 'Search marketplace', after('find one on GitHub'), { held })
}

export function mark(b: Shown, entry: PaletteEntry): string {
  const tuned = b.tuned.has(entry.name) ? `  ${b.p.warn(MARKS.on)}` : ''

  if (!b.staged.outdated(entry.name)) {
    return tuned
  }

  return `${tuned}${b.staged.renew.has(entry.name) ? `  ${b.p.bold(`${MARKS.update} update`)}` : `  ${b.p.dim(MARKS.update)}`}`
}

export function counts(b: Shown): string {
  if (b.showing === 'search') {
    return b.search.counts()
  }

  const updating = b.network.updating() ? `Updating…${SEP}` : ''
  const list = b.list
  const dropped = b.staged.removes.size
  const removing = dropped > 0 ? `${SEP}${dropped} marketplace${dropped === 1 ? '' : 's'} to remove` : ''

  return `${updating}${list.matched()}/${list.total()}${SEP}${list.pickedCount()} picked${removing}`
}

export function searchText(b: Shown): string {
  const typed = b.query()

  if (typed) {
    return `${typed}_`
  }

  if (b.showing === 'search') {
    return b.p.dim('Search… a work or a marketplace')
  }

  const example = b.hint.text()

  return b.p.dim(`Search…${example ? ` e.g. ${example}` : ''}`)
}

export function heading(b: Shown): string {
  const title = b.showing === 'search' ? 'Search marketplace' : 'Browse'

  return `${b.p.bold(title)} ${b.p.dim(`(${counts(b)})`)}`
}

export function searchBox(b: Shown, width: number): string[] {
  return framed(b.p, width, `${b.p.dim(MARKS.search)} ${searchText(b)}`)
}

export function detail(b: Shown, width: number): Detail {
  if (b.showing === 'search') {
    return b.search.detail(width)
  }

  const row = b.list.focusedRow()

  if (row?.kind === 'extra') {
    return row.extra.found ? foundDetail(b, row.extra.found, width) : EMPTY
  }

  if (row?.kind !== 'top') {
    return EMPTY
  }

  const marketplace = b.staged.named(row.name)

  if (marketplace) {
    return b.panel.marketplace(marketplace, width)
  }

  const note = 'In no marketplace you added — its installed palettes stay'

  return { title: b.p.bold(row.name), lines: wrapText(note, width), brief: note }
}

export function foundDetail(b: Shown, row: Found, width: number): Detail {
  if (row.kind === 'new') {
    return {
      title: b.p.bold('Add marketplace'),
      lines: b.form.lines(width, b.side === 'form', b.beat),
      brief: capped('enter adds a repository or a folder'),
    }
  }

  const what = `Marketplaces people publish on GitHub, under the ${TOPIC} topic`

  return {
    title: b.p.bold('Search marketplace'),
    lines: [...wrapText(what, width), '', ...wrapText(capped('enter opens the search'), width)],
    brief: capped('enter searches the marketplaces on GitHub'),
  }
}

export function footer(b: Shown): Bar {
  if (b.help) {
    return b.help.bar()
  }

  if (b.leaving !== undefined) {
    const count = b.staged.count()

    return {
      badge: 'BROWSE',
      lead: `Apply ${count} ${count === 1 ? 'change' : 'changes'} before you leave?`,
      short: `Apply ${count}?`,
      keys: [
        ['y', 'apply'],
        ['n', 'discard'],
      ],
      right: ['esc', 'stay'],
      keep: ['y', 'n'],
    }
  }

  if (b.removing) {
    return {
      badge: 'BROWSE',
      lead: `Remove ${b.removing.id}? Its installed palettes stay installed`,
      short: `Remove ${b.removing.id}?`,
      keys: [
        ['y', 'remove'],
        ['n', 'keep'],
      ],
      right: ['esc', 'back'],
      keep: ['y', 'n'],
    }
  }

  if (b.showing === 'search') {
    return b.search.bar()
  }

  if (b.side === 'form') {
    return { badge: 'BROWSE (ADD)', keys: [...b.form.keys(), ['?', 'keys']], right: ['esc', 'cancel'] }
  }

  const filter = b.field.value
  const apply: Hint[] = b.staged.dirty() ? [['enter', 'apply']] : []
  const tail: Hint[] = [...(filter ? [['bksp', 'edit'] as Hint] : []), ['?', 'keys']]

  return {
    badge: filter ? 'BROWSE (FILTER)' : 'BROWSE',
    ...(b.notice ? { lead: toned(b.p, b.notice.tone, b.notice.text) } : {}),
    keys: [...(b.side === 'panel' ? b.panel.keys(apply) : cardKeys(b, apply)), ...tail],
    right: filter ? ['esc', 'clear'] : b.side === 'panel' ? ['esc', 'back'] : ['esc', 'cancel'],
    ...(b.standing ? { standing: b.standing } : {}),
  }
}

export function cardKeys(b: Shown, apply: Hint[]): Hint[] {
  const row = b.list.focusedRow()

  if (row?.kind === 'extra') {
    return [['enter', 'open']]
  }

  if (row?.kind !== 'top') {
    return apply
  }

  const open: Hint[] = b.panel.inside.size() > 0 ? [['→', 'open']] : []

  return [...open, ['space', 'pick']]
}

export function small(b: Shown, cols: number, rows: number, need: number): string {
  return [`Needs ${MIN_COLS}×${need} — now ${cols}×${rows}`, b.p.dim('esc cancel')]
    .map((line) => clip(line, cols))
    .join('\n')
}

export function drawBrowse(b: Shown, cols: number, rows: number): Drawn {
  if (cols < MIN_COLS || rows < MIN_ROWS) {
    return { text: small(b, cols, rows, MIN_ROWS), laid: { scrolls: [] } }
  }

  if (b.review.phase !== 'browse') {
    const { text, offset } = b.review.frame(cols, rows)

    return { text, laid: { offset, scrolls: [] } }
  }

  const wide = cols >= WIDE
  const width = cols - 1

  const head =
    rows >= ROOMY
      ? [` ${heading(b)}`, ...searchBox(b, width - 1).map((line) => ` ${line}`)]
      : [spread(` ${b.p.dim(MARKS.search)} ${searchText(b)}`, b.p.dim(counts(b)), width)]

  const chrome = head.length + 3 + (wide ? 0 : 1) + (b.hub ? 1 : 0)

  if (rows < chrome + MIN_ITEMS) {
    return { text: small(b, cols, rows, chrome + MIN_ITEMS), laid: { scrolls: [] } }
  }

  const items = Math.max(MIN_ITEMS, rows - chrome)
  const list = b.current()
  const view = list.window(items)

  const plain = (line: string) =>
    pieces(line)
      .flatMap((piece) => (piece.sequence ? [] : [piece.text]))
      .join('')
      .trimEnd()

  const widest = Math.max(0, ...view.lines.map((line) => cells(plain(line)) + 3))
  const left = wide ? Math.min(LEFT_MAX, width - PANEL_MIN - 1, Math.max(LEFT_MIN, widest)) : width

  const over = !wide && b.side !== 'cards'
  const main = over ? box(b, width - 1, items + 3) : cards(b, view, wide, left, width, items)

  const frame = [
    ...(b.hub ? [fit(hubBar(b.hub, b.color, b.inks), width, false)] : []),
    ...head.map((line) => fit(line, width, false)),
    ...(over ? main.lines.map((line) => ` ${line}`) : main.lines),
    ` ${barLine(b.p, footer(b), width - 1)}`,
  ]

  const help = b.help?.box(b.p, cols, rows)
  const scrolls: Laid['scrolls'] = [[list, view.scroll]]

  if (main.scroll) {
    scrolls.push([b.panel.inside, main.scroll])
  }

  return {
    text: (help ? overlay(frame, help.lines, cols, rows, frame.length - main.lines.length - 1) : frame).join('\n'),
    laid: { split: wide ? left + 1 : 0, ...(help ? { help: help.top } : {}), hinted: b.hinting(), scrolls },
  }
}

export function cards(
  b: Shown,
  { lines, above, below }: { lines: string[]; above: number; below: number },
  wide: boolean,
  left: number,
  width: number,
  items: number,
): Scrolled {
  const typed = b.field.value.trim()
  const none = b.showing !== 'search' && typed !== '' && b.list.matched() === 0
  const empty = none && lines.length + 2 <= items ? ['', b.p.dim(`   No palettes match '${typed}'`)] : []
  const body = [...lines, ...empty].map((line) => ` ${line}`)

  while (body.length < items) {
    body.push('')
  }

  const list = [above > 0 ? ` ${more(b.p, -1, above)}` : '', ...body, below > 0 ? ` ${more(b.p, 1, below)}` : '']

  if (!wide) {
    const { brief, failed } = detail(b, left - 2)

    return {
      lines: [
        ...list.map((row) => fit(row, left, false)),
        fit(` ${(failed ? b.p.error : b.p.dim)(brief)}`, left, false),
      ],
    }
  }

  const keys = keysFor(b, width - left - 1, list.length)
  const side = box(b, width - left - 1, list.length - keys.length)
  const stack = [...side.lines, ...keys]

  return {
    lines: list.map((row, i) => `${fit(row, left)} ${stack[i] ?? ''}`),
    ...(side.scroll ? { scroll: side.scroll } : {}),
  }
}

export function keysFor(b: Shown, width: number, height: number): string[] {
  if (!b.keyed || b.side === 'form') {
    return []
  }

  const keys = keysBox(b.p, browseTopics(b.topicsHost), width)

  return height - keys.length >= PANEL_KEEPS ? keys : []
}

export function box(b: Shown, width: number, height: number): Scrolled {
  const top = b.current().focusedRow()?.kind === 'top'

  return b.panel.draw(width, height, detail(b, width - 4), top, b.side !== 'cards')
}
