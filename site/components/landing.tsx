'use client'

import { useMemo, useState } from 'react'
import type { Theme } from '@/lib/themes'
import { HeroSession } from './hero-session'
import { matchesFilter, PaletteSidebar } from './palette-sidebar'

export function Landing({ themes }: { themes: Theme[] }) {
  const first = themes[0] as Theme
  const [current, setCurrent] = useState(first)
  const [open, setOpen] = useState<string[]>([first.group])
  const [filter, setFilter] = useState('')

  const hits = useMemo(() => themes.filter((theme) => matchesFilter(theme, filter)), [themes, filter])
  const hitGroups = useMemo(() => [...new Set(hits.map((theme) => theme.group))], [hits])
  const index = hits.indexOf(current)

  return (
    <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_auto] max-md:grid-cols-1 max-md:grid-rows-[minmax(0,1fr)_minmax(0,45%)]">
      <HeroSession theme={current} themes={themes} position={`${index === -1 ? '–' : index + 1}/${hits.length}`} />
      <PaletteSidebar
        themes={themes}
        current={current}
        open={filter.trim() ? hitGroups : open}
        onOpenChange={setOpen}
        filter={filter}
        onFilterChange={setFilter}
        onWear={setCurrent}
      />
    </div>
  )
}
