import type { PropsWithChildren } from '@kitajs/html'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const tabVariants = cva(
  'inline-flex min-w-0 cursor-pointer items-center gap-2 text-sm whitespace-nowrap text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring aria-selected:text-foreground',
  {
    variants: {
      variant: {
        underline:
          'relative flex-1 justify-center px-4 font-medium after:absolute after:inset-x-6 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary after:opacity-0 aria-selected:after:opacity-100',
        track:
          'relative flex-1 justify-center gap-1.5 rounded-md px-3 text-xs font-medium text-(--fg)/62 before:absolute before:top-1/2 before:left-0 before:h-3.5 before:w-px before:-translate-y-1/2 before:bg-(--fg)/16 first:before:hidden hover:text-(--fg) aria-selected:bg-(--fg)/16 aria-selected:text-(--fg) aria-selected:shadow-sm aria-selected:before:hidden [[aria-selected=true]+&]:before:hidden [&>[data-mark]]:text-(--fg)/30 aria-selected:[&>[data-mark]]:text-(--a5)',
        nav: 'relative gap-1.5 px-2.5 font-medium text-soft-foreground after:absolute after:inset-x-2.5 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary after:opacity-0 aria-selected:after:opacity-100 [&>svg]:size-4 [&>svg]:flex-none',
      },
    },
    defaultVariants: {
      variant: 'underline',
    },
  },
)

type TabProps = PropsWithChildren<
  VariantProps<typeof tabVariants> & Omit<JSX.HtmlButtonTag, 'class'> & { class?: string; selected: boolean }
>

const LISTS = {
  plain: '',
  track: 'h-7.5 rounded-lg bg-(--fg)/6 p-0.5',
}

function TabsList({
  class: className,
  variant = 'plain',
  label,
  children,
}: PropsWithChildren<{ class?: string; variant?: keyof typeof LISTS; label: string }>) {
  return (
    <div
      role="tablist"
      aria-label={label}
      data-slot="tabs-list"
      data-variant={variant}
      class={cn('flex min-w-0 items-stretch', LISTS[variant], className)}
    >
      {children}
    </div>
  )
}

function TabsTrigger({ class: className, variant = 'underline', selected, ...props }: TabProps) {
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

function TabsCount({ class: className, ...props }: PropsWithChildren<Omit<JSX.HtmlTag, 'class'> & { class?: string }>) {
  return (
    <span
      data-slot="tabs-count"
      class={cn(
        'min-w-4.5 rounded-full bg-muted px-1 text-center font-mono text-2xs leading-4.5 text-muted-foreground tabular-nums',
        className,
      )}
      {...props}
    />
  )
}

export { TabsCount, TabsList, TabsTrigger }
