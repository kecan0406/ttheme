'use client'

import { Toggle as TogglePrimitive } from '@base-ui/react/toggle'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const toggleVariants = cva(
  "inline-flex items-center justify-center gap-1.5 font-medium whitespace-nowrap transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          'min-h-8 rounded-full px-3 py-1 text-sm text-soft-foreground hover:bg-muted hover:text-foreground data-pressed:bg-card data-pressed:text-foreground data-pressed:shadow-sm data-pressed:ring-1 data-pressed:ring-border',
        scene:
          'rounded-sm px-2.5 py-0.75 text-xs text-(--fg)/65 hover:bg-(--fg)/12 hover:text-(--fg) data-pressed:bg-(--fg)/18 data-pressed:text-(--fg) data-pressed:inset-ring data-pressed:inset-ring-(--fg)/22',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Toggle({
  className,
  variant = 'default',
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  return <TogglePrimitive data-slot="toggle" className={cn(toggleVariants({ variant, className }))} {...props} />
}

export { Toggle, toggleVariants }
