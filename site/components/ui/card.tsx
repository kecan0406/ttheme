import type { PropsWithChildren } from '@kitajs/html'
import { cn } from '@/lib/utils'

type DivProps = PropsWithChildren<Omit<JSX.HtmlTag, 'class'> & { class?: string }>

function Card({ class: className, ...props }: DivProps) {
  return (
    <div
      data-slot="card"
      class={cn(
        'group/card relative flex flex-col overflow-hidden rounded-3xl border border-border bg-card text-card-foreground shadow-sm transition-[border-color,box-shadow,transform] duration-200',
        className,
      )}
      {...props}
    />
  )
}

function CardHeader({ class: className, ...props }: DivProps) {
  return (
    <div
      data-slot="card-header"
      class={cn(
        'grid auto-rows-min items-center gap-x-3 gap-y-1.5 px-4.5 pt-4 pb-4.5 has-data-[slot=card-action]:grid-cols-[1fr_auto]',
        className,
      )}
      {...props}
    />
  )
}

function CardTitle({ class: className, ...props }: DivProps) {
  return (
    <div
      data-slot="card-title"
      class={cn('font-display text-display-sm font-black [overflow-wrap:anywhere]', className)}
      {...props}
    />
  )
}

function CardDescription({ class: className, ...props }: DivProps) {
  return (
    <div
      data-slot="card-description"
      class={cn('col-span-full font-mono text-xs text-muted-foreground [overflow-wrap:anywhere]', className)}
      {...props}
    />
  )
}

function CardAction({ class: className, ...props }: DivProps) {
  return (
    <div
      data-slot="card-action"
      class={cn('col-start-2 row-start-1 self-center justify-self-end', className)}
      {...props}
    />
  )
}

export { Card, CardAction, CardDescription, CardHeader, CardTitle }
