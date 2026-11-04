import type { PropsWithChildren } from '@kitajs/html'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const meltCardVariants = cva(
  'relative isolate flex min-w-0 flex-col justify-end overflow-hidden bg-background text-foreground outline-none after:pointer-events-none after:absolute after:inset-0 after:z-3 after:rounded-[inherit] after:inset-ring after:inset-ring-foreground/13',
  {
    variants: {
      size: {
        tile: 'aspect-[14/11] rounded-2xl shadow-sm',
        cover: 'h-125 rounded-3xl shadow-sm',
        panel: 'rounded-3xl shadow-sm',
        feature: 'min-h-80 w-75 flex-none rounded-xl max-[880px]:hidden',
        preview: 'h-full min-h-64 rounded-xl',
      },
      lift: {
        true: 'transition-[translate,box-shadow,background-color] duration-200 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-safe:hover:-translate-y-0.5',
      },
    },
    defaultVariants: {
      size: 'panel',
    },
  },
)

type MeltCardProps = PropsWithChildren<
  VariantProps<typeof meltCardVariants> & Omit<JSX.HtmlTag, 'class'> & { class?: string }
>

function MeltCard({ class: className, size = 'panel', lift, ...props }: MeltCardProps) {
  return (
    <div data-slot="melt-card" data-size={size} class={cn(meltCardVariants({ size, lift }), className)} {...props} />
  )
}

type MeltLinkProps = PropsWithChildren<
  VariantProps<typeof meltCardVariants> & Omit<JSX.HtmlAnchorTag, 'class'> & { class?: string; href: string }
>

function MeltLink({ class: className, size = 'panel', lift = true, ...props }: MeltLinkProps) {
  return <a data-slot="melt-card" data-size={size} class={cn(meltCardVariants({ size, lift }), className)} {...props} />
}

export { MeltCard, MeltLink }
