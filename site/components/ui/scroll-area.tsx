import type { PropsWithChildren } from '@kitajs/html'
import { cn } from '@/lib/utils'

function ScrollArea({
  class: className,
  contentClass,
  children,
}: PropsWithChildren<{ class?: string; contentClass?: string }>) {
  return (
    <div data-slot="scroll-area" class={cn('relative min-h-0 min-w-0', className)}>
      <div
        data-slot="scroll-area-viewport"
        tabindex="0"
        class="size-full overflow-auto overscroll-contain rounded-[inherit] [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin] outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        <div data-slot="scroll-area-content" class={contentClass}>
          {children}
        </div>
      </div>
    </div>
  )
}

export { ScrollArea }
