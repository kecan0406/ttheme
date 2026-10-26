import {
  ArrowDown,
  Blend,
  Check,
  ChevronDown,
  Copy,
  Download,
  Eye,
  FileCode,
  Image,
  Link,
  Link2,
  List,
  Moon,
  Plus,
  Redo2,
  RotateCcw,
  Sparkles,
  Sun,
  Undo2,
  Unlink,
  X,
} from 'lucide'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type {
  AboutView,
  Gate,
  ModesView,
  PairView,
  PickerView,
  RowFormat,
  Rows,
  RowView,
  SeedRow,
  StatusView,
} from '@/lib/builder-view'
import { Icon } from '@/lib/icons'
import type { Mode } from '@/lib/mode'
import { cn } from '@/lib/utils'
import { FORMATS, planeRows, type SlotView } from '@/lib/view-types'
import { PLANE_BOTTOM, PLANE_TOP } from '../../src/core/plane.ts'
import { Mark } from './mark'
import { SectionLabel } from './palette-parts'
import { PictureList } from './picture-list'
import { GateRows, Group, Marks, Swatch, Verdict } from './slot-list'
import { GateButton, TITLE, TitleDots, TitleLine, TitleMeta, WorkspaceBar } from './workspace-shell'

const PLANE_THUMB =
  'pointer-events-none absolute size-3.5 -translate-1/2 rounded-full border-2 border-white shadow-sm ring-1 ring-black/55'

const ORIGIN_MARK =
  'pointer-events-none absolute size-3 -translate-1/2 rounded-full border-2 border-dashed border-white/85 ring-1 ring-black/40'

const at = (value: number) => `${(value * 100).toFixed(2)}%`

function Changed() {
  return (
    <span class="text-xs leading-none text-warning">
      <span aria-hidden="true">●</span>
      <span class="sr-only">changed</span>
    </span>
  )
}

function RowMarks({ row }: { row: RowView }) {
  return (
    <>
      <Marks signature={row.signature} miss={row.miss} />
      {row.changed ? <Changed /> : null}
    </>
  )
}

export function StartLabel({ source }: { source: string | null }) {
  return (
    <>
      <Icon node={Sparkles} class="size-3.5" />
      {source ? (
        <>
          <span>from</span>
          <span class="min-w-0 truncate font-semibold text-foreground" translate="no" safe>
            {source}
          </span>
        </>
      ) : (
        <span>start</span>
      )}
    </>
  )
}

export function MadeLabel({ mode }: { mode: Mode }) {
  return <span safe>{`made in ${mode}`}</span>
}

export function ChangedLabel({ count }: { count: number }) {
  return (
    <>
      <i class={cn('size-1.75 flex-none rounded-full', count > 0 ? 'bg-warning' : 'bg-faint-foreground')} />
      <span>
        {count === 0 ? (
          <>
            <span class="max-[560px]:hidden bar-squeezed:hidden">nothing</span>
            <span class="hidden max-[560px]:inline bar-squeezed:inline">0</span>
          </>
        ) : (
          count
        )}
        <span class="max-[560px]:sr-only bar-squeezed:sr-only"> changed</span>
      </span>
    </>
  )
}

export function BuilderBar({
  name,
  problem,
  source,
  made,
  dots,
  changed,
  link,
}: {
  name: string
  problem: string | undefined
  source: string | null
  made: Mode
  dots: string[]
  changed: number
  link: string | null
}) {
  return (
    <WorkspaceBar
      data-bar
      class="relative z-10 [grid-area:bar] max-[760px]:flex-wrap max-[760px]:px-4 max-[760px]:py-3"
    >
      <div class={TITLE}>
        <TitleLine>
          <div data-draft class="relative -ml-1 max-w-85 min-w-14">
            <input
              data-name
              aria-label="palette name"
              aria-invalid={problem ? 'true' : 'false'}
              aria-describedby="builder-name-problem"
              value={name}
              maxlength="40"
              spellcheck="false"
              autocomplete="off"
              autocapitalize="none"
              autocorrect="off"
              translate="no"
              class="h-7.5 max-w-full min-w-full [field-sizing:content] rounded-t-sm border-b-[1.5px] border-dashed border-transparent bg-transparent px-1 font-display text-display-sm font-black text-ellipsis outline-none hover:border-input focus:border-primary focus:bg-muted aria-invalid:border-destructive"
            />
            <p
              id="builder-name-problem"
              data-name-problem
              role="status"
              hidden={!problem}
              class="absolute top-full left-1 z-30 mt-1 rounded-lg border border-border bg-popover px-2 py-0.75 text-xs whitespace-nowrap text-destructive shadow-md"
              safe
            >
              {problem ? `the name ${problem}` : ''}
            </p>
          </div>
          <span data-draft data-bar-dots aria-hidden="true" class="flex flex-none gap-1">
            <TitleDots dots={dots} />
          </span>
        </TitleLine>
        <TitleMeta>
          <button
            type="button"
            popovertarget="builder-start"
            aria-haspopup="dialog"
            data-start
            class="-ml-1.5 inline-flex h-5 min-w-0 cursor-pointer items-center gap-1 rounded-full px-1.5 text-soft-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:inset-ring-2 focus-visible:inset-ring-ring aria-expanded:bg-muted"
          >
            <span data-start-label class="flex min-w-0 items-center gap-1.5">
              <StartLabel source={source} />
            </span>
            <Icon node={ChevronDown} class="size-3 flex-none opacity-70" />
          </button>
          <span data-made-label class="flex-none">
            <MadeLabel mode={made} />
          </span>
        </TitleMeta>
      </div>
      <div class="flex flex-none items-center gap-1 max-[760px]:w-full">
        <Button variant="outline" size="sm" data-changed aria-pressed="false" class="max-[760px]:mr-auto">
          <span data-changed-label class="flex items-center gap-1.5">
            <ChangedLabel count={changed} />
          </span>
        </Button>
        <Button variant="ghost" size="icon-sm" data-undo aria-label="undo" disabled>
          <Icon node={Undo2} />
        </Button>
        <Button variant="ghost" size="icon-sm" data-redo aria-label="redo" disabled>
          <Icon node={Redo2} />
        </Button>
        <Button variant="ghost" size="sm" data-reset disabled={changed === 0}>
          <Icon node={RotateCcw} />
          <span class="max-[1280px]:sr-only">reset</span>
        </Button>
        <span aria-hidden="true" class="mx-1 h-5 w-px bg-border" />
        {link ? (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              class="group/copy"
              aria-label="copy link"
              data-link-only
              data-copy={link}
              data-copy-hold="1400"
              data-copy-status="copied (・ω・)"
            >
              <Icon node={Link} class="group-data-copied/copy:hidden" />
              <Icon node={Check} class="hidden group-data-copied/copy:block" />
            </Button>
            <Button size="sm" popovertarget="builder-add" data-add>
              <Icon node={Plus} />
              <span>
                add<span class="max-[560px]:sr-only bar-squeezed:sr-only"> to ttheme</span>
              </span>
            </Button>
          </>
        ) : null}
        <Button size="sm" data-export-open aria-haspopup="dialog" hidden={link !== null}>
          <Icon node={Download} />
          <span class="max-[360px]:sr-only">export</span>
        </Button>
      </div>
    </WorkspaceBar>
  )
}

export function SeedFields({ seeds }: { seeds: SeedRow[] }) {
  return (
    <>
      {seeds.map((seed) => (
        <label class="grid gap-1.5 text-sm">
          <span class="flex items-center justify-between gap-3">
            <span class="text-soft-foreground" safe>
              {seed.label}
            </span>
            <b data-seed-value={seed.key} class="font-mono text-xs font-semibold tabular-nums" safe>
              {seed.shown}
            </b>
          </span>
          <input
            type="range"
            data-seed={seed.key}
            min={String(seed.min)}
            max={String(seed.max)}
            step={String(seed.step)}
            value={String(seed.value)}
            class="w-full accent-primary"
          />
        </label>
      ))}
    </>
  )
}

export function SeedStrip({ list }: { list: string[] }) {
  return (
    <>
      {list.map((hex) => (
        <i class="h-full flex-1 forced-color-adjust-none" style={`background:${hex}`} />
      ))}
    </>
  )
}

export function SeedsPanel({ seeds, list, gate }: { seeds: SeedRow[]; list: string[]; gate: Gate }) {
  return (
    <section
      id="builder-seeds"
      role="tabpanel"
      aria-labelledby="builder-tab-colors"
      data-panel-body="seeds"
      hidden
      class="grid content-start gap-4 pb-6"
    >
      <div class="flex h-13 items-center gap-2 border-b border-border pr-3 pl-4 text-sm font-semibold">
        <Verdict ok={gate.passed === gate.lines.length} />
        <span data-seed-gate safe>{`${gate.passed} / ${gate.lines.length} floors`}</span>
        <span class="font-medium text-muted-foreground">at every seed</span>
      </div>
      <div data-seed-fields class="grid gap-4 px-4">
        <SeedFields seeds={seeds} />
      </div>
      <div
        data-seed-strip
        aria-hidden="true"
        class="mx-4 flex h-6 overflow-hidden rounded-md ring-1 ring-border inset-ring inset-ring-black/14"
      >
        <SeedStrip list={list} />
      </div>
      <div class="flex gap-2 px-4">
        <Button size="sm" data-seeds-keep>
          keep these colors
        </Button>
        <Button variant="ghost" size="sm" data-seeds-cancel>
          cancel
        </Button>
      </div>
    </section>
  )
}

export function GateSummary({ gate, misses }: { gate: Gate; misses: number }) {
  return (
    <>
      <GateButton passed={gate.passed} total={gate.lines.length} waived={gate.waived} data-gate-jump />
      {misses > 0 ? (
        <Button variant="outline" size="sm" data-next-miss class="flex-none">
          next miss
          <Icon node={ArrowDown} class="size-3.5" />
        </Button>
      ) : null}
    </>
  )
}

function Cell({ row }: { row: RowView }) {
  return (
    <button
      type="button"
      data-row={String(row.slot)}
      data-slot-open={String(row.slot)}
      data-open={row.open ? '' : undefined}
      aria-label={`${row.name} ${row.hex}`}
      aria-expanded={String(row.open)}
      class="flex h-8 min-w-0 items-center gap-1.5 rounded-md pr-1.5 pl-1 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring data-open:bg-accent data-open:inset-ring data-open:inset-ring-primary/45"
    >
      <Swatch hex={row.hex} size="cell" />
      <span class="min-w-0 truncate font-mono text-xs text-soft-foreground" safe>
        {row.value}
      </span>
      <RowMarks row={row} />
    </button>
  )
}

export function BaseRows({ rows }: { rows: RowView[] }) {
  return (
    <>
      {rows.map((row) => (
        <div
          data-row={String(row.slot)}
          data-open={row.open ? '' : undefined}
          class="grid h-13 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 pr-3 pl-4 hover:bg-muted data-open:bg-accent"
        >
          <button
            type="button"
            data-slot-open={String(row.slot)}
            aria-label={`${row.name} ${row.hex}`}
            aria-expanded={String(row.open)}
            class="flex min-w-0 items-center gap-3 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Swatch hex={row.hex} size="row" />
            <span class="flex min-w-0 items-center gap-1.5 text-sm font-medium">
              <span safe>{row.name}</span>
              <RowMarks row={row} />
            </span>
          </button>
          <span class="font-mono text-xs text-soft-foreground tabular-nums" safe>
            {row.value}
          </span>
        </div>
      ))}
    </>
  )
}

function LinkButton({ pair }: { pair: PairView }) {
  const on = pair.link === 'on'
  const names = `${pair.bright.name.toLowerCase()} to ${pair.normal.name.toLowerCase()}`
  const label = on ? `unlink ${names}` : `link ${names}`

  return (
    <button
      type="button"
      data-link={String(pair.bright.slot)}
      aria-pressed={String(on)}
      aria-label={label}
      title={on ? `${pair.bright.name} follows ${pair.normal.name.toLowerCase()}` : label}
      class="grid size-6 place-items-center rounded-full text-faint-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-pressed:text-primary"
    >
      <Icon node={on ? Link2 : Unlink} class="size-3.5" />
    </button>
  )
}

export function PairRows({ pairs }: { pairs: PairView[] }) {
  return (
    <>
      {pairs.map((pair) => (
        <div data-pair class="grid h-10 grid-cols-[56px_minmax(0,1fr)_24px_minmax(0,1fr)] items-center gap-1 pr-3 pl-4">
          <span class="truncate text-sm text-soft-foreground" safe>
            {pair.label}
          </span>
          <Cell row={pair.normal} />
          <LinkButton pair={pair} />
          <Cell row={pair.bright} />
        </div>
      ))}
    </>
  )
}

export function ColorsPanel({
  gate,
  rows,
  format,
  names,
}: {
  gate: Gate
  rows: Rows
  format: RowFormat
  names: string[]
}) {
  return (
    <section
      id="builder-colors"
      role="tabpanel"
      aria-labelledby="builder-tab-colors"
      data-panel-body="colors"
      class="relative pb-6"
    >
      <div class="flex h-11 items-center justify-between gap-2 border-b border-border pr-3 pl-4">
        <span class="text-2xs font-bold tracking-caps text-muted-foreground uppercase">values</span>
        <ToggleGroup label="values in the list">
          {(['oklch', 'hex'] as const).map((value) => (
            <ToggleGroupItem name="row-format" value={value} checked={value === format} class="min-h-7 px-2.5 text-xs">
              {value}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <Group name="base" count="4">
        <div data-draft data-base-rows>
          <BaseRows rows={rows.base} />
        </div>
      </Group>
      <Group name="ansi" count="16">
        <div
          aria-hidden="true"
          class="grid h-7 grid-cols-[56px_minmax(0,1fr)_24px_minmax(0,1fr)] items-end gap-1 pr-3 pb-1.5 pl-4 text-2xs font-semibold text-muted-foreground"
        >
          <span />
          <span class="pl-1">normal 0–7</span>
          <span />
          <span class="pl-1">bright 8–15</span>
        </div>
        <div data-draft data-pair-rows>
          <PairRows pairs={rows.pairs} />
        </div>
      </Group>
      <p data-rows-empty hidden={!rows.empty} class="px-4 py-6 text-center text-sm text-muted-foreground">
        nothing changed yet <span aria-hidden="true">( ˘ω˘ )</span>
      </p>
      <Group name="gate" count={`${gate.passed}/${gate.lines.length}`} id="builder-gate" counts="gate">
        <div data-draft data-gate-rows>
          <GateRows lines={gate.lines} names={names} />
        </div>
      </Group>
      <div data-picker hidden class="absolute inset-x-3 z-20" />
    </section>
  )
}

export function PlaneRows({ s }: { s: SlotView }) {
  return (
    <>
      {planeRows({ top: PLANE_TOP, bottom: PLANE_BOTTOM }, s).map((background) => (
        <div class="flex-1" style={`background:${background}`} />
      ))}
    </>
  )
}

export function Lch({ s }: { s: SlotView }) {
  return (
    <>
      <span safe>{`L ${s.lch[0]}`}</span>
      <span safe>{`C ${s.lch[1]}`}</span>
      <span safe>{`H ${s.lch[2]}`}</span>
    </>
  )
}

export function ContrastHead({ p }: { p: PickerView }) {
  const { partner } = p
  const ok = partner.floor === undefined ? null : partner.ratio >= partner.floor

  return (
    <>
      <span class="text-muted-foreground" safe>{`◐ on ${partner.name}`}</span>
      <span class="inline-flex items-center gap-2">
        <b class="font-mono font-semibold tabular-nums" safe>{`${partner.ratio.toFixed(2)}:1`}</b>
        {ok === null ? null : (
          <span class={cn('text-2xs font-semibold', ok ? 'text-success' : 'text-warning')} safe>
            {ok ? `≥ ${partner.floor}` : `under ${partner.floor}`}
          </span>
        )}
      </span>
    </>
  )
}

export function Checks({ s }: { s: SlotView }) {
  return (
    <>
      {s.checks.map((check) => (
        <li class="flex items-start gap-2 text-xs text-soft-foreground">
          <Verdict ok={check.ok} />
          <span class="pt-0.5" safe>
            {check.text}
          </span>
        </li>
      ))}
    </>
  )
}

export function Use({ s, panes }: { s: SlotView; panes: string[] }) {
  return (
    <>
      <p class="text-sm text-soft-foreground" safe>
        {s.use}
      </p>
      <p class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>shown in</span>
        {panes.map((name, i) => (
          <span>
            <span safe>{name}</span>{' '}
            <b class="font-mono font-semibold text-foreground" safe>
              {String(s.uses[i] ?? 0)}
            </b>
          </span>
        ))}
      </p>
    </>
  )
}

export function PickerActions({ p }: { p: PickerView }) {
  return (
    <>
      {p.link === null ? null : (
        <Button variant="outline" size="sm" data-picker-link aria-pressed={String(p.link === 'on')}>
          <Icon node={p.link === 'on' ? Link2 : Unlink} class="size-3.5" />
          {p.link === 'on' ? 'follows its normal' : 'moves alone'}
        </Button>
      )}
      {p.origin ? (
        <Button variant="outline" size="sm" data-picker-back>
          <Icon node={RotateCcw} class="size-3.5" />
          <span safe>{`back to ${p.origin.hex}`}</span>
        </Button>
      ) : null}
    </>
  )
}

export function PickerHead({ p }: { p: PickerView }) {
  const { s } = p

  return (
    <>
      <i
        class="size-7 flex-none rounded-md ring-1 ring-border inset-ring inset-ring-black/14 forced-color-adjust-none"
        style={`background:${s.hex}`}
      />
      <div class="grid min-w-0 flex-1">
        <span class="flex items-center gap-1.5 text-sm font-semibold">
          <span safe>{s.name}</span>
          <Marks signature={s.signature} miss={s.miss} />
        </span>
        {s.key === s.name.toLowerCase() ? null : (
          <span class="font-mono text-xs text-muted-foreground" safe>
            {s.key}
          </span>
        )}
      </div>
    </>
  )
}

export function Picker({ p, track, panes }: { p: PickerView; track: string; panes: string[] }) {
  const { s, partner } = p
  const value = s.formats[p.format]

  return (
    <div
      role="dialog"
      aria-label={`${s.name} ${s.hex}`}
      data-picker-card
      class="grid gap-3 rounded-2xl border border-border bg-popover p-3.5 text-popover-foreground shadow-lg motion-safe:animate-enter"
    >
      <div class="flex items-center gap-2.5">
        <div data-picker-head class="contents">
          <PickerHead p={p} />
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="close" data-picker-close>
          <Icon node={X} />
        </Button>
      </div>
      <div
        data-plane
        class="relative flex h-32 cursor-crosshair touch-none flex-col overflow-hidden rounded-lg inset-ring inset-ring-black/12 select-none has-focus-visible:ring-2 has-focus-visible:ring-ring"
      >
        <div data-plane-rows aria-hidden="true" class="contents">
          <PlaneRows s={s} />
        </div>
        <i
          data-origin-plane
          aria-hidden="true"
          hidden={!p.origin}
          class={ORIGIN_MARK}
          style={p.origin ? `left:${at(p.origin.x)};top:${at(p.origin.y)}` : ''}
        />
        <i data-thumb-plane aria-hidden="true" class={PLANE_THUMB} style={`left:${at(s.x)};top:${at(s.y)}`} />
        <input
          type="range"
          data-plane-l
          aria-label="lightness"
          min="0"
          max="100"
          step="1"
          value={String(Math.round(Number(s.lch[0]) * 100))}
          class="sr-only"
        />
        <input
          type="range"
          data-plane-c
          aria-label="chroma, as a share of the most this hue holds"
          min="0"
          max="100"
          step="1"
          value={String(Math.round(s.x * 100))}
          class="sr-only"
        />
      </div>
      <div data-lch class="-mt-1 flex justify-between font-mono text-xs text-muted-foreground">
        <Lch s={s} />
      </div>
      <div
        class="relative h-3 rounded-full inset-ring inset-ring-black/12 has-focus-visible:ring-2 has-focus-visible:ring-ring"
        style={`background:${track}`}
      >
        <i
          data-origin-hue
          aria-hidden="true"
          hidden={!p.origin}
          class={ORIGIN_MARK}
          style={p.origin ? `left:${at(p.origin.along)};top:50%` : ''}
        />
        <i data-thumb-hue aria-hidden="true" class={PLANE_THUMB} style={`left:${at(s.along)};top:50%`} />
        <input
          type="range"
          data-hue
          aria-label="hue"
          min="0"
          max="359"
          step="1"
          value={String(Math.round(s.hue) % 360)}
          class="absolute inset-0 m-0 size-full cursor-pointer appearance-none bg-transparent opacity-0"
        />
      </div>
      <div class="grid gap-1">
        <div data-contrast-head class="flex items-center justify-between gap-2 text-xs">
          <ContrastHead p={p} />
        </div>
        <div class="relative h-3 rounded-full bg-muted inset-ring inset-ring-border has-focus-visible:ring-2 has-focus-visible:ring-ring">
          {partner.ticks.map((tick) => (
            <i
              aria-hidden="true"
              class={cn(
                'pointer-events-none absolute top-0.5 bottom-0.5 w-px -translate-x-1/2',
                tick.floor ? 'bg-primary' : 'bg-faint-foreground',
              )}
              style={`left:${at(tick.at)}`}
            />
          ))}
          <i data-thumb-contrast aria-hidden="true" class={PLANE_THUMB} style={`left:${at(partner.at)};top:50%`} />
          <input
            type="range"
            data-contrast
            aria-label={`contrast on ${partner.name}`}
            aria-valuetext={`${partner.ratio.toFixed(2)} to 1`}
            min="0"
            max="1000"
            step="1"
            value={String(Math.round(partner.at * 1000))}
            class="absolute inset-0 m-0 size-full cursor-pointer appearance-none bg-transparent opacity-0"
          />
        </div>
        <div aria-hidden="true" class="relative h-3.5 font-mono text-2xs text-muted-foreground">
          {partner.ticks.map((tick) => (
            <span
              class={cn('absolute -translate-x-1/2', tick.floor ? 'text-primary' : '')}
              style={`left:${at(tick.at)}`}
              safe
            >
              {tick.label}
            </span>
          ))}
        </div>
      </div>
      <ToggleGroup label="value format" class="grid w-full grid-cols-3">
        {FORMATS.map((name) => (
          <ToggleGroupItem name="slot-format" value={name} checked={name === p.format}>
            {name}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div class="flex h-10 items-center gap-2 rounded-lg border border-input pr-1 pl-3 has-aria-invalid:border-destructive">
        <input
          data-value
          aria-label="value"
          aria-invalid="false"
          value={value}
          spellcheck="false"
          autocomplete="off"
          autocapitalize="none"
          autocorrect="off"
          class="min-w-0 flex-1 bg-transparent font-mono text-code outline-none"
        />
        <Button
          variant="outline"
          size="icon-sm"
          class="group/copy"
          aria-label="copy the value"
          data-copy={value}
          data-copy-hold="1200"
        >
          <Icon node={Copy} class="group-data-copied/copy:hidden" />
          <Icon node={Check} class="hidden group-data-copied/copy:block" />
        </Button>
      </div>
      <p data-bad hidden class="-mt-1.5 text-xs text-destructive">
        reads as #rrggbb, rgb(r g b) or oklch(l c h)
      </p>
      <ul data-checks class="grid gap-1.5">
        <Checks s={s} />
      </ul>
      <div data-use class="grid gap-1">
        <Use s={s} panes={panes} />
      </div>
      <button
        type="button"
        aria-pressed={String(p.where)}
        data-where
        class="group/where flex h-10 items-center gap-2.5 rounded-lg border border-border px-3 text-left text-sm font-medium outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Icon node={Eye} class="size-4 text-muted-foreground" />
        show where it's used
        <span
          aria-hidden="true"
          class="relative ml-auto h-4.5 w-7.5 flex-none rounded-full bg-input transition-colors after:absolute after:top-0.5 after:left-0.5 after:size-3.5 after:rounded-full after:bg-card after:shadow-sm after:transition-transform group-aria-pressed/where:bg-primary group-aria-pressed/where:after:translate-x-3"
        />
      </button>
      <div data-picker-actions class="flex flex-wrap gap-1.5 empty:hidden">
        <PickerActions p={p} />
      </div>
    </div>
  )
}

export function MarkTile({ about }: { about: AboutView }) {
  return (
    <div
      class="grid size-20 flex-none place-items-center rounded-2xl ring-1 ring-border forced-color-adjust-none [&_[data-slot=mark]]:h-9"
      style={`background:${about.background};--mark0:${about.marks[0]};--mark1:${about.marks[1]};--mark2:${about.marks[2]}`}
    >
      <Mark />
    </div>
  )
}

export function FileNote({ about }: { about: AboutView }) {
  return (
    <>
      saved as{' '}
      <code class="rounded-sm bg-muted px-1 font-mono text-soft-foreground" translate="no" safe>
        {about.file}
      </code>
      {about.base ? (
        <>
          {' · its ANSI colors from '}
          <span class="font-medium text-soft-foreground" translate="no" safe>
            {about.base}
          </span>
        </>
      ) : null}
      {about.from ? (
        <>
          {' · copied from '}
          <span class="font-medium text-soft-foreground" translate="no" safe>
            {about.from}
          </span>
        </>
      ) : null}
    </>
  )
}

export function SignatureDots({ about }: { about: AboutView }) {
  return (
    <>
      {about.signature.map((slot, i) => (
        <label class="grid gap-1.5">
          <i
            class="h-2 rounded-full ring-1 ring-border forced-color-adjust-none"
            style={`background:${about.colors[i]}`}
          />
          <select
            data-signature={String(i)}
            aria-label={`signature ${i + 1}`}
            class="h-8 w-full min-w-0 rounded-lg border border-border bg-card px-2 font-mono text-xs outline-none hover:border-input focus-visible:border-ring"
          >
            {about.slots.map((key) => (
              <option value={key} selected={key === slot} safe>
                {key}
              </option>
            ))}
          </select>
        </label>
      ))}
    </>
  )
}

export function Modes({ modes }: { modes: ModesView }) {
  return (
    <>
      <p class="text-sm text-soft-foreground" safe>
        {`Made in ${modes.made}.`}
      </p>
      <p class="text-xs text-muted-foreground" safe>
        {modes.own
          ? `Its ${modes.other} colors are its own${modes.tuned > 0 ? `, ${modes.tuned} of them tuned here` : ''}.`
          : modes.tuned > 0
            ? `Its ${modes.other} colors mirror the ${modes.made} ones, ${modes.tuned} of them tuned.`
            : `Its ${modes.other} colors mirror the ${modes.made} ones.`}
      </p>
      {modes.own || modes.tuned > 0 ? (
        <Button variant="outline" size="sm" data-follow-mirror class="justify-self-start">
          <Icon node={Blend} class="size-3.5" />
          follow the mirror instead
        </Button>
      ) : null}
    </>
  )
}

export function PicturesBox({ about }: { about: AboutView }) {
  return about.pictures.length === 0 ? (
    <p class="text-xs text-muted-foreground">No pictures.</p>
  ) : (
    <>
      <label class="flex items-center gap-2 text-sm">
        <input type="checkbox" data-keep-pictures checked={about.keep} class="size-4 accent-primary" />
        <span safe>{`keep its ${about.pictures.length === 1 ? 'picture' : `${about.pictures.length} pictures`}`}</span>
      </label>
      <div class={about.keep ? '' : 'opacity-50'}>
        <PictureList pictures={about.pictures} />
      </div>
    </>
  )
}

export function AboutPanel({ about, modes, link }: { about: AboutView; modes: ModesView; link?: JSX.Element }) {
  return (
    <section id="builder-about" role="tabpanel" aria-labelledby="builder-tab-about" data-panel-body="about" hidden>
      {link ? link : null}
      <div class="grid gap-3 border-b border-border p-4">
        <SectionLabel icon={<Icon node={FileCode} />}>File</SectionLabel>
        <label for="builder-about-name" class="grid gap-1.5 text-sm">
          <span class="text-muted-foreground">name</span>
          <Input
            id="builder-about-name"
            data-about-name
            value={about.name}
            maxlength="40"
            spellcheck="false"
            autocomplete="off"
            autocapitalize="none"
            autocorrect="off"
            translate="no"
            class="h-9 font-mono text-sm"
          />
        </label>
        <p data-file-note class="text-xs text-muted-foreground">
          <FileNote about={about} />
        </p>
      </div>
      <div class="grid gap-3 border-b border-border p-4">
        <SectionLabel icon={<Icon node={Sparkles} />}>Signature</SectionLabel>
        <div data-mark-tile class="contents">
          <MarkTile about={about} />
        </div>
        <div data-signature-dots class="grid grid-cols-3 gap-2">
          <SignatureDots about={about} />
        </div>
        <p data-signature-trouble hidden={!about.trouble} class="text-xs text-destructive">
          pick three slots of three different colors
        </p>
      </div>
      <div class="grid gap-2.5 border-b border-border p-4">
        <SectionLabel icon={<Icon node={Blend} />}>Modes</SectionLabel>
        <div data-modes class="grid gap-2.5">
          <Modes modes={modes} />
        </div>
      </div>
      <div class="grid gap-3 border-b border-border p-4">
        <SectionLabel icon={<Icon node={List} />}>Sources</SectionLabel>
        <label for="builder-ansi-source" class="grid gap-1.5 text-sm">
          <span class="text-muted-foreground">ansi source</span>
          <Input
            id="builder-ansi-source"
            data-meta="ansiSource"
            value={about.ansiSource}
            placeholder="where the ANSI colors came from"
            maxlength="80"
            autocomplete="off"
            class="h-9 text-sm"
          />
        </label>
        <label for="builder-booru" class="grid gap-1.5 text-sm">
          <span class="text-muted-foreground">character tag</span>
          <Input
            id="builder-booru"
            data-meta="booru"
            value={about.booru}
            placeholder="hatsune_miku"
            maxlength="80"
            spellcheck="false"
            autocomplete="off"
            autocapitalize="none"
            autocorrect="off"
            translate="no"
            class="h-9 font-mono text-sm"
          />
        </label>
      </div>
      <div class="grid gap-2.5 p-4">
        <SectionLabel icon={<Icon node={Image} />}>Pictures</SectionLabel>
        <div data-pictures class="grid gap-2.5">
          <PicturesBox about={about} />
        </div>
      </div>
    </section>
  )
}

export function EditMode({ made, editing }: { made: Mode; editing: Mode }) {
  return (
    <fieldset
      aria-label="mode to edit"
      class="flex h-7.5 min-w-0 flex-none items-center gap-0.5 rounded-full bg-(--fg)/8 p-0.5"
    >
      {(['dark', 'light'] as const).map((mode) => (
        <button
          type="button"
          data-edit-mode={mode}
          aria-pressed={String(mode === editing)}
          aria-label={`edit the ${mode} colors${mode === made ? ', the mode it was made in' : ''}`}
          title={mode === made ? `${mode} · made in` : mode}
          class="relative flex h-full w-8 cursor-pointer items-center justify-center rounded-full text-(--fg)/62 transition-colors duration-150 outline-none hover:text-(--fg) focus-visible:inset-ring-2 focus-visible:inset-ring-ring aria-pressed:bg-(--cu) aria-pressed:text-(--bg)"
        >
          <Icon node={mode === 'dark' ? Moon : Sun} class="size-3.5" />
          <i
            data-made-dot
            hidden={mode !== made}
            class="absolute top-0.5 right-1 size-1 rounded-full bg-current opacity-70"
          />
        </button>
      ))}
    </fieldset>
  )
}

export function StatusText({ status }: { status: StatusView }) {
  return (
    <>
      <i class={cn('size-1.5 flex-none rounded-full', status.ok ? 'bg-success' : 'bg-warning')} />
      <span class="truncate" safe>
        {status.text}
      </span>
    </>
  )
}
