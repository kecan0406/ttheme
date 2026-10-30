import type { Children, PropsWithChildren } from '@kitajs/html'

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
  ...props
}: PropsWithChildren<
  Omit<JSX.HtmlButtonTag, 'class' | 'value'> & {
    class?: string
    pressed?: boolean
    value?: string
    render?: (props: ToggleAttrs) => JSX.Element
  }
>) {
  const toggle: ToggleAttrs = {
    type: 'button',
    ...props,
    'aria-pressed': pressed ? 'true' : 'false',
    'data-pressed': pressed,
    'data-slot': 'toggle',
    'data-value': value,
  }

  return render ? render(toggle) : <button {...toggle} />
}

export { Toggle }
