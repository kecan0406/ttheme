import { Check, Copy, Terminal } from 'lucide'
import { Button } from '@/components/ui/button'
import { Icon } from '@/lib/icons'
import { cn } from '@/lib/utils'

export function CommandRow({ command, class: className }: { command: string; class?: string }) {
  return (
    <div
      data-slot="command-row"
      class={cn('flex min-w-0 items-center gap-2.5 rounded-lg border bg-muted/65 py-1.5 pr-1.5 pl-3', className)}
    >
      <Icon node={Terminal} class="size-4 flex-none text-muted-foreground" />
      <code class="min-w-0 flex-1 overflow-x-auto font-mono text-code leading-snug whitespace-nowrap" safe>
        {command}
      </code>
      <Button
        variant="outline"
        size="icon-sm"
        class="group/copy"
        aria-label={`copy ${command}`}
        data-copy={command}
        data-copy-hold="1400"
        data-copy-status="copied (・ω・)"
      >
        <Icon node={Copy} class="group-data-copied/copy:hidden" />
        <Icon node={Check} class="hidden group-data-copied/copy:block" />
      </Button>
    </div>
  )
}
