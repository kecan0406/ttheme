import type { PropsWithChildren } from '@kitajs/html'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const radioVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-1.5 font-medium whitespace-nowrap transition-colors duration-150 outline-none has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-background has-disabled:pointer-events-none has-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          'min-h-8 rounded-full px-3 py-1 text-sm text-soft-foreground hover:bg-muted hover:text-foreground has-checked:bg-card has-checked:text-foreground has-checked:shadow-sm has-checked:ring-1 has-checked:ring-border',
        tab: 'relative min-w-0 flex-1 rounded-md px-3 text-xs text-(--fg)/62 before:absolute before:top-1/2 before:left-0 before:h-3.5 before:w-px before:-translate-y-1/2 before:bg-(--fg)/16 first:before:hidden hover:text-(--fg) has-checked:bg-(--fg)/16 has-checked:text-(--fg) has-checked:shadow-sm has-checked:before:hidden has-focus-visible:ring-0 has-focus-visible:ring-offset-0 has-focus-visible:inset-ring-2 has-focus-visible:inset-ring-ring [:has(:checked)+&]:before:hidden [&>[data-mark]]:text-(--fg)/30 has-checked:[&>[data-mark]]:text-(--a5)',
        underline:
          'relative -mb-px px-0.5 pb-3 text-sm text-soft-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary after:opacity-0 hover:text-foreground has-checked:text-foreground has-checked:after:opacity-100',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

type Variant = NonNullable<VariantProps<typeof radioVariants>['variant']>

const GROUP: Record<Variant, string> = {
  default: 'rounded-full border border-border bg-muted/65',
  tab: 'h-7.5 w-auto min-w-0 flex-1 flex-nowrap items-stretch gap-0 rounded-lg bg-(--fg)/6 p-0.5',
  underline: 'w-full gap-6 border-b border-border p-0',
}

function RadioGroup({
  class: className,
  variant = 'default',
  label,
  children,
}: PropsWithChildren<{ class?: string; variant?: Variant; label: string }>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      data-slot="radio-group"
      data-variant={variant}
      class={cn('flex w-fit flex-wrap items-center gap-0.5 p-0.75', GROUP[variant], className)}
    >
      {children}
    </div>
  )
}

function RadioGroupItem({
  class: className,
  variant = 'default',
  name,
  value,
  checked,
  label,
  children,
}: PropsWithChildren<{
  class?: string
  variant?: Variant
  name: string
  value: string
  checked?: boolean
  label?: string
}>) {
  return (
    <label
      data-slot="radio-group-item"
      data-variant={variant}
      class={cn('shrink-0 has-focus-visible:z-10', radioVariants({ variant }), className)}
    >
      <input type="radio" class="sr-only" name={name} value={value} checked={checked} aria-label={label} />
      {children}
    </label>
  )
}

function RadioGroupCount({
  class: className,
  ...props
}: PropsWithChildren<Omit<JSX.HtmlTag, 'class'> & { class?: string }>) {
  return (
    <span
      data-slot="radio-group-count"
      class={cn(
        'min-w-5 rounded-full bg-muted px-1.5 text-center font-mono text-xs leading-4.5 text-muted-foreground tabular-nums',
        className,
      )}
      {...props}
    />
  )
}

export { RadioGroup, RadioGroupCount, RadioGroupItem }
