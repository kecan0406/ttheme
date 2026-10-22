import { ModeSwitch } from './mode-switch'
import { PalettePicker } from './palette-picker'

export function HeaderBar() {
  return (
    <div
      data-slot="header-bar"
      class="flex h-8 w-fit items-stretch overflow-hidden rounded-full border border-border bg-card shadow-sm header-menu:h-auto header-menu:w-full header-menu:flex-col header-menu:rounded-xl"
    >
      <PalettePicker />
      <ModeSwitch />
    </div>
  )
}
