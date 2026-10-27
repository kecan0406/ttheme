import type { PropsWithChildren } from '@kitajs/html'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const popoverVariants = cva(
  'm-0 hidden max-h-[min(640px,calc(100dvh-120px))] w-[min(400px,calc(100vw-32px))] flex-col overflow-y-auto rounded-xl border border-border bg-popover text-popover-foreground shadow-lg inset-auto open:flex',
  {
    variants: {
      inset: {
        none: '',
        padded: 'gap-3 p-4',
      },
    },
    defaultVariants: {
      inset: 'none',
    },
  },
)

type PopoverProps = PropsWithChildren<
  VariantProps<typeof popoverVariants> & Omit<JSX.HtmlTag, 'class'> & { class?: string; id: string; label: string }
>

function Popover({ class: className, inset = 'none', label, ...props }: PopoverProps) {
  return (
    <div
      popover="auto"
      role="dialog"
      aria-label={label}
      data-slot="popover"
      data-inset={inset}
      class={cn(popoverVariants({ inset, className }))}
      {...props}
    />
  )
}

export { Popover }
