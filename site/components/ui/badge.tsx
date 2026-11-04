import type { PropsWithChildren } from '@kitajs/html'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'group/badge inline-flex w-fit shrink-0 items-center gap-1.5 overflow-hidden rounded-full px-2 py-0.75 text-2xs font-semibold tracking-wide whitespace-nowrap uppercase [&>svg]:pointer-events-none [&>svg]:size-2.75 [&>svg]:stroke-2',
  {
    variants: {
      variant: {
        outline: 'bg-muted/65 text-soft-foreground inset-ring inset-ring-border',
        tag: 'px-2.5 py-1 text-xs font-medium tracking-normal normal-case text-soft-foreground inset-ring inset-ring-border',
        glass:
          'bg-glass px-2.5 py-1 text-xs font-medium tracking-normal normal-case text-foreground inset-ring inset-ring-foreground/14 backdrop-blur-[14px] backdrop-saturate-130',
        success: 'text-success inset-ring inset-ring-success/45',
        warning: 'text-warning inset-ring inset-ring-warning/45',
        destructive: 'text-destructive inset-ring inset-ring-destructive/45',
      },
    },
    defaultVariants: {
      variant: 'outline',
    },
  },
)

type BadgeProps = PropsWithChildren<
  VariantProps<typeof badgeVariants> & Omit<JSX.HtmlTag, 'class'> & { class?: string }
>

function Badge({ class: className, variant = 'outline', ...props }: BadgeProps) {
  return <span data-slot="badge" data-variant={variant} class={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge }
