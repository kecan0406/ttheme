import { type IconNode, Library, Signpost, Terminal } from 'lucide'
import { Icon } from '@/lib/icons'
import type { GroupSlug } from '@/lib/menu'

const GROUP_ICONS: Record<GroupSlug, IconNode> = { guide: Signpost, cli: Terminal, reference: Library }

export function DocGroupIcon({ group, class: className }: { group: GroupSlug; class?: string }) {
  return <Icon node={GROUP_ICONS[group]} class={className} />
}
