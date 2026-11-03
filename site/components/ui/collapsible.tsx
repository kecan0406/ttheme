import type { PropsWithChildren } from '@kitajs/html'
import type { VariantProps } from 'class-variance-authority'
import { rowVariants } from '@/components/ui/row'
import { cn } from '@/lib/utils'

type PartProps = PropsWithChildren<Omit<JSX.HtmlTag, 'class'> & { class?: string }>

function Collapsible({ open = false, ...props }: PartProps & { open?: boolean }) {
  return <details data-slot="collapsible" open={open} data-open={open} data-closed={!open} {...props} />
}

function CollapsibleTrigger({
  class: className,
  row,
  ...props
}: PartProps & { row?: VariantProps<typeof rowVariants>['size'] }) {
  return (
    <summary
      data-slot="collapsible-trigger"
      class={cn(
        'cursor-pointer list-none [&::-webkit-details-marker]:hidden',
        row ? rowVariants({ size: row }) : null,
        className,
      )}
      {...props}
    />
  )
}

function CollapsiblePanel(props: PartProps) {
  return <div data-slot="collapsible-panel" {...props} />
}

export { Collapsible, CollapsiblePanel, CollapsibleTrigger }
