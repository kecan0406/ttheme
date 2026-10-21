import { lineBox, WORDMARK } from '@/lib/wordmark'

export function Wordmark({ leading = 1.15, class: className }: { leading?: number; class?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={lineBox(leading)}
      role="img"
      aria-label="ttheme"
      data-slot="wordmark"
      class={className}
      style={`height:${leading}em`}
    >
      <path d={WORDMARK} fill="currentColor" />
    </svg>
  )
}
