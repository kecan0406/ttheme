'use client'

import { Meter } from '@base-ui/react/meter'
import { PreviewCard } from '@base-ui/react/preview-card'
import { contrast } from '@/lib/color'
import type { GateRule, Theme } from '@/lib/themes'

const ansiKeys = Array.from({ length: 16 }, (_, index) => `ansi${index}`)

export function passes(rule: GateRule, value: number): boolean {
  if (rule.min !== undefined) return value >= rule.min
  if (rule.max !== undefined) return value <= rule.max
  return true
}

export function gateScore(theme: Theme, gate: GateRule[]): number {
  return gate.filter((rule, index) => theme.waived.includes(rule.rule) || passes(rule, theme.gate[index] ?? 0)).length
}

function limitOf(rule: GateRule): string {
  return rule.min === undefined ? `≤ ${rule.max}` : `≥ ${rule.min}`
}

function readOut(rule: GateRule, value: number): string {
  return rule.unit === 'ratio' ? `${value.toFixed(2)}:1` : value.toFixed(3)
}

function Chip({ theme, index }: { theme: Theme; index: number }) {
  const color = theme.ansi[index] ?? theme.foreground
  const signature = theme.signatureSlots.includes(`ansi${index}`)
  return (
    <PreviewCard.Root>
      <PreviewCard.Trigger
        className="hero-chip"
        delay={140}
        render={<button type="button" aria-label={`ansi ${index}`} />}
      >
        <span className={`hero-chip-swatch term-c${index}`} />
        <span className="hero-chip-index">
          {index}
          {signature ? <span className="term-cu"> ◆</span> : null}
        </span>
      </PreviewCard.Trigger>
      <PreviewCard.Portal>
        <PreviewCard.Positioner side="top" sideOffset={6}>
          <PreviewCard.Popup className="hero-card">
            <b>{`ansi${index}`}</b>
            <span>{color}</span>
            <span>{`on background ${contrast(color, theme.background).toFixed(2)}:1`}</span>
            {signature ? <span className="text-accent">signature slot</span> : null}
          </PreviewCard.Popup>
        </PreviewCard.Positioner>
      </PreviewCard.Portal>
    </PreviewCard.Root>
  )
}

function Rule({ theme, rule, index }: { theme: Theme; rule: GateRule; index: number }) {
  const value = theme.gate[index] ?? 0
  const waived = theme.waived.includes(rule.rule)
  const ok = waived || passes(rule, value)
  const ceiling = (rule.min ?? rule.max ?? 1) * 2
  const text = readOut(rule, value)
  return (
    <Meter.Root
      className="hero-meter"
      value={Math.min(value, ceiling)}
      max={ceiling}
      getAriaValueText={() => `${rule.label} measured ${text}, needs ${limitOf(rule)}`}
    >
      <Meter.Label className="hero-meter-label">{rule.rule}</Meter.Label>
      <Meter.Value className="hero-meter-value">{() => text}</Meter.Value>
      <Meter.Track className="hero-meter-track">
        <Meter.Indicator className={ok ? 'hero-meter-fill' : 'hero-meter-fill hero-meter-fill-fail'} />
      </Meter.Track>
      <span className="hero-meter-limit">{waived ? 'waived' : limitOf(rule)}</span>
    </Meter.Root>
  )
}

export function Inspector({ theme, gate }: { theme: Theme; gate: GateRule[] }) {
  return (
    <div className="hero-insp">
      <div className="hero-insp-head">
        <b>{theme.name}</b>
        <span>{theme.signatureSlots.join(' · ')}</span>
        <span className="ml-auto">{`ANSI ${theme.ansiSource}`}</span>
      </div>
      <div className="hero-chips">
        {ansiKeys.map((key, index) => (
          <Chip key={key} theme={theme} index={index} />
        ))}
      </div>
      <div className="hero-meters">
        {gate.map((rule, index) => (
          <Rule key={rule.rule} theme={theme} rule={rule} index={index} />
        ))}
      </div>
    </div>
  )
}
