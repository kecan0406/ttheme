import { Accordion as AccordionPrimitive } from '@base-ui/react/accordion'

import { cn } from '@/lib/utils'

function Accordion({ className, ...props }: AccordionPrimitive.Root.Props) {
  return <AccordionPrimitive.Root data-slot="accordion" className={cn('flex w-full flex-col', className)} {...props} />
}

function AccordionItem({ className, ...props }: AccordionPrimitive.Item.Props) {
  return <AccordionPrimitive.Item data-slot="accordion-item" className={className} {...props} />
}

function AccordionTrigger({ className, ...props }: AccordionPrimitive.Trigger.Props) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          'flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md px-2 py-[7px] text-left whitespace-nowrap transition-colors outline-none hover:not-data-disabled:bg-card focus-visible:outline-2 focus-visible:-outline-offset-2 data-disabled:cursor-default aria-disabled:pointer-events-none',
          className,
        )}
        {...props}
      />
    </AccordionPrimitive.Header>
  )
}

function AccordionContent({ className, children, ...props }: AccordionPrimitive.Panel.Props) {
  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-content"
      className="h-(--accordion-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none"
      {...props}
    >
      <div className={cn('pt-0 pb-2.5', className)}>{children}</div>
    </AccordionPrimitive.Panel>
  )
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger }
