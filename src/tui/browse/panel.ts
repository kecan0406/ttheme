import { GATE_RULES } from '../../core/contrast.ts'
import type { PaletteEntry } from '../../core/manifest.ts'
import { counted } from '../../core/text.ts'
import { gateFailures } from '../../store/available.ts'
import { isRemote } from '../../store/sources.ts'
import { fit, wrapText } from '../ansi.ts'
import type { Hint } from '../bar.ts'
import { PaletteList } from '../palette-prompt.ts'
import { ansiFg, FG_RESET, MARKS, type Paint } from '../style.ts'
import { button, cap, edge, MIN_ITEMS, more, whereOf } from './draw.ts'
import type { Network } from './network.ts'
import type { Staged } from './staged.ts'
import type { Action, Detail, Marketplace, Row } from './types.ts'

const ACTION_PAD = 20

export interface PanelHost {
  readonly staged: Staged
  readonly network: Network
  readonly p: Paint
  readonly color: boolean
  readonly startup: string | undefined
  readonly maxItems: number
  open(): string | undefined
  source(): string
  mark(entry: PaletteEntry): string
  focus(entry: PaletteEntry): void
}

export class Panel {
  readonly inside: PaletteList<Row>
  private readonly host: PanelHost

  constructor(host: PanelHost) {
    this.host = host
    this.inside = new PaletteList<Row>({
      entries: [],
      picked: host.staged.picked,
      layout: 'marketplaces',
      mode: 'inside',
      pane: 'panel',
      color: host.color,
      maxItems: host.maxItems,
      note: (entry) => host.mark(entry),
      pinned: () => this.actions(),
      onFocus: (entry) => host.focus(entry),
    })
    this.inside.focus = 'off'
  }

  onAction(): boolean {
    return this.inside.focusedRow()?.kind === 'extra'
  }

  action(): Action | undefined {
    const row = this.inside.focusedRow()

    return row?.kind === 'extra' ? row.extra.action : undefined
  }

  renew(): void {
    const row = this.inside.focusedRow()
    this.host.staged.toggleRenew((row ? this.inside.inside(row) : []).map((e) => e.name))
  }

  keys(apply: Hint[]): Hint[] {
    const { staged } = this.host
    const list = this.inside
    const row = list.focusedRow()

    if (row?.kind === 'extra' && row.extra.action) {
      return [['enter', this.verb(row.extra.action, this.host.source())]]
    }

    if (row?.kind === 'catalog' && list.foldable()) {
      return [row.expanded ? ['←', 'close'] : ['→', 'open'], ['space', 'pick']]
    }

    const renewable = row?.kind === 'palette' && staged.outdated(row.entry.name)

    return [
      ['space', 'pick'],
      ...(renewable ? [['ctrl+r', staged.renew.has(row.entry.name) ? 'keep' : 'update'] as Hint] : []),
      ...apply,
    ]
  }

  marketplace(m: Marketplace, width: number): Detail {
    const { p, staged } = this.host
    const auto = isRemote(m.source) ? `Auto-update ${staged.auto(m) ? 'on' : 'off'}` : cap(m.status)
    const failure = this.host.network.failed.get(m.source)

    const pending = staged.adds.has(m.source)
      ? ['Will add']
      : staged.want.has(m.source)
        ? [`Auto-update turns ${staged.want.get(m.source) ? 'on' : 'off'}`]
        : []

    return {
      title: p.bold(m.id),
      lines: [
        ...(m.description ? [...wrapText(m.description, width).map((l) => p.dim(l)), ''] : []),
        ...(isRemote(m.source) ? [] : [auto]),
        ...(failure ? wrapText(failure, width).map((l) => p.error(l)) : []),
        ...(pending.length > 0 ? ['', ...pending.flatMap((s) => wrapText(s, width))] : []),
      ],
      brief: [auto, ...pending].join(' · '),
    }
  }

  draw(width: number, height: number, detail: Detail, top: boolean, lit: boolean): string[] {
    const { p } = this.host
    const frame = (text: string) => (lit ? p.accent(text) : p.dim(text))
    const inner = width - 4
    const side = (text: string) => `${frame('│')} ${fit(text, inner)} ${frame('│')}`
    const title = lit ? p.accent(detail.title) : detail.title
    const body = height - 2

    if (!top) {
      const lines =
        detail.lines.length > body ? [...detail.lines.slice(0, body - 1), p.dim(MARKS.cut)] : detail.lines.slice(0)

      while (lines.length < body) {
        lines.push('')
      }

      return [edge(p, width, 'top', title, '', lit), ...lines.map(side), edge(p, width, 'bottom', '', '', lit)]
    }

    const pins = this.inside.pins()
    const bottom = pins.length > 0 ? pins.length + 1 : 0
    const about = lit ? this.foot(inner) : []
    const foot = about.length > 0 && body - 1 - bottom - (about.length + 1) >= MIN_ITEMS ? about : []
    const reserved = bottom + (foot.length > 0 ? foot.length + 1 : 0)
    const head = detail.lines.slice(0, Math.max(0, body - 2 - reserved))
    this.inside.maxItems = Math.max(1, body - head.length - 1 - reserved)
    const { lines, above, below } = this.inside.window()
    const tree = lines.length > 0 ? lines : [p.dim('   No palettes yet')]

    while (tree.length < this.inside.maxItems) {
      tree.push('')
    }

    const down = below > 0 ? more(p, 1, below, 'panel') : ''

    return [
      edge(p, width, 'top', title, '', lit),
      ...head.map(side),
      side(above > 0 ? more(p, -1, above, 'panel') : ''),
      ...tree.map(side),
      ...(reserved > 0 ? [edge(p, width, 'mid', '', down, lit)] : []),
      ...foot.map(side),
      ...(foot.length > 0 && bottom > 0 ? [edge(p, width, 'mid', '', '', lit)] : []),
      ...pins.map(side),
      edge(p, width, 'bottom', '', reserved > 0 ? '' : down, lit),
    ]
  }

  private actions(): Row[] {
    const open = this.host.open()
    const marketplace = open === undefined ? undefined : this.host.staged.named(open)

    if (!marketplace) {
      return []
    }

    const { source } = marketplace
    const remote = isRemote(source)

    const row = (action: Action): Row => ({
      key: action,
      action,
      text: (focused, at) => this.line(action, source, focused, at),
    })

    return [
      ...(remote && !this.host.staged.adds.has(source) ? [row('update')] : []),
      ...(remote ? [row('auto')] : []),
      row('remove'),
    ]
  }

  private line(action: Action, source: string, focused: boolean, at: number): string {
    const { p, staged } = this.host
    const [label, note] = this.text(action, source)

    return button(p, at, focused, this.mark(action, source), label.padEnd(ACTION_PAD), note ? ` ${p.dim(note)}` : '', {
      pane: 'panel',
      off: action === 'update' && this.host.network.busy.has(source),
      danger: action === 'remove' && !staged.adds.has(source),
    })
  }

  private mark(action: Action, source: string): string {
    if (action === 'update') {
      return MARKS.update
    }

    if (action === 'auto') {
      return MARKS.auto
    }

    return this.host.staged.adds.has(source) ? MARKS.undo : MARKS.remove
  }

  private text(action: Action, source: string): [string, string] {
    const { staged, network } = this.host
    const m = staged.known(source)

    if (action === 'update') {
      const note = network.busy.get(source) ?? (network.failed.has(source) ? 'Update failed' : m ? cap(m.status) : '')

      return ['Update now', note]
    }

    if (action === 'auto') {
      return ['Auto-update', m && staged.auto(m) ? 'on' : 'off']
    }

    return [staged.adds.has(source) ? 'Undo add' : 'Remove marketplace', '']
  }

  private about(action: Action, source: string): [string, string] {
    if (action === 'update') {
      return ['Update now', `Fetch ${whereOf(source)} again now`]
    }

    if (action === 'auto') {
      return ['Auto-update', 'Fetch it on its own once a day and say what changed']
    }

    return this.host.staged.adds.has(source)
      ? ['Undo add', 'Drop it before it is added']
      : ['Remove marketplace', 'Take it off your list — its installed palettes stay']
  }

  private verb(action: Action, source: string): string {
    const { staged } = this.host

    if (action === 'update') {
      return 'update'
    }

    if (action === 'auto') {
      const m = staged.known(source)

      return m && staged.auto(m) ? 'turn off' : 'turn on'
    }

    return staged.adds.has(source) ? 'undo add' : 'remove'
  }

  private foot(width: number): string[] {
    const { p, staged } = this.host
    const row = this.inside.focusedRow()

    if (row?.kind === 'catalog') {
      const members = this.inside.inside(row)
      const installed = members.filter((e) => staged.installed.has(e.name)).length

      return [
        `${p.bold(row.name)}${row.native ? ` ${p.dim(row.native)}` : ''}`,
        p.dim(`${counted(members.length)} · ${installed} installed`),
        '',
      ]
    }

    if (row?.kind === 'extra' && row.extra.action) {
      const [title, about] = this.about(row.extra.action, this.host.source())

      return [p.bold(title), p.dim(about), '']
    }

    if (row?.kind !== 'palette') {
      return ['', '', '']
    }

    const e = row.entry
    const fails = gateFailures(e)
    const gate = `Gate ${GATE_RULES.length - fails.length}/${GATE_RULES.length}`
    const pictures = e.pictures?.length ?? 0

    const extras = [
      ...(pictures > 0 ? [`${pictures} picture${pictures === 1 ? '' : 's'}`] : []),
      ...(e.from ? [`From ${e.from}`] : []),
      ...(e.base ? [`Base ${e.base}`] : []),
    ].join(' · ')

    const others = fails.length > 1 ? ` · +${fails.length - 1}` : ''

    return [
      `${this.host.color ? p.bold(`${ansiFg(e.cursor)}${e.name}${FG_RESET}`) : e.name}  ${p.dim(this.state(e))}`,
      fails[0] === undefined ? p.dim(`${gate} · passes`) : `${gate} · ${p.bold(MARKS.miss)} ${fails[0]}${others}`,
      fit(p.dim(extras), width),
    ]
  }

  private state(entry: PaletteEntry): string {
    const { staged } = this.host
    const now = staged.picked.has(entry.name)
    const was = staged.installed.has(entry.name)
    const state = now && was ? 'Installed' : now ? 'Will install' : was ? 'Will remove' : 'Not installed'

    const update =
      now && staged.outdated(entry.name) ? (staged.renew.has(entry.name) ? ' · Will update' : ' · Update ready') : ''

    return `${state}${update}${this.host.startup === entry.name ? ' · Default' : ''}`
  }
}
