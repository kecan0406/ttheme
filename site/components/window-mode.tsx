import { Moon, Sun } from 'lucide'
import { Icon } from '@/lib/icons'
import type { Mode } from '@/lib/mode'
import { cn } from '@/lib/utils'

const CELLS = [
  {
    mode: 'dark',
    icon: Moon,
    on: 'in-data-[mode=dark]:bg-(--fg)/16 in-data-[mode=dark]:text-(--fg)',
  },
  {
    mode: 'light',
    icon: Sun,
    on: 'in-data-[mode=light]:bg-(--fg)/16 in-data-[mode=light]:text-(--fg)',
  },
] as const satisfies readonly { mode: Mode; icon: typeof Moon; on: string }[]

export function WindowMode({ class: className }: { class?: string }) {
  return (
    <fieldset
      aria-label="color mode"
      data-slot="window-mode"
      class={cn('flex h-7.5 min-w-0 flex-none items-center gap-0.5 rounded-full bg-(--fg)/8 p-0.5', className)}
    >
      {CELLS.map((cell) => (
        <button
          type="button"
          data-mode-to={cell.mode}
          aria-label={cell.mode}
          aria-pressed="false"
          title={cell.mode}
          class={cn(
            'flex h-full w-8 cursor-pointer items-center justify-center rounded-full text-(--fg)/62 transition-colors duration-150 outline-none hover:text-(--fg) focus-visible:inset-ring-2 focus-visible:inset-ring-ring',
            cell.on,
          )}
        >
          <Icon node={cell.icon} class="size-3.5" />
        </button>
      ))}
    </fieldset>
  )
}
