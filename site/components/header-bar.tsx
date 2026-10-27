import { ModeSwitch } from './mode-switch'
import { PalettePicker } from './palette-picker'

export function HeaderBar() {
  return (
    <div data-slot="header-bar" class="flex w-fit items-center gap-2 header-menu:w-full">
      <PalettePicker />
      <ModeSwitch />
    </div>
  )
}
