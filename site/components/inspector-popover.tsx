import type { Named } from '@/lib/view-types'
import { Verdict } from './slot-list'

function InspectorRow({ kind, slot, s, tag }: { kind: string; slot: number; s: Named; tag: string }) {
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
  slots,
  text,
  ground,
  tag,
  ratio,
  snippet,
}: {
  slots: Named[]
  text: number
  ground: number
  tag: string
  ratio: number
  snippet: string
}) {
  const level = ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : null

  return (
    <div class="relative w-76 rounded-xl border border-ring/55 bg-popover font-sans text-sm leading-snug text-popover-foreground shadow-lg">
      <i
        data-arrow
        aria-hidden="true"
        class="absolute left-(--arrow-x) size-2.5 -translate-x-1/2 rotate-45 border-ring/55"
      />
      <div class="overflow-hidden rounded-xl">
        <div class="flex items-center justify-between gap-3 border-b border-border bg-muted px-3 py-2">
          <span class="text-2xs font-bold tracking-caps text-muted-foreground uppercase">slots</span>
          <span class="truncate font-mono text-xs text-soft-foreground" safe>
            {snippet}
          </span>
        </div>
        <InspectorRow kind="text" slot={text} s={slots[text] as Named} tag={tag} />
        <InspectorRow kind="ground" slot={ground} s={slots[ground] as Named} tag="" />
        <div class="flex items-center justify-between gap-3 border-t border-border px-3 py-2 text-xs text-muted-foreground">
          contrast
          <span class="flex items-center gap-2">
            <b class="font-mono font-semibold text-foreground" safe>
              {`${ratio.toFixed(2)}:1`}
            </b>
            <Verdict ok={level !== null} />
            <span class={level ? 'font-semibold text-success' : 'font-semibold text-destructive'}>
              {level ?? 'under 4.5:1'}
            </span>
          </span>
        </div>
      </div>
    </div>
  )
}
