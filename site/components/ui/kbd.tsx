import type { PropsWithChildren } from '@kitajs/html'
import { cn } from '@/lib/utils'

function Kbd({ class: className, ...props }: PropsWithChildren<Omit<JSX.HtmlTag, 'class'> & { class?: string }>) {
  return (
    <kbd
      data-slot="kbd"
      class={cn(
        "pointer-events-none inline-flex h-5 w-fit min-w-5 items-center justify-center gap-1 rounded-sm bg-muted px-1.25 font-sans text-2xs font-medium text-muted-foreground inset-ring inset-ring-border select-none [&_svg:not([class*='size-'])]:size-3",
        className,
      )}
      {...props}
    />
  )
}

export { Kbd }
