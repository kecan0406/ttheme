import type { PropsWithChildren } from '@kitajs/html'
import { cn } from '@/lib/utils'

type TabProps = PropsWithChildren<Omit<JSX.HtmlButtonTag, 'class'> & { class?: string; selected: boolean }>

function TabsList({ class: className, label, children }: PropsWithChildren<{ class?: string; label: string }>) {
  return (
    <div role="tablist" aria-label={label} data-slot="tabs-list" class={cn('flex min-w-0 items-stretch', className)}>
      {children}
    </div>
  )
}

function TabsTrigger({ class: className, selected, ...props }: TabProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={String(selected)}
      tabindex={selected ? 0 : -1}
      data-slot="tabs-trigger"
      class={cn(
        'inline-flex min-w-0 cursor-pointer items-center gap-2 border-r border-border px-3 py-2 text-sm whitespace-nowrap text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring aria-selected:bg-background aria-selected:text-foreground',
        className,
      )}
      {...props}
    />
  )
}

export { TabsList, TabsTrigger }
