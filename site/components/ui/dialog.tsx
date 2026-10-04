import type { PropsWithChildren } from '@kitajs/html'
import { X } from 'lucide'
import { Button } from '@/components/ui/button'
import { Icon } from '@/lib/icons'
import { cn } from '@/lib/utils'

type DivProps = PropsWithChildren<Omit<JSX.HtmlTag, 'class'> & { class?: string }>

function Dialog({ class: className, children, ...props }: DivProps) {
  return (
    <dialog
      data-slot="dialog-content"
      class={cn(
        'm-auto max-h-[calc(100dvh-48px)] w-[min(1100px,calc(100%-24px))] max-w-none overflow-hidden rounded-3xl border border-border bg-popover p-0 text-popover-foreground shadow-lg outline-none backdrop:bg-overlay backdrop:backdrop-blur-[7px]',
        className,
      )}
      {...props}
    >
      {children}
    </dialog>
  )
}

function DialogClose() {
  return (
    <form method="dialog" data-slot="dialog-close" class="absolute top-6 right-6 z-10">
      <Button type="submit" variant="outline" size="icon-round" class="bg-glass backdrop-blur-[10px]">
        <Icon node={X} />
        <span class="sr-only">Close</span>
      </Button>
    </form>
  )
}

function DialogHeader({ class: className, ...props }: DivProps) {
  return <div data-slot="dialog-header" class={cn('flex flex-col gap-2.5', className)} {...props} />
}

function DialogFooter({ class: className, ...props }: DivProps) {
  return (
    <div
      data-slot="dialog-footer"
      class={cn(
        'flex flex-wrap items-center gap-3 border-t bg-popover px-6 pt-3.5 pb-4.5 text-popover-foreground',
        className,
      )}
      {...props}
    />
  )
}

function DialogTitle({ class: className, ...props }: DivProps) {
  return (
    <h2
      data-slot="dialog-title"
      class={cn('font-display text-display-lg font-black [overflow-wrap:anywhere]', className)}
      {...props}
    />
  )
}

function DialogDescription({ class: className, ...props }: DivProps) {
  return <p data-slot="dialog-description" class={cn('text-sm text-muted-foreground', className)} {...props} />
}

export { Dialog, DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogTitle }
