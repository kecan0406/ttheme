import { Monitor, Moon, Sun } from 'lucide'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Icon } from '@/lib/icons'

const MODES = [
  { mode: 'system', label: 'follow the system', icon: Monitor },
  { mode: 'light', label: 'light', icon: Sun },
  { mode: 'dark', label: 'dark', icon: Moon },
]

export function ThemeToggle() {
  return (
    <theme-toggle>
      <ToggleGroup label="color theme">
        {MODES.map(({ mode, label, icon }) => (
          <ToggleGroupItem name="theme-mode" value={mode} checked={mode === 'system'} label={label} class="px-2">
            <Icon node={icon} />
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </theme-toggle>
  )
}
