import type { Children, PropsWithChildren } from '@kitajs/html'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const toggleVariants = cva('', {
  variants: {
    variant: {
      chip: 'inline-flex h-8 cursor-pointer items-center gap-2 rounded-full px-3 text-sm font-medium whitespace-nowrap text-soft-foreground inset-ring inset-ring-border transition-colors duration-150 outline-none hover:text-foreground focus-visible:inset-ring-2 focus-visible:inset-ring-ring aria-pressed:bg-muted aria-pressed:text-foreground aria-pressed:inset-ring-primary',
    },
  },
})

type ToggleAttrs = Omit<JSX.HtmlButtonTag, 'class' | 'value'> & {
  class?: string
  children?: Children
  'aria-pressed': 'true' | 'false'
  'data-pressed': boolean
  'data-slot': 'toggle'
  'data-value'?: string
}

function Toggle({
  pressed = false,
  value,
  render,
  variant,
  class: className,
  ...props
}: PropsWithChildren<
  Omit<JSX.HtmlButtonTag, 'class' | 'value'> &
    VariantProps<typeof toggleVariants> & {
      class?: string
      pressed?: boolean
      value?: string
      render?: (props: ToggleAttrs) => JSX.Element
    }
>) {
  const merged = cn(toggleVariants({ variant }), className)

  const toggle: ToggleAttrs = {
    type: 'button',
    ...props,
    ...(merged ? { class: merged } : {}),
    'aria-pressed': pressed ? 'true' : 'false',
    'data-pressed': pressed,
    'data-slot': 'toggle',
    'data-value': value,
  }

  return render ? render(toggle) : <button {...toggle} />
}

export { Toggle }
