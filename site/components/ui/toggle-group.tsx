import type { PropsWithChildren } from '@kitajs/html'

function ToggleGroup({
  label,
  ...props
}: PropsWithChildren<Omit<JSX.HtmlTag, 'class'> & { class?: string; label: string }>) {
  return <fieldset aria-label={label} data-slot="toggle-group" {...props} />
}

export { ToggleGroup }
