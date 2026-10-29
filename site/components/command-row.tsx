import { Check, Copy, Terminal } from 'lucide'
import { Button } from '@/components/ui/button'
import { initOf } from '@/lib/gallery'
import { Icon } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { RUNNERS, type Runner } from '../../src/core/runner.ts'

const ROW = 'flex min-w-0 items-center gap-2.5 rounded-lg border bg-muted/65 py-1.5 pr-1.5 pl-3'

const CODE = 'min-w-0 flex-1 overflow-x-auto font-mono text-code leading-snug whitespace-nowrap select-all'

const CODE_SHOWN: Record<Runner, string> = {
  npx: 'in-data-[runner=bunx]:hidden',
  bunx: 'hidden in-data-[runner=bunx]:block',
}

const COPY_SHOWN: Record<Runner, string> = {
  npx: 'in-data-[runner=bunx]:hidden',
  bunx: 'hidden in-data-[runner=bunx]:inline-flex',
}

const RUNNER_CELL =
  'flex h-6 cursor-pointer items-center rounded-full px-2 font-mono text-xs text-soft-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:inset-ring-2 focus-visible:inset-ring-ring'

const RUNNER_ON: Record<Runner, string> = {
  npx: 'not-in-data-[runner=bunx]:bg-card not-in-data-[runner=bunx]:text-foreground not-in-data-[runner=bunx]:shadow-sm not-in-data-[runner=bunx]:ring-1 not-in-data-[runner=bunx]:ring-border',
  bunx: 'in-data-[runner=bunx]:bg-card in-data-[runner=bunx]:text-foreground in-data-[runner=bunx]:shadow-sm in-data-[runner=bunx]:ring-1 in-data-[runner=bunx]:ring-border',
}

function CopyButton({ command, class: className }: { command: string; class?: string }) {
  return (
    <Button
      variant="outline"
      size="icon-sm"
      class={cn('group/copy', className)}
      aria-label={`copy ${command}`}
      data-copy={command}
      data-copy-hold="1400"
      data-copy-status="copied (・ω・)"
    >
      <Icon node={Copy} class="group-data-copied/copy:hidden" />
      <Icon node={Check} class="hidden group-data-copied/copy:block" />
    </Button>
  )
}

export function CommandRow({
  command,
  text,
  class: className,
}: {
  command: string
  text?: JSX.Element
  class?: string
}) {
  return (
    <div data-slot="command-row" class={cn(ROW, className)}>
      <Icon node={Terminal} class="size-4 flex-none text-muted-foreground" />
      {text ? (
        <code translate="no" class={CODE}>
          {text}
        </code>
      ) : (
        <code translate="no" class={CODE} safe>
          {command}
        </code>
      )}
      <CopyButton command={command} />
    </div>
  )
}

export function InitRow({ class: className }: { class?: string }) {
  return (
    <div data-slot="command-row" class={cn(ROW, className)}>
      <Icon node={Terminal} class="size-4 flex-none text-muted-foreground" />
      {RUNNERS.map((runner) => (
        <code translate="no" class={cn(CODE, CODE_SHOWN[runner])} safe>
          {initOf(runner)}
        </code>
      ))}
      <fieldset
        aria-label="run with"
        data-slot="runner-switch"
        class="flex h-7.5 flex-none items-center gap-0.5 rounded-full border border-border bg-muted p-0.5"
      >
        {RUNNERS.map((runner) => (
          <button
            type="button"
            data-runner-to={runner}
            aria-pressed={String(runner === 'npx')}
            title={`run with ${runner}`}
            class={cn(RUNNER_CELL, RUNNER_ON[runner])}
          >
            {runner}
          </button>
        ))}
      </fieldset>
      {RUNNERS.map((runner) => (
        <CopyButton command={initOf(runner)} class={COPY_SHOWN[runner]} />
      ))}
    </div>
  )
}
