'use client'

import { ScrollArea as ScrollAreaPrimitive } from '@base-ui/react/scroll-area'
import type * as React from 'react'

import { cn } from '@/lib/utils'

function ScrollArea({
  className,
  children,
  viewportRef,
  contentClassName,
  orientation = 'vertical',
  ...props
}: ScrollAreaPrimitive.Root.Props & {
  viewportRef?: React.Ref<HTMLDivElement>
  contentClassName?: string
  orientation?: 'vertical' | 'horizontal' | 'both'
}) {
  return (
    <ScrollAreaPrimitive.Root data-slot="scroll-area" className={cn('relative min-h-0 min-w-0', className)} {...props}>
      <ScrollAreaPrimitive.Viewport
        ref={viewportRef}
        data-slot="scroll-area-viewport"
        className="size-full overscroll-contain rounded-[inherit] outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        <ScrollAreaPrimitive.Content data-slot="scroll-area-content" className={contentClassName}>
          {children}
        </ScrollAreaPrimitive.Content>
      </ScrollAreaPrimitive.Viewport>
      {orientation !== 'horizontal' && <ScrollBar />}
      {orientation !== 'vertical' && <ScrollBar orientation="horizontal" />}
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
}

function ScrollBar({ className, orientation = 'vertical', ...props }: ScrollAreaPrimitive.Scrollbar.Props) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      data-slot="scroll-area-scrollbar"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        'm-px flex touch-none opacity-0 transition-opacity select-none data-hovering:opacity-100 data-scrolling:opacity-100 data-scrolling:duration-0 data-horizontal:h-1.5 data-horizontal:items-center data-vertical:w-1.5 data-vertical:justify-center',
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb data-slot="scroll-area-thumb" className="size-full rounded-full bg-border" />
    </ScrollAreaPrimitive.Scrollbar>
  )
}

export { ScrollArea, ScrollBar }
