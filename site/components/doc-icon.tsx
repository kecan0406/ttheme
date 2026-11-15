import { type IconNode, Monitor, Paintbrush, Palette, SlidersHorizontal, Terminal, Variable } from 'lucide'
import { Icon } from '@/lib/icons'
import type { DocIcon } from '@/lib/menu'

const DOC_ICONS: Record<DocIcon, { icon: IconNode; tone: string }> = {
  use: { icon: Palette, tone: 'bg-(--a6)/14 text-(--a6)' },
  make: { icon: Paintbrush, tone: 'bg-(--a5)/14 text-(--a5)' },
  terminals: { icon: Monitor, tone: 'bg-(--a4)/16 text-(--a4)' },
  commands: { icon: Terminal, tone: 'bg-(--a2)/14 text-(--a2)' },
  settings: { icon: SlidersHorizontal, tone: 'bg-(--a3)/14 text-(--a3)' },
  environment: { icon: Variable, tone: 'bg-(--a1)/14 text-(--a1)' },
}

export function DocIconTile({ icon }: { icon: DocIcon }) {
  const { icon: node, tone } = DOC_ICONS[icon]

  return (
    <span aria-hidden="true" class={`grid size-10 flex-none place-items-center rounded-lg ${tone}`}>
      <Icon node={node} class="size-4.5" />
    </span>
  )
}
