import type { PropsWithChildren } from '@kitajs/html'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const tabVariants = cva(
  'inline-flex min-w-0 cursor-pointer items-center gap-2 text-sm whitespace-nowrap text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring aria-selected:text-foreground',
  {
    variants: {
      variant: {
        boxed: 'border-r border-border px-3 py-2 aria-selected:bg-background',
        underline:
          'relative flex-1 justify-center px-4 font-medium after:absolute after:inset-x-6 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary after:opacity-0 aria-selected:after:opacity-100',
        pill: 'h-7 rounded-md px-3.5 font-mono text-xs hover:bg-muted aria-selected:bg-muted aria-selected:inset-ring aria-selected:inset-ring-border',
      },
    },
    defaultVariants: {
      variant: 'boxed',
    },
  },
)

type TabProps = PropsWithChildren<
  VariantProps<typeof tabVariants> & Omit<JSX.HtmlButtonTag, 'class'> & { class?: string; selected: boolean }
>

function TabsList({ class: className, label, children }: PropsWithChildren<{ class?: string; label: string }>) {
  return (
    <div role="tablist" aria-label={label} data-slot="tabs-list" class={cn('flex min-w-0 items-stretch', className)}>
      {children}
    </div>
  )
}

function TabsTrigger({ class: className, variant = 'boxed', selected, ...props }: TabProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={String(selected)}
      tabindex={selected ? 0 : -1}
      data-slot="tabs-trigger"
      data-variant={variant}
      class={cn(tabVariants({ variant }), className)}
      {...props}
    />
  )
}

export { TabsList, TabsTrigger }
