import { Monitor, Moon, Sun } from 'lucide'
import { Button } from '@/components/ui/button'
import { Icon } from '@/lib/icons'
import { cn } from '@/lib/utils'

const ITEMS = [
  { label: 'dark', icon: Moon, shown: 'in-data-[setting=dark]:flex' },
  { label: 'light', icon: Sun, shown: 'in-data-[setting=light]:flex' },
  { label: 'auto, follows the system', icon: Monitor, shown: 'in-data-[setting=auto]:flex' },
] as const satisfies readonly { label: string; icon: typeof Moon; shown: string }[]

export function ModeSwitch() {
  return (
    <mode-switch class="flex">
      <Button variant="outline" size="icon-round" class="shadow-sm">
        {ITEMS.map((item) => (
          <span class={cn('hidden size-full items-center justify-center', item.shown)}>
            <Icon node={item.icon} />
            <span class="sr-only">mode {item.label}</span>
          </span>
        ))}
      </Button>
    </mode-switch>
  )
}
