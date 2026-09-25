'use client'

import { ContrastIcon, MoonIcon, SearchIcon } from 'lucide-react'
import { type Ref, useEffect, useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Kbd } from '@/components/ui/kbd'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { SCENES, type Scene } from './terminal-preview'

export type Source = 'all' | 'official' | 'markets'
export type Ground = 'both' | 'dark' | 'light'

export interface Filters {
  query: string
  source: Source
  ground: Ground
  scene: Scene
}

function single<T extends string>(value: unknown[], apply: (next: T) => void) {
  const next = value[0] as T | undefined
  if (next) apply(next)
}

export function FilterBar({
  filters,
  onChange,
  shown,
  total,
  sources = true,
}: {
  filters: Filters
  onChange: (next: Partial<Filters>) => void
  shown: number
  total: number
  sources?: boolean
}) {
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.target instanceof HTMLInputElement) return
      event.preventDefault()
      input.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="sticky top-28 z-9 flex flex-wrap items-center gap-2.5 rounded-xl border bg-glass p-2.5 shadow-sm backdrop-blur-[10px] max-[560px]:static">
      <InputGroup className="min-w-60 flex-1">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          ref={input as Ref<HTMLInputElement>}
          value={filters.query}
          onChange={(event) => onChange({ query: event.target.value })}
          placeholder="search palettes, series, owners"
          aria-label="search palettes"
          spellCheck={false}
          autoComplete="off"
        />
        <InputGroupAddon align="inline-end">
          <Kbd>/</Kbd>
        </InputGroupAddon>
      </InputGroup>
      {sources ? (
        <ToggleGroup
          aria-label="source"
          value={[filters.source]}
          onValueChange={(value) => single<Source>(value, (source) => onChange({ source }))}
        >
          <ToggleGroupItem value="all">all</ToggleGroupItem>
          <ToggleGroupItem value="official">official</ToggleGroupItem>
          <ToggleGroupItem value="markets">markets</ToggleGroupItem>
        </ToggleGroup>
      ) : null}
      <ToggleGroup
        aria-label="background"
        value={[filters.ground]}
        onValueChange={(value) => single<Ground>(value, (ground) => onChange({ ground }))}
      >
        <ToggleGroupItem value="dark">
          <MoonIcon />
          dark
        </ToggleGroupItem>
        <ToggleGroupItem value="light">
          <ContrastIcon />
          light
        </ToggleGroupItem>
        <ToggleGroupItem value="both">both</ToggleGroupItem>
      </ToggleGroup>
      <ToggleGroup
        aria-label="scene"
        value={[filters.scene]}
        onValueChange={(value) => single<Scene>(value, (scene) => onChange({ scene }))}
      >
        {SCENES.map((scene) => (
          <ToggleGroupItem key={scene} value={scene}>
            {scene}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <Badge variant="count" className="ml-auto">
        {shown} of {total} palettes
      </Badge>
    </div>
  )
}
