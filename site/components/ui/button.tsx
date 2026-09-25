import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-transparent bg-clip-padding text-sm font-semibold whitespace-nowrap transition-[background-color,color,border-color,box-shadow,transform] duration-150 outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:not-aria-[haspopup]:scale-98 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/88 hover:shadow-md',
        outline:
          'border-border bg-card text-soft-foreground hover:border-input hover:bg-secondary hover:text-foreground aria-expanded:bg-secondary aria-pressed:border-primary aria-pressed:text-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-muted',
        ghost: 'text-soft-foreground hover:bg-muted hover:text-foreground aria-expanded:bg-muted',
        destructive: 'bg-destructive/16 text-destructive hover:bg-destructive/24',
        link: 'font-medium text-primary underline-offset-4 hover:underline',
        pop: 'bg-primary text-primary-foreground shadow-[0_4px_0_color-mix(in_oklab,var(--primary)_62%,black)] transition-[transform,box-shadow] duration-75 hover:brightness-105 active:translate-y-1 active:scale-100 active:shadow-none',
      },
      size: {
        default: 'h-9 px-4.5',
        lg: 'h-11 px-6 text-base',
        sm: 'h-7.5 px-3',
        icon: 'size-9',
        'icon-sm': 'size-7.5',
        'icon-round': 'size-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
