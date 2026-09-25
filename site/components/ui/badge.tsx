import { mergeProps } from '@base-ui/react/merge-props'
import { useRender } from '@base-ui/react/use-render'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'group/badge inline-flex w-fit shrink-0 items-center gap-1.5 overflow-hidden rounded-full px-2 py-0.75 text-2xs font-semibold tracking-wide whitespace-nowrap uppercase [&>svg]:pointer-events-none [&>svg]:size-2.75 [&>svg]:stroke-2',
  {
    variants: {
      variant: {
        outline: 'bg-muted/65 text-soft-foreground inset-ring inset-ring-border',
        count:
          'bg-muted/65 px-2.5 py-1 text-xs font-normal tracking-normal normal-case tabular-nums text-muted-foreground',
        preview:
          'bg-[color-mix(in_oklab,var(--bg)_82%,var(--fg))] text-(--fg) shadow-[0_0_0_1px_color-mix(in_oklab,var(--fg)_12%,transparent),0_0_0_4px_color-mix(in_oklab,var(--bg)_90%,transparent),0_0_10px_4px_color-mix(in_oklab,var(--bg)_60%,transparent)]',
        success: 'text-success inset-ring inset-ring-success/45',
        warning: 'text-warning inset-ring inset-ring-warning/45',
        destructive: 'text-destructive inset-ring inset-ring-destructive/45',
        sticker:
          'rotate-[-4deg] bg-primary px-2.5 py-1 font-display text-xs font-extrabold tracking-normal normal-case text-primary-foreground shadow-[0_3px_0_rgb(0_0_0/25%)]',
      },
    },
    defaultVariants: {
      variant: 'outline',
    },
  },
)

function Badge({
  className,
  variant = 'outline',
  render,
  ...props
}: useRender.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: 'span',
    props: mergeProps<'span'>(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props,
    ),
    render,
    state: {
      slot: 'badge',
      variant,
    },
  })
}

export { Badge, badgeVariants }
