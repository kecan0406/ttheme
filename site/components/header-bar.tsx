import { ModeSwitch } from './mode-switch'
import { PalettePicker } from './palette-picker'

export function HeaderBar() {
  return (
    <div
      data-slot="header-bar"
      class="flex h-8 w-fit items-stretch overflow-hidden rounded-full border border-border bg-card shadow-sm max-[720px]:h-auto max-[720px]:w-full max-[720px]:flex-col max-[720px]:rounded-xl"
    >
      <PalettePicker />
      <ModeSwitch />
    </div>
  )
}
