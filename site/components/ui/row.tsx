import type { PropsWithChildren } from '@kitajs/html'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const rowVariants = cva(
  "flex w-full min-w-0 items-center gap-2.5 rounded-lg border-y border-transparent bg-clip-padding px-2.5 text-left text-sm text-soft-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:inset-ring-2 focus-visible:inset-ring-ring aria-[current=page]:bg-accent aria-[current=page]:text-foreground aria-[current=page]:after:ml-auto aria-[current=page]:after:size-1.5 aria-[current=page]:after:flex-none aria-[current=page]:after:rounded-full aria-[current=page]:after:bg-primary aria-[current=page]:after:content-['']",
  {
    variants: {
      size: {
        sm: 'h-8 font-display font-extrabold',
        md: 'h-9 font-semibold',
        lg: 'h-11 font-semibold',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  },
)

type RowLinkProps = PropsWithChildren<
  VariantProps<typeof rowVariants> & Omit<JSX.HtmlAnchorTag, 'class'> & { class?: string; href: string }
>

function RowLink({ class: className, size, ...props }: RowLinkProps) {
  return <a data-slot="row" data-size={size ?? 'md'} class={cn(rowVariants({ size }), className)} {...props} />
}

export { RowLink, rowVariants }
