import type { Children, PropsWithChildren } from '@kitajs/html'
import { X } from 'lucide'
import { Button } from '@/components/ui/button'
import { Icon } from '@/lib/icons'
import { cn } from '@/lib/utils'

type DivProps = PropsWithChildren<Omit<JSX.HtmlTag, 'class'> & { class?: string }>

type ButtonAttrs = Omit<JSX.HtmlButtonTag, 'class'> & {
  class?: string
  children?: Children
  'data-slot': string
  'aria-haspopup'?: 'dialog'
}

type Render = (props: ButtonAttrs) => JSX.Element

function Dialog({ class: className, children, ...props }: DivProps) {
  return (
    <dialog
      data-slot="dialog-content"
      data-closed
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

function DialogTrigger({
  dialog,
  render,
  ...props
}: PropsWithChildren<Omit<JSX.HtmlButtonTag, 'class'> & { class?: string; dialog: string; render: Render }>) {
  return render({
    type: 'button',
    commandfor: dialog,
    command: 'show-modal',
    'aria-haspopup': 'dialog',
    'data-slot': 'dialog-trigger',
    ...props,
  })
}

function CloseButton(props: ButtonAttrs) {
  return (
    <Button
      {...props}
      variant="outline"
      size="icon-round"
      class="absolute top-6 right-6 z-10 bg-glass backdrop-blur-[10px]"
    >
      <Icon node={X} />
      <span class="sr-only">Close</span>
    </Button>
  )
}

function DialogClose({ render = CloseButton }: { render?: Render }) {
  return (
    <form method="dialog" class="contents">
      {render({ type: 'submit', 'data-slot': 'dialog-close' })}
    </form>
  )
}

function DialogHeader({ class: className, ...props }: DivProps) {
  return <div data-slot="dialog-header" class={cn('flex flex-col gap-2.5', className)} {...props} />
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

export { Dialog, DialogClose, DialogHeader, DialogTitle, DialogTrigger }
