import { createElement } from '@kitajs/html'
import { ArrowUpRight, type IconNode, Star } from 'lucide'
import type { SimpleIcon } from 'simple-icons'

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

export function BrandIcon({ icon, class: className }: { icon: SimpleIcon; class?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      class={className}
    >
      <path d={icon.path} />
    </svg>
  )
}

export function GitHubStar() {
  return <Icon node={Star} class="size-3.5 flex-none fill-current text-star" />
}

export function NewTab({ class: className }: { class?: string }) {
  return (
    <>
      <Icon node={ArrowUpRight} class={className} />
      <span class="sr-only">, opens in a new tab</span>
    </>
  )
}
