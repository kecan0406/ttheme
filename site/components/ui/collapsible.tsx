import type { PropsWithChildren } from '@kitajs/html'
import { cn } from '@/lib/utils'

type PartProps = PropsWithChildren<Omit<JSX.HtmlTag, 'class'> & { class?: string }>

function Collapsible({ open = false, ...props }: PartProps & { open?: boolean }) {
  return <details data-slot="collapsible" open={open} data-open={open} data-closed={!open} {...props} />
}

function CollapsibleTrigger({ class: className, ...props }: PartProps) {
  return (
    <summary
      data-slot="collapsible-trigger"
      class={cn('cursor-pointer list-none [&::-webkit-details-marker]:hidden', className)}
      {...props}
    />
  )
}

function CollapsiblePanel(props: PartProps) {
  return <div data-slot="collapsible-panel" {...props} />
}

export { Collapsible, CollapsiblePanel, CollapsibleTrigger }
