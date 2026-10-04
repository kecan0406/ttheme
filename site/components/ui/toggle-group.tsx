import type { PropsWithChildren } from '@kitajs/html'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const toggleVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-1.5 font-medium whitespace-nowrap transition-colors duration-150 outline-none has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-background has-disabled:pointer-events-none has-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          'min-h-8 rounded-full px-3 py-1 text-sm text-soft-foreground hover:bg-muted hover:text-foreground has-checked:bg-card has-checked:text-foreground has-checked:shadow-sm has-checked:ring-1 has-checked:ring-border',
        scene:
          'rounded-sm px-2.5 py-0.75 text-xs text-(--fg)/65 hover:bg-(--fg)/12 hover:text-(--fg) has-checked:bg-(--fg)/18 has-checked:text-(--fg) has-checked:inset-ring has-checked:inset-ring-(--fg)/22',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

type Variant = NonNullable<VariantProps<typeof toggleVariants>['variant']>

const GROUP: Record<Variant, string> = {
  default: 'rounded-full border border-border bg-muted/65',
  scene: 'rounded-lg border border-(--fg)/16 bg-(--fg)/9',
}

function ToggleGroup({
  class: className,
  variant = 'default',
  label,
  children,
}: PropsWithChildren<{ class?: string; variant?: Variant; label: string }>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      data-slot="toggle-group"
      data-variant={variant}
      class={cn('flex w-fit flex-wrap items-center gap-0.5 p-0.75', GROUP[variant], className)}
    >
      {children}
    </div>
  )
}

function ToggleGroupItem({
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
      data-slot="toggle-group-item"
      data-variant={variant}
      class={cn('shrink-0 has-focus-visible:z-10', toggleVariants({ variant }), className)}
    >
      <input type="radio" class="sr-only" name={name} value={value} checked={checked} aria-label={label} />
      {children}
    </label>
  )
}

export { ToggleGroup, ToggleGroupItem }
