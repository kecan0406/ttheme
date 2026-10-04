import { createElement } from '@kitajs/html'
import type { IconNode } from 'lucide'

export function Icon({ node, class: className }: { node: IconNode; class?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={className}
    >
      {node.map(([tag, attributes]) => createElement(tag, attributes))}
    </svg>
  )
}
