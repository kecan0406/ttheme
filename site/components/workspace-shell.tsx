import type { PropsWithChildren } from '@kitajs/html'
import { Check, TriangleAlert } from 'lucide'
import { Button } from '@/components/ui/button'
import type { Facts } from '@/lib/facts'
import { Icon } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { AppBar } from './app-bar'
import { SiteHeader } from './site-header'

type Props = PropsWithChildren<Omit<JSX.HtmlTag, 'class'> & { class?: string }>

const INSET = 'px-5 app:px-6 app:xl:px-10'

export function WorkspacePage({
  current,
  facts,
  status,
  children,
}: PropsWithChildren<{ current: string; facts: Facts; status: JSX.Element }>) {
  return (
    <div class="ground flex min-h-dvh flex-col app:h-dvh app:overflow-hidden">
      <SiteHeader current={current} facts={facts} fixed />
      {children}
      <AppBar facts={facts}>{status}</AppBar>
    </div>
  )
}

export function WorkspaceSide({ head, class: className, children, ...props }: Props & { head: JSX.Element }) {
  return (
    <aside
      data-slot="workspace-side"
      class={cn(
        'flex min-w-0 flex-col border-b border-border bg-sidebar [grid-area:side] app:m-3 app:mr-0 app:min-h-0 app:overflow-hidden app:rounded-2xl app:border app:bg-glass-panel app:shadow-md app:backdrop-blur-[22px] app:backdrop-saturate-170',
        className,
      )}
      {...props}
    >
      <div class="flex h-12 flex-none items-center border-b border-border px-2">{head}</div>
      {children}
    </aside>
  )
}

export function WorkspaceBar({ class: className, children, ...props }: Props) {
  return (
    <div
      data-slot="workspace-bar"
      class={cn(
        'flex min-h-16 min-w-0 items-center justify-between gap-x-5 gap-y-3 pt-4 app:min-h-15 app:pt-3',
        INSET,
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function WorkspaceTitle({ class: className, children, ...props }: Props) {
  return (
    <div class={cn('grid min-w-0 gap-1.5', className)} {...props}>
      {children}
    </div>
  )
}

export function TitleLine({ children }: PropsWithChildren) {
  return <div class="flex min-w-0 items-center gap-2.5">{children}</div>
}

export function TitleFacts({ class: className, children, ...props }: Props) {
  return (
    <div class={cn('flex min-w-0 flex-wrap items-center gap-1.5', className)} {...props}>
      {children}
    </div>
  )
}

export function TitleDots({ dots }: { dots: string[] }) {
  return (
    <>
      {dots.map((color) => (
        <i
          class="size-3 rounded-full ring-1 ring-border inset-ring inset-ring-black/14 forced-color-adjust-none"
          style={`background:${color}`}
        />
      ))}
    </>
  )
}

export function WorkspaceStage({ class: className, children, ...props }: Props) {
  return (
    <div
      data-slot="workspace-stage"
      class={cn('flex min-w-0 flex-col gap-3.5 pt-3 pb-4 app:min-h-0 app:flex-1 app:pb-3', INSET, className)}
      {...props}
    >
      {children}
    </div>
  )
}

export function GateButton({
  passed,
  total,
  waived = 0,
  ...props
}: Omit<JSX.HtmlButtonTag, 'class'> & { passed: number; total: number; waived?: number }) {
  const clear = passed === total
  const label = `contrast checks, ${passed} of ${total} pass${waived > 0 ? `, ${waived} waived` : ''}`

  return (
    <Button variant="muted" size="chip" aria-label={label} {...props}>
      <Icon node={clear ? Check : TriangleAlert} class={clear ? 'text-success' : 'text-warning'} />
      <span safe>{`contrast ${passed}/${total}`}</span>
      {waived > 0 ? (
        <span class="font-medium text-muted-foreground" safe>
          {`· ${waived} waived`}
        </span>
      ) : null}
    </Button>
  )
}
