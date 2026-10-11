import { palettePath, searchable } from '@/lib/gallery'
import { gatePassed } from '@/lib/sheet'
import type { GateRule, Theme } from '@/lib/themes'
import { cn } from '@/lib/utils'

function chipStyle(theme: Theme): string {
  return [
    `--bg:${theme.background}`,
    ...theme.signature.map((color, index) => `--sg${index}:${color}`),
    ...theme.ansi.map((color, index) => `--a${index}:${color}`),
  ].join(';')
}

export function PaletteChip({ theme }: { theme: Theme }) {
  return <span aria-hidden="true" data-slot="palette-chip" style={chipStyle(theme)} />
}

export function PaletteRow({ theme, gate, where = true }: { theme: Theme; gate: GateRule[]; where?: boolean }) {
  const found = searchable(theme)
  const passed = gatePassed(theme, gate)
  return (
    <a
      href={palettePath(theme)}
      data-row
      data-search={found.text}
      data-official={found.official}
      class="grid grid-cols-[minmax(0,1fr)_auto_3.5rem] items-center gap-4 border-b py-3 outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring max-[760px]:grid-cols-[minmax(0,1fr)_auto]"
    >
      <span class="flex min-w-0 items-baseline gap-2.5 max-[760px]:flex-col max-[760px]:gap-0.5">
        <span class="truncate font-display text-base font-extrabold" safe>
          {theme.name}
        </span>
        {where ? (
          <span class="truncate font-mono text-xs text-muted-foreground" safe>
            {theme.marketplace ? theme.id : (theme.catalog ?? '')}
          </span>
        ) : null}
      </span>
      <PaletteChip theme={theme} />
      <span
        class={cn(
          'text-right font-mono text-sm tabular-nums max-[760px]:hidden',
          passed === gate.length ? 'text-soft-foreground' : 'text-warning',
        )}
      >
        {passed}/{gate.length}
      </span>
    </a>
  )
}
