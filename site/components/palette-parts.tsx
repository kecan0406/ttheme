import { escapeHtml, type PropsWithChildren } from '@kitajs/html'
import { Check } from 'lucide'
import { Badge } from '@/components/ui/badge'
import { Icon } from '@/lib/icons'
import { luminance, passes } from '@/lib/sheet'
import type { GateRule, Theme } from '@/lib/themes'
import { cn } from '@/lib/utils'

export function SectionLabel({ icon, children }: PropsWithChildren<{ icon: JSX.Element }>) {
  return (
    <p class="mb-2.5 inline-flex items-center gap-2 text-2xs font-bold tracking-caps text-muted-foreground uppercase [&_svg]:size-3.25">
      {icon}
      {children}
    </p>
  )
}

export function Signature({ theme, size = 'sm' }: { theme: Theme; size?: 'sm' | 'lg' }) {
  if (size === 'sm')
    return (
      <span class="flex flex-none gap-1" role="img" aria-label={`signature ${theme.signature.join(' ')}`}>
        {theme.signature.map((color) => (
          <i
            class="size-3 rounded-full ring-1 ring-border inset-ring inset-ring-black/14"
            style={`background:${color}`}
          />
        ))}
      </span>
    )
  return (
    <div class="flex flex-wrap gap-x-4 gap-y-2.5">
      {theme.signature.map((color, index) => (
        <span class="inline-flex items-center gap-2 font-mono text-xs">
          <i
            class="size-5 rounded-full ring-1 ring-border inset-ring inset-ring-black/14"
            style={`background:${color}`}
          />
          <span safe>{color}</span>
          <span class="font-sans text-muted-foreground" safe>
            {theme.signatureSlots[index]}
          </span>
        </span>
      ))}
    </div>
  )
}

export function PropertyList({ rows }: { rows: [string, string][] }) {
  return (
    <dl class="grid grid-cols-[max-content_1fr] gap-x-3.5 gap-y-1.5 text-sm font-medium">
      {rows.map(([label, value]) => (
        <div class="contents">
          <dt class="text-muted-foreground" safe>
            {label}
          </dt>
          <dd class="tabular-nums [overflow-wrap:anywhere]" safe>
            {value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function reading(value: number, unit: string): string {
  if (unit === 'ratio') return `${value.toFixed(2)}:1`
  if (unit === 'luminance') return `L ${value.toFixed(3)}`
  return `${Math.round(value)}°`
}

export function GateList({ theme, gate }: { theme: Theme; gate: GateRule[] }) {
  return (
    <div class="grid">
      {gate.map((rule, index) => {
        const value = theme.gate[index] as number
        const ok = passes({ value, min: rule.min, max: rule.max })
        const floor = rule.min !== undefined ? `≥ ${rule.min}` : `≤ ${rule.max}`
        const miss = rule.min !== undefined ? `under ${rule.min}` : `over ${rule.max}`
        return (
          <div class="grid grid-cols-[1fr_auto_auto] items-center gap-2.5 border-b border-border/60 py-1.5 text-sm last:border-b-0">
            <span class="text-soft-foreground" safe>
              {rule.label}
            </span>
            <code class="font-mono text-xs tabular-nums" safe>
              {reading(value, rule.unit)}
            </code>
            <Badge variant={ok ? 'success' : 'warning'}>{escapeHtml(ok ? floor : miss)}</Badge>
          </div>
        )
      })}
    </div>
  )
}

const SLOTS = ['bg', 'fg', 'cursor', 'selection']

function Swatch({ name, color }: { name: string; color: string }) {
  return (
    <button
      type="button"
      data-copy={color}
      data-copy-hold="1200"
      aria-label={`copy ${name} ${color}`}
      class="group/copy min-w-0 overflow-hidden rounded-md border bg-card text-left transition-transform duration-150 outline-none hover:-translate-y-px hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:hover:translate-y-0"
    >
      <span
        class={cn(
          'flex h-11 items-center justify-center font-mono text-2xs tracking-wide inset-ring inset-ring-black/8',
          luminance(color) > 0.3 ? 'text-[#0b0d12]' : 'text-[#f1f2f4]',
        )}
        style={`background:${color}`}
      >
        <span class="group-data-copied/copy:hidden" safe>
          {color}
        </span>
        <Icon node={Check} class="hidden size-3.5 group-data-copied/copy:block" />
      </span>
      <span class="block px-2 py-1.5 font-mono text-xs" safe>
        {name}
      </span>
    </button>
  )
}

export function SwatchGrid({ theme }: { theme: Theme }) {
  const colors = [theme.background, theme.foreground, theme.cursor, theme.selectionBackground, ...theme.ansi]
  return (
    <div class="grid grid-cols-4 gap-2">
      {colors.map((color, index) => (
        <Swatch name={SLOTS[index] ?? `ansi${index - SLOTS.length}`} color={color} />
      ))}
    </div>
  )
}
