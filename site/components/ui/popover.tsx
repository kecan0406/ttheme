import type { Children, PropsWithChildren } from '@kitajs/html'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const popoverVariants = cva('m-0 border border-border bg-popover text-popover-foreground shadow-lg inset-auto', {
  variants: {
    variant: {
      panel:
        'hidden max-h-[min(640px,calc(100dvh-120px))] w-[min(400px,calc(100vw-32px))] flex-col overflow-y-auto rounded-xl open:flex',
      sheet:
        'hidden max-h-[min(640px,calc(100dvh-120px))] w-[min(400px,calc(100vw-32px))] flex-col overflow-hidden rounded-3xl open:flex',
      card: 'hidden w-[min(440px,calc(100vw-32px))] gap-2.5 rounded-3xl p-4 open:grid',
      picker: 'w-(--anchor-width) max-w-[calc(100vw-2rem)] flex-col gap-2 overflow-hidden rounded-xl p-2 open:flex',
    },
    inset: {
      none: '',
      padded: 'gap-3 p-4',
    },
  },
  defaultVariants: {
    variant: 'panel',
    inset: 'none',
  },
})

type Align = 'start' | 'end'

type PopupAttrs = Omit<JSX.HtmlTag, 'class'> & {
  id: string
  children?: Children
  popover: 'auto'
  'aria-label'?: string
  'data-slot': 'popover'
  'data-closed': true
  'data-side'?: 'bottom'
  'data-align'?: Align
  'data-offset'?: string
}

type TriggerAttrs = Omit<JSX.HtmlButtonTag, 'class'> & {
  class?: string
  children?: Children
  'data-slot': 'popover-trigger'
  'aria-haspopup'?: 'dialog'
}

type PopoverProps = PropsWithChildren<
  VariantProps<typeof popoverVariants> &
    Omit<JSX.HtmlTag, 'class'> & {
      class?: string
      id: string
      label?: string
      align?: Align
      offset?: number
      render?: (props: PopupAttrs) => JSX.Element
    }
>

function Popover({
  class: className,
  variant = 'panel',
  inset = 'none',
  id,
  label,
  align,
  offset,
  render,
  ...props
}: PopoverProps) {
  const popup: PopupAttrs = {
    ...props,
    id,
    popover: 'auto',
    role: label ? 'dialog' : undefined,
    'aria-label': label,
    'data-slot': 'popover',
    'data-closed': true,
    'data-side': align ? 'bottom' : undefined,
    'data-align': align,
    'data-offset': offset === undefined ? undefined : String(offset),
  }

  return render ? (
    render(popup)
  ) : (
    <div
      {...popup}
      data-variant={variant}
      data-inset={inset}
      class={cn(popoverVariants({ variant, inset }), className)}
    />
  )
}

function PopoverTrigger({
  popover,
  dialog = true,
  render,
  ...props
}: PropsWithChildren<
  Omit<JSX.HtmlButtonTag, 'class' | 'popover'> & {
    class?: string
    popover: string
    dialog?: boolean
    render: (props: TriggerAttrs) => JSX.Element
  }
>) {
  return render({
    type: 'button',
    popovertarget: popover,
    'aria-haspopup': dialog ? 'dialog' : undefined,
    'data-slot': 'popover-trigger',
    ...props,
  })
}

export { Popover, PopoverTrigger }
