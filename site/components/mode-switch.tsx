import { Monitor, Moon, Sun } from 'lucide'
import { Icon } from '@/lib/icons'
import type { Setting } from '@/lib/mode'
import { cn } from '@/lib/utils'

const ITEMS = [
  {
    value: 'dark',
    label: 'dark',
    icon: Moon,
    on: 'in-data-[setting=dark]:bg-accent in-data-[setting=dark]:text-foreground',
  },
  {
    value: 'light',
    label: 'light',
    icon: Sun,
    on: 'in-data-[setting=light]:bg-accent in-data-[setting=light]:text-foreground',
  },
  {
    value: 'auto',
    label: 'auto, follows the system',
    icon: Monitor,
    on: 'in-data-[setting=auto]:bg-accent in-data-[setting=auto]:text-foreground',
  },
] as const satisfies readonly { value: Setting; label: string; icon: typeof Moon; on: string }[]

export function ModeSwitch() {
  return (
    <mode-switch
      role="radiogroup"
      aria-label="mode"
      class="flex max-[720px]:grid max-[720px]:grid-cols-3 max-[720px]:border-t max-[720px]:border-border"
    >
      {ITEMS.map((item) => (
        <label
          title={item.label}
          data-mode-item={item.value}
          class={cn(
            'relative flex h-full w-8 cursor-pointer items-center justify-center border-l border-border text-soft-foreground transition-colors duration-150 hover:bg-muted/65 hover:text-foreground has-focus-visible:inset-ring-2 has-focus-visible:inset-ring-ring max-[720px]:h-8 max-[720px]:w-auto max-[720px]:first:border-l-0',
            item.on,
          )}
        >
          <input type="radio" class="sr-only" name="mode" value={item.value} aria-label={item.label} />
          <Icon node={item.icon} class="size-4" />
        </label>
      ))}
    </mode-switch>
  )
}
