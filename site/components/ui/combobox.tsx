import type { PropsWithChildren } from '@kitajs/html'
import { cn } from '@/lib/utils'

type PartProps = PropsWithChildren<Omit<JSX.HtmlTag, 'class'> & { class?: string }>

function Combobox({ class: className, value, ...props }: PartProps & { value?: string }) {
  return <div data-slot="combobox" data-value={value} class={cn('contents', className)} {...props} />
}

function ComboboxInput({ list, label, ...props }: Omit<JSX.HtmlInputTag, 'list'> & { list: string; label: string }) {
  return (
    <input
      type="search"
      role="combobox"
      aria-controls={list}
      aria-expanded="true"
      aria-autocomplete="list"
      aria-label={label}
      autocomplete="off"
      autocapitalize="none"
      autocorrect="off"
      spellcheck="false"
      data-slot="combobox-input"
      {...props}
    />
  )
}

function ComboboxList({ label, ...props }: PartProps & { id: string; label: string }) {
  return <div role="listbox" aria-label={label} tabindex="-1" data-slot="combobox-list" {...props} />
}

function ComboboxGroup({ class: className, label, ...props }: PartProps & { label: string }) {
  return (
    <fieldset
      aria-label={label}
      data-slot="combobox-group"
      class={cn('m-0 min-w-0 border-0 p-0', className)}
      {...props}
    />
  )
}

function ComboboxItem({
  value,
  text,
  selected = false,
  ...props
}: PropsWithChildren<
  Omit<JSX.HtmlButtonTag, 'value'> & { id: string; value: string; text: string; selected?: boolean }
>) {
  return (
    <button
      type="button"
      role="option"
      tabindex="-1"
      aria-selected={String(selected)}
      data-slot="combobox-item"
      data-value={value}
      data-text={text}
      data-selected={selected}
      {...props}
    />
  )
}

function ComboboxEmpty(props: PartProps) {
  return <p data-slot="combobox-empty" hidden {...props} />
}

export { Combobox, ComboboxEmpty, ComboboxGroup, ComboboxInput, ComboboxItem, ComboboxList }
