import { Moon, RotateCcw, Sun } from 'lucide'
import { Toggle } from '@/components/ui/toggle'
import { ToggleGroup } from '@/components/ui/toggle-group'
import { Icon } from '@/lib/icons'
import type { Mode } from '@/lib/mode'
import { cn } from '@/lib/utils'

const CELLS = [
  {
    mode: 'dark',
    icon: Moon,
    on: 'not-in-data-[window-mode]:in-data-[mode=dark]:bg-(--fg)/16 not-in-data-[window-mode]:in-data-[mode=dark]:text-(--fg) in-data-[window-mode=dark]:bg-(--cu) in-data-[window-mode=dark]:text-(--bg)',
  },
  {
    mode: 'light',
    icon: Sun,
    on: 'not-in-data-[window-mode]:in-data-[mode=light]:bg-(--fg)/16 not-in-data-[window-mode]:in-data-[mode=light]:text-(--fg) in-data-[window-mode=light]:bg-(--cu) in-data-[window-mode=light]:text-(--bg)',
  },
] as const satisfies readonly { mode: Mode; icon: typeof Moon; on: string }[]

const CELL =
  'h-full w-8 cursor-pointer items-center justify-center rounded-full text-(--fg)/62 transition-colors duration-150 outline-none hover:text-(--fg) focus-visible:inset-ring-2 focus-visible:inset-ring-ring'

export function WindowMode({ class: className }: { class?: string }) {
  return (
    <ToggleGroup
      label="terminal mode"
      data-window-modes
      class={cn('flex h-7.5 min-w-0 flex-none items-center gap-0.5 rounded-full bg-(--fg)/8 p-0.5', className)}
    >
      <button
        type="button"
        data-mode-reset
        aria-label="follow the page"
        title="follow the page"
        class={cn(CELL, 'hidden in-data-[window-mode]:flex')}
      >
        <Icon node={RotateCcw} class="size-3.5" />
      </button>
      {CELLS.map((cell) => (
        <Toggle value={cell.mode} aria-label={cell.mode} title={cell.mode} class={cn(CELL, 'flex', cell.on)}>
          <Icon node={cell.icon} class="size-3.5" />
        </Toggle>
      ))}
    </ToggleGroup>
  )
}
