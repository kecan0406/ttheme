import { Check, Copy } from 'lucide'
import { type SimpleIcon, siBun, siFishshell, siGnubash, siNpm, siZsh } from 'simple-icons'
import { Button } from '@/components/ui/button'
import { Toggle } from '@/components/ui/toggle'
import { ToggleGroup } from '@/components/ui/toggle-group'
import type { Choice } from '@/lib/choice'
import { initOf } from '@/lib/gallery'
import { highlightHtml } from '@/lib/highlight'
import { BrandIcon, Icon } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { RUNNERS, type Runner } from '../../src/core/runner.ts'
import { SHELLS, type Shell } from '../../src/core/shell.ts'

const BOX = 'min-w-0 rounded-lg border bg-muted/65'

const BAR = 'flex h-11 min-w-0 items-center gap-0.5 pr-1.5 pl-4'

const LINE =
  'min-w-0 flex-1 overflow-x-auto pr-6 font-mono text-code leading-snug whitespace-nowrap [scrollbar-width:none]'

export type Tabbed<V extends string> = {
  name: Choice
  label: string
  values: readonly V[]
  marks: Readonly<Record<V, SimpleIcon>>
  line: Readonly<Record<V, string>>
  copy: Readonly<Record<V, string>>
  on: Readonly<Record<V, string>>
}

const TAB =
  'relative inline-flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 font-mono text-xs text-muted-foreground transition-colors duration-150 outline-none after:absolute after:inset-x-1.5 after:-bottom-px after:h-0.5 after:rounded-full hover:text-foreground focus-visible:inset-ring-2 focus-visible:inset-ring-ring'

const RUNNER_TABS: Tabbed<Runner> = {
  name: 'runner',
  label: 'run with',
  values: RUNNERS,
  marks: { npx: siNpm, bunx: siBun },
  line: { npx: 'in-data-[runner]:hidden', bunx: 'hidden in-data-[runner=bunx]:block' },
  copy: { npx: 'in-data-[runner]:hidden', bunx: 'hidden in-data-[runner=bunx]:inline-flex' },
  on: {
    npx: 'not-in-data-[runner]:text-foreground not-in-data-[runner]:after:bg-primary',
    bunx: 'in-data-[runner=bunx]:text-foreground in-data-[runner=bunx]:after:bg-primary',
  },
}

const SHELL_TABS: Tabbed<Shell> = {
  name: 'shell',
  label: 'your shell',
  values: SHELLS,
  marks: { zsh: siZsh, bash: siGnubash, fish: siFishshell },
  line: {
    zsh: 'in-data-[shell]:hidden',
    bash: 'hidden in-data-[shell=bash]:block',
    fish: 'hidden in-data-[shell=fish]:block',
  },
  copy: {
    zsh: 'in-data-[shell]:hidden',
    bash: 'hidden in-data-[shell=bash]:inline-flex',
    fish: 'hidden in-data-[shell=fish]:inline-flex',
  },
  on: {
    zsh: 'not-in-data-[shell]:text-foreground not-in-data-[shell]:after:bg-primary',
    bash: 'in-data-[shell=bash]:text-foreground in-data-[shell=bash]:after:bg-primary',
    fish: 'in-data-[shell=fish]:text-foreground in-data-[shell=fish]:after:bg-primary',
  },
}

export const TABBED: readonly Tabbed<string>[] = [RUNNER_TABS, SHELL_TABS]

const INITS: Record<Runner, string> = { npx: initOf('npx'), bunx: initOf('bunx') }

function Line({ command, class: className }: { command: string; class?: string }) {
  const safeCommand = highlightHtml('sh', command)

  return (
    <pre tabindex="0" translate="no" class={cn(LINE, className)}>
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

function ChoiceTabs<V extends string>({ tabs, class: className }: { tabs: Tabbed<V>; class?: string }) {
  return (
    <ToggleGroup
      label={tabs.label}
      data-choice={tabs.name}
      class={cn('flex h-8 min-w-0 items-stretch gap-1 px-2.5', className)}
    >
      {tabs.values.map((value) => (
        <Toggle value={value} pressed={value === tabs.values[0]} class={cn(TAB, tabs.on[value])}>
          <BrandIcon icon={tabs.marks[value]} class="size-3" />
          <span safe>{value}</span>
        </Toggle>
      ))}
    </ToggleGroup>
  )
}

function ChoiceLines<V extends string>({ tabs, commands }: { tabs: Tabbed<V>; commands: Readonly<Record<V, string>> }) {
  return (
    <>
      {tabs.values.map((value) => (
        <Line command={commands[value]} class={tabs.line[value]} />
      ))}
      {tabs.values.map((value) => (
        <CopyButton command={commands[value]} class={tabs.copy[value]} />
      ))}
    </>
  )
}

export function ChoiceRow<V extends string>({
  tabs,
  commands,
  class: className,
}: {
  tabs: Tabbed<V>
  commands: Readonly<Record<V, string>>
  class?: string
}) {
  return (
    <div data-slot="command-row" data-highlight class={cn(BOX, className)}>
      <ChoiceTabs tabs={tabs} class="border-b" />
      <div class={BAR}>
        <ChoiceLines tabs={tabs} commands={commands} />
      </div>
    </div>
  )
}

export function InitRow({ class: className }: { class?: string }) {
  return <ChoiceRow tabs={RUNNER_TABS} commands={INITS} class={className} />
}
