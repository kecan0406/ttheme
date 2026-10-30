import { Check, Copy } from 'lucide'
import { type SimpleIcon, siBun, siNpm } from 'simple-icons'
import { Button } from '@/components/ui/button'
import { Toggle } from '@/components/ui/toggle'
import { ToggleGroup } from '@/components/ui/toggle-group'
import { initOf } from '@/lib/gallery'
import { highlightHtml } from '@/lib/highlight'
import { BrandIcon, Icon } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { RUNNERS, type Runner } from '../../src/core/runner.ts'

const BOX = 'min-w-0 rounded-lg border bg-muted/65'

const BAR = 'flex h-11 min-w-0 items-center gap-0.5 pr-1.5 pl-4'

const LINE =
  'min-w-0 flex-1 overflow-x-auto pr-6 font-mono text-code leading-snug whitespace-nowrap [scrollbar-width:none]'

const LINE_SHOWN: Record<Runner, string> = {
  npx: 'in-data-[runner=bunx]:hidden',
  bunx: 'hidden in-data-[runner=bunx]:block',
}

const COPY_SHOWN: Record<Runner, string> = {
  npx: 'in-data-[runner=bunx]:hidden',
  bunx: 'hidden in-data-[runner=bunx]:inline-flex',
}

const TAB =
  'relative inline-flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 font-mono text-xs text-muted-foreground transition-colors duration-150 outline-none after:absolute after:inset-x-1.5 after:-bottom-px after:h-0.5 after:rounded-full hover:text-foreground focus-visible:inset-ring-2 focus-visible:inset-ring-ring'

const TAB_ON: Record<Runner, string> = {
  npx: 'not-in-data-[runner=bunx]:text-foreground not-in-data-[runner=bunx]:after:bg-primary',
  bunx: 'in-data-[runner=bunx]:text-foreground in-data-[runner=bunx]:after:bg-primary',
}

const MARKS: Record<Runner, SimpleIcon> = { npx: siNpm, bunx: siBun }

const INITS: Record<Runner, string> = { npx: initOf('npx'), bunx: initOf('bunx') }

function Line({ command, class: className }: { command: string; class?: string }) {
  const safeCommand = highlightHtml('sh', command)

  return (
    <pre translate="no" class={cn(LINE, className)}>
      <code class="select-all">{safeCommand}</code>
    </pre>
  )
}

function CopyButton({ command, class: className }: { command: string; class?: string }) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      class={cn('group/copy', className)}
      aria-label={`copy ${command}`}
      data-copy={command}
      data-copy-hold="1400"
      data-copy-status="copied (・ω・)"
    >
      <Icon node={Copy} class="group-data-copied/copy:hidden" />
      <Icon node={Check} class="hidden text-success group-data-copied/copy:block" />
    </Button>
  )
}

export function CommandRow({ command, class: className }: { command: string; class?: string }) {
  return (
    <div data-slot="command-row" data-highlight class={cn(BOX, BAR, className)}>
      <Line command={command} />
      <CopyButton command={command} />
    </div>
  )
}

export function RunnerRow({
  commands,
  class: className,
}: {
  commands: Readonly<Record<Runner, string>>
  class?: string
}) {
  return (
    <div data-slot="command-row" data-highlight class={cn(BOX, className)}>
      <ToggleGroup label="run with" data-runners class="flex h-8 min-w-0 items-stretch gap-1 border-b px-2.5">
        {RUNNERS.map((runner) => (
          <Toggle value={runner} pressed={runner === 'npx'} class={cn(TAB, TAB_ON[runner])}>
            <BrandIcon icon={MARKS[runner]} class="size-3" />
            <span>{runner}</span>
          </Toggle>
        ))}
      </ToggleGroup>
      <div class={BAR}>
        {RUNNERS.map((runner) => (
          <Line command={commands[runner]} class={LINE_SHOWN[runner]} />
        ))}
        {RUNNERS.map((runner) => (
          <CopyButton command={commands[runner]} class={COPY_SHOWN[runner]} />
        ))}
      </div>
    </div>
  )
}

export function InitRow({ class: className }: { class?: string }) {
  return <RunnerRow commands={INITS} class={className} />
}
