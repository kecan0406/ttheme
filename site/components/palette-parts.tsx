'use client'

import { CheckIcon } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { luminance, passes } from '@/lib/sheet'
import type { GateRule, Theme } from '@/lib/themes'
import { cn } from '@/lib/utils'

export function SectionLabel({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <p className="mb-2.5 inline-flex items-center gap-2 text-2xs font-bold tracking-caps text-muted-foreground uppercase [&_svg]:size-3.25">
      {icon}
      {children}
    </p>
  )
}

export function Signature({ theme, size = 'sm' }: { theme: Theme; size?: 'sm' | 'lg' }) {
  if (size === 'sm')
    return (
      <span className="flex flex-none gap-1" role="img" aria-label={`signature ${theme.signature.join(' ')}`}>
        {theme.signature.map((color, index) => (
          <i
            key={theme.signatureSlots[index]}
            className="size-3 rounded-full ring-1 ring-border inset-ring inset-ring-black/14"
            style={{ background: color }}
          />
        ))}
      </span>
    )
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2.5">
      {theme.signature.map((color, index) => (
        <span key={theme.signatureSlots[index]} className="inline-flex items-center gap-2 font-mono text-xs">
          <i
            className="size-5 rounded-full ring-1 ring-border inset-ring inset-ring-black/14"
            style={{ background: color }}
          />
          {color}
          <span className="font-sans text-muted-foreground">{theme.signatureSlots[index]}</span>
        </span>
      ))}
    </div>
  )
}

export function PropertyList({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-3.5 gap-y-1.5 text-sm font-medium">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="tabular-nums [overflow-wrap:anywhere]">{value}</dd>
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
    <div className="grid">
      {gate.map((rule, index) => {
        const value = theme.gate[index] as number
        const ok = passes({ value, min: rule.min, max: rule.max })
        const floor = rule.min !== undefined ? `≥ ${rule.min}` : `≤ ${rule.max}`
        const miss = rule.min !== undefined ? `under ${rule.min}` : `over ${rule.max}`
        return (
          <div
            key={rule.rule}
            className="grid grid-cols-[1fr_auto_auto] items-center gap-2.5 border-b border-border/60 py-1.5 text-sm last:border-b-0"
          >
            <span className="text-soft-foreground">{rule.label}</span>
            <code className="font-mono text-xs tabular-nums">{reading(value, rule.unit)}</code>
            <Badge variant={ok ? 'success' : 'warning'}>{ok ? floor : miss}</Badge>
          </div>
        )
      })}
    </div>
  )
}

const SLOTS = ['bg', 'fg', 'cursor', 'selection']

function Swatch({ name, color }: { name: string; color: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(color)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`copy ${name} ${color}`}
      className="min-w-0 overflow-hidden rounded-md border bg-card text-left transition-transform duration-150 outline-none hover:-translate-y-px hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:hover:translate-y-0"
    >
      <span
        className={cn(
          'flex h-11 items-center justify-center font-mono text-2xs tracking-wide inset-ring inset-ring-black/8',
          luminance(color) > 0.3 ? 'text-[#0b0d12]' : 'text-[#f1f2f4]',
        )}
        style={{ background: color }}
      >
        {copied ? <CheckIcon className="size-3.5" /> : color}
      </span>
      <span className="block px-2 py-1.5 font-mono text-xs">{name}</span>
    </button>
  )
}

export function SwatchGrid({ theme }: { theme: Theme }) {
  const colors = [theme.background, theme.foreground, theme.cursor, theme.selectionBackground, ...theme.ansi]
  return (
    <div className="grid grid-cols-4 gap-2">
      {colors.map((color, index) => {
        const name = SLOTS[index] ?? `ansi${index - SLOTS.length}`
        return <Swatch key={name} name={name} color={color} />
      })}
    </div>
  )
}
