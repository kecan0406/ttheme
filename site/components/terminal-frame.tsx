import type { PropsWithChildren } from '@kitajs/html'
import { cn } from '@/lib/utils'
import { WindowMode } from './window-mode'

const LIGHTS = ['--a1', '--a3', '--a2']

export const WINDOW_TITLE = 'min-w-0 flex-1 truncate text-center font-mono text-xs text-(--fg)/62'

function Lights({ class: className }: { class?: string }) {
  return (
    <span aria-hidden="true" class={cn('flex gap-2', className)}>
      {LIGHTS.map((slot) => (
        <i class="size-3 rounded-full forced-color-adjust-none" style={`background:var(${slot})`} />
      ))}
    </span>
  )
}

export function TerminalFrame({
  title,
  heading,
  tabs,
  controls,
  mode = false,
  raised = false,
  class: className,
  children,
  ...props
}: PropsWithChildren<
  Omit<JSX.HtmlTag, 'class' | 'title'> & {
    title?: string
    heading?: JSX.Element
    tabs?: JSX.Element
    controls?: JSX.Element
    mode?: boolean
    raised?: boolean
    class?: string
  }
>) {
  return (
    <div
      data-slot="terminal-frame"
      class={cn(
        'overflow-hidden rounded-xl bg-(--bg) text-(--fg) ring-1 ring-border',
        raised && 'shadow-lg',
        className,
      )}
      {...props}
    >
      {tabs ? (
        <div class="flex h-10 flex-none items-center gap-3 pr-1.5 pl-3.5">
          <Lights class="flex-none" />
          {tabs}
          {controls ? controls : null}
          {mode ? <WindowMode /> : null}
        </div>
      ) : (
        <div class="relative flex flex-none items-center gap-2 py-1 pr-1 pl-3.5">
          <Lights />
          {heading ? (
            heading
          ) : (
            <span data-window-title class={WINDOW_TITLE} translate="no" safe>
              {title ?? ''}
            </span>
          )}
          {controls ? controls : null}
          {mode ? <WindowMode /> : null}
        </div>
      )}
      {children}
    </div>
  )
}
