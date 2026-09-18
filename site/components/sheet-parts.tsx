import type { ReactNode } from 'react'
import type { Slot } from '@/lib/sheet'
import { cn } from '@/lib/utils'

export function Chip({ slots, className }: { slots: Slot[]; className?: string }) {
  return (
    <span className={cn('flex flex-none border', className)}>
      {slots.map((slot, index) => (
        <i
          key={slot}
          className={index === 0 ? 'flex-[28_0_0]' : 'flex-[14_0_0]'}
          style={{ background: `var(--${slot})` }}
        />
      ))}
    </span>
  )
}

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="self-center rounded-[2px] border border-input px-[5px] text-[10px] leading-[1.45] tracking-[.04em] text-foreground">
      {children}
    </span>
  )
}

export function Key({ children }: { children: ReactNode }) {
  return <kbd className="rounded-[3px] border border-b-2 px-[.4em] text-[.92em] text-foreground">{children}</kbd>
}
