import { Check, Copy, Eye, Minus, X } from 'lucide'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Icon } from '@/lib/icons'
import { FORMATS, planeRows, type ShareView, type SlotFormat, type SlotView } from '@/lib/share-view'

export function Marks({ signature, miss }: { signature: boolean; miss: boolean }) {
  return (
    <>
      {signature ? (
        <span class="text-xs leading-none text-primary">
          <span aria-hidden="true">✦</span>
          <span class="sr-only">signature</span>
        </span>
      ) : null}
      {miss ? (
        <span class="text-xs leading-none font-bold text-destructive">
          <span aria-hidden="true">✗</span>
          <span class="sr-only">misses the gate</span>
        </span>
      ) : null}
    </>
  )
}

export function Verdict({ ok }: { ok: boolean | null }) {
  const tone =
    ok === null ? 'bg-muted text-muted-foreground' : ok ? 'bg-success/16 text-success' : 'bg-warning/18 text-warning'
  return (
    <span class={`inline-flex size-5 flex-none items-center justify-center rounded-full ${tone}`}>
      <Icon node={ok === null ? Minus : ok ? Check : X} class="size-3" />
    </span>
  )
}

function Thumb({ left, top }: { left: number; top: number }) {
  return (
    <i
      class="pointer-events-none absolute size-3.5 -translate-1/2 rounded-full border-2 border-white shadow-sm ring-1 ring-black/55"
      style={`left:${(left * 100).toFixed(2)}%;top:${(top * 100).toFixed(2)}%`}
    />
  )
}

export function SlotPopover({
  view,
  slot,
  format,
  where,
}: {
  view: ShareView
  slot: number
  format: SlotFormat
  where: boolean
}) {
  const s = view.slots[slot] as SlotView
  const value = s.formats[format]
  return (
    <div
      role="dialog"
      aria-label={`${s.name} ${s.hex}`}
      class="grid gap-3 rounded-2xl border border-border bg-popover p-3.5 text-popover-foreground shadow-lg motion-safe:animate-enter"
    >
      <div class="flex items-center gap-2.5">
        <i
          class="size-7 flex-none rounded-md ring-1 ring-border inset-ring inset-ring-black/14"
          style={`background:${s.hex}`}
        />
        <div class="grid min-w-0 flex-1">
          <span class="flex items-center gap-1.5 text-sm font-semibold">
            <span safe>{s.name}</span>
            <Marks signature={s.signature} miss={s.miss} />
          </span>
          <span class="font-mono text-xs text-muted-foreground" safe>
            {s.key}
          </span>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="close" data-slot-close>
          <Icon node={X} />
        </Button>
      </div>
      <div
        aria-hidden="true"
        class="relative flex h-32 flex-col overflow-hidden rounded-lg inset-ring inset-ring-black/12"
      >
        {planeRows(view, s).map((background) => (
          <div class="flex-1" style={`background:${background}`} />
        ))}
        <Thumb left={s.x} top={s.y} />
      </div>
      <div class="-mt-1 flex justify-between font-mono text-xs text-muted-foreground">
        <span safe>{`L ${s.lch[0]}`}</span>
        <span safe>{`C ${s.lch[1]}`}</span>
        <span safe>{`H ${s.lch[2]}`}</span>
      </div>
      <div
        aria-hidden="true"
        class="relative h-3 rounded-full inset-ring inset-ring-black/12"
        style={`background:${view.track}`}
      >
        <Thumb left={s.along} top={0.5} />
      </div>
      <ToggleGroup label="value format" class="grid w-full grid-cols-3">
        {FORMATS.map((name) => (
          <ToggleGroupItem name="slot-format" value={name} checked={name === format}>
            {name}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div class="flex h-10 items-center gap-2 rounded-lg border border-input pr-1 pl-3">
        <code data-value class="min-w-0 flex-1 truncate font-mono text-code" safe>
          {value}
        </code>
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
      <ul class="grid gap-1.5">
        {s.checks.map((check) => (
          <li class="flex items-start gap-2 text-xs text-soft-foreground">
            <Verdict ok={check.ok} />
            <span class="pt-0.5" safe>
              {check.text}
            </span>
          </li>
        ))}
      </ul>
      <p class="text-sm text-soft-foreground" safe>
        {s.use}
      </p>
      <p class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>shown in</span>
        {view.panes.map((name, i) => (
          <span>
            <span safe>{name}</span>{' '}
            <b class="font-mono font-semibold text-foreground" safe>
              {String(s.uses[i] ?? 0)}
            </b>
          </span>
        ))}
      </p>
      <button
        type="button"
        aria-pressed={String(where)}
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
    </div>
  )
}

function InspectorRow({ kind, slot, s, tag }: { kind: string; slot: number; s: SlotView; tag: string }) {
  return (
    <button
      type="button"
      data-slot-open={String(slot)}
      class="grid w-full grid-cols-[20px_48px_minmax(0,1fr)_auto] items-center gap-2.5 px-3 py-2 text-left outline-none hover:bg-muted focus-visible:bg-muted"
    >
      <i class="size-5 rounded-sm ring-1 ring-border inset-ring inset-ring-black/14" style={`background:${s.hex}`} />
      <span class="text-xs text-muted-foreground" safe>
        {kind}
      </span>
      <span class="flex min-w-0 items-center gap-1.5 font-medium">
        <span class="truncate" safe>
          {s.name}
        </span>
        {tag ? (
          <span class="rounded-full bg-muted px-1.5 text-2xs font-semibold text-soft-foreground" safe>
            {tag}
          </span>
        ) : null}
      </span>
      <span class="font-mono text-xs text-muted-foreground" safe>
        {s.key}
      </span>
    </button>
  )
}

export function InspectorPopover({
  view,
  text,
  ground,
  tag,
  ratio,
  snippet,
}: {
  view: ShareView
  text: number
  ground: number
  tag: string
  ratio: string
  snippet: string
}) {
  return (
    <div class="w-76 overflow-hidden rounded-xl border border-ring/55 bg-popover font-sans text-sm leading-snug text-popover-foreground shadow-lg">
      <div class="flex items-center justify-between gap-3 border-b border-border bg-muted px-3 py-2">
        <span class="text-2xs font-bold tracking-caps text-muted-foreground uppercase">slots</span>
        <span class="truncate font-mono text-xs text-soft-foreground" safe>
          {snippet}
        </span>
      </div>
      <InspectorRow kind="text" slot={text} s={view.slots[text] as SlotView} tag={tag} />
      <InspectorRow kind="ground" slot={ground} s={view.slots[ground] as SlotView} tag="" />
      <div class="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground">
        contrast
        <b class="font-mono font-semibold text-foreground" safe>
          {ratio}
        </b>
      </div>
    </div>
  )
}
