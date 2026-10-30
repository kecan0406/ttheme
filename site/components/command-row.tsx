import { Check, Copy } from 'lucide'
import { type SimpleIcon, siBun, siNpm } from 'simple-icons'
import { Button } from '@/components/ui/button'
import { initOf } from '@/lib/gallery'
import { highlightHtml } from '@/lib/highlight'
import { BrandIcon, Icon } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { RUNNERS, type Runner } from '../../src/core/runner.ts'

const ROW = 'flex h-11 min-w-0 items-center gap-0.5 rounded-lg border bg-muted/65 pr-1.5 pl-4'

const LINE =
  'min-w-0 flex-1 overflow-x-auto pr-6 font-mono text-code leading-snug whitespace-nowrap [scrollbar-width:none]'

const LINE_SHOWN: Record<Runner, string> = {
  npx: 'in-data-[runner=bunx]:hidden',
  bunx: 'hidden in-data-[runner=bunx]:block',
}

const BUTTON_SHOWN: Record<Runner, string> = {
  npx: 'in-data-[runner=bunx]:hidden',
  bunx: 'hidden in-data-[runner=bunx]:inline-flex',
}

const OTHER: Record<Runner, Runner> = { npx: 'bunx', bunx: 'npx' }

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
      data-tip="copy"
      data-copy={command}
      data-copy-hold="1400"
      data-copy-status="copied (・ω・)"
    >
      <Icon node={Copy} class="group-data-copied/copy:hidden" />
      <Icon node={Check} class="hidden text-success group-data-copied/copy:block" />
    </Button>
  )
}

function RunnerButton({ runner, class: className }: { runner: Runner; class?: string }) {
  const other = OTHER[runner]

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      class={className}
      aria-label={`run with ${runner}, switch to ${other}`}
      data-tip={`switch to ${other}`}
      data-runner-to={other}
    >
      <BrandIcon icon={MARKS[runner]} class="size-3.5" />
    </Button>
  )
}

export function CommandRow({ command, class: className }: { command: string; class?: string }) {
  return (
    <div data-slot="command-row" data-highlight class={cn(ROW, className)}>
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
    <div data-slot="command-row" data-highlight class={cn(ROW, className)}>
      {RUNNERS.map((runner) => (
        <Line command={commands[runner]} class={LINE_SHOWN[runner]} />
      ))}
      {RUNNERS.map((runner) => (
        <RunnerButton runner={runner} class={BUTTON_SHOWN[runner]} />
      ))}
      {RUNNERS.map((runner) => (
        <CopyButton command={commands[runner]} class={BUTTON_SHOWN[runner]} />
      ))}
    </div>
  )
}

export function InitRow({ class: className }: { class?: string }) {
  return <RunnerRow commands={INITS} class={className} />
}
