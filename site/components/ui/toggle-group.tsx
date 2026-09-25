'use client'

import { Toggle as TogglePrimitive } from '@base-ui/react/toggle'
import { ToggleGroup as ToggleGroupPrimitive } from '@base-ui/react/toggle-group'
import type { VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { toggleVariants } from '@/components/ui/toggle'
import { cn } from '@/lib/utils'

type Variant = VariantProps<typeof toggleVariants>['variant']

const ToggleGroupContext = React.createContext<Variant>('default')

const GROUP = {
  default: 'rounded-full border border-border bg-muted/65',
  scene: 'rounded-lg border border-(--fg)/16 bg-(--fg)/9',
}

function ToggleGroup({
  className,
  variant = 'default',
  children,
  ...props
}: ToggleGroupPrimitive.Props & { variant?: Variant }) {
  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      data-variant={variant}
      className={cn('flex w-fit flex-wrap items-center gap-0.5 p-0.75', GROUP[variant ?? 'default'], className)}
      {...props}
    >
      <ToggleGroupContext.Provider value={variant}>{children}</ToggleGroupContext.Provider>
    </ToggleGroupPrimitive>
  )
}

function ToggleGroupItem({ className, children, ...props }: TogglePrimitive.Props) {
  const variant = React.useContext(ToggleGroupContext)

  return (
    <TogglePrimitive
      data-slot="toggle-group-item"
      data-variant={variant}
      className={cn('shrink-0 focus-visible:z-10', toggleVariants({ variant }), className)}
      {...props}
    >
      {children}
    </TogglePrimitive>
  )
}

export { ToggleGroup, ToggleGroupItem }
