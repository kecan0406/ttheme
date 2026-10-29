import { escapeHtml, type PropsWithChildren } from '@kitajs/html'
import { Check, ChevronDown, Minus, X } from 'lucide'
import { Badge } from '@/components/ui/badge'
import { Icon } from '@/lib/icons'
import type { GateLine } from '@/lib/view-types'
import { reading } from './palette-parts'

export function Marks({ miss }: { miss: boolean }) {
  return miss ? (
    <span class="text-xs leading-none font-bold text-destructive">
      <span aria-hidden="true">✗</span>
      <span class="sr-only">fails a contrast check</span>
    </span>
  ) : null
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

export function Group({ name, count, children }: PropsWithChildren<{ name: string; count: string }>) {
  return (
    <details open data-group={name} class="group/group border-b border-border">
      <summary class="flex h-10 cursor-pointer list-none items-center gap-2 px-4 text-2xs font-bold tracking-caps text-muted-foreground uppercase outline-none select-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
        <span safe>{name}</span>
        <span
          class="inline-flex h-4.5 items-center rounded-sm border border-border px-1.5 font-mono font-medium tracking-normal normal-case"
          safe
        >
          {count}
        </span>
        <Icon node={ChevronDown} class="ml-auto size-3.5 -rotate-90 transition-transform group-open/group:rotate-0" />
      </summary>
      {children}
    </details>
  )
}

export function Swatch({ hex, size }: { hex: string; size: 'row' | 'cell' }) {
  return (
    <i
      class={`flex-none ring-1 ring-border inset-ring inset-ring-black/14 ${size === 'row' ? 'size-9 rounded-md' : 'size-6 rounded-sm'}`}
      style={`background:${hex}`}
    />
  )
}

export function GateRows({ lines, names }: { lines: GateLine[]; names: string[] }) {
  return (
    <ul class="grid pb-2">
      {lines.map(({ rule, value, ok, slots }) => {
        const floor = Number.isNaN(value)
          ? 'n/a'
          : rule.min !== undefined
            ? ok
              ? `≥ ${rule.min}`
              : `under ${rule.min}`
            : ok
              ? `≤ ${rule.max}`
              : `over ${rule.max}`

        const named = [...new Set(slots)].map((slot) => names[slot] ?? '').join(', ')

        return (
          <li class="grid grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1 py-2 pr-3 pl-4">
            <Verdict ok={ok} />
            <span class="text-sm text-soft-foreground" safe>
              {rule.label}
            </span>
            <span class="inline-flex items-center gap-2">
              <code class="font-mono text-xs tabular-nums" safe>
                {Number.isNaN(value) ? '—' : reading(value, rule.unit)}
              </code>
              <Badge variant={Number.isNaN(value) ? 'outline' : ok ? 'success' : 'warning'}>{escapeHtml(floor)}</Badge>
            </span>
            {slots.length > 0 ? (
              <button
                type="button"
                data-slot-open={String(slots[0])}
                class="col-span-2 col-start-2 justify-self-start rounded-sm text-xs font-semibold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                safe
              >
                {`${named} →`}
              </button>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
