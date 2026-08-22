'use client'

import { Tooltip } from '@base-ui/react/tooltip'
import { useEffect, useMemo, useRef, useState } from 'react'
import { accentFor } from '@/lib/color'
import type { Theme } from '@/lib/themes'
import { HeroSession } from './hero-session'
import { matchesFilter, PaletteSidebar } from './palette-sidebar'

const CYCLE_MS = 6000
const TURBO_MS = 700
const CYCLE_STEP = 7
const KONAMI = [
  'arrowup',
  'arrowup',
  'arrowdown',
  'arrowdown',
  'arrowleft',
  'arrowright',
  'arrowleft',
  'arrowright',
  'b',
  'a',
]

interface WearOptions {
  expand?: boolean
  reveal?: boolean
}

export function Landing({ themes }: { themes: Theme[] }) {
  const first = themes[0] as Theme
  const [current, setCurrent] = useState(first)
  const [open, setOpen] = useState<string[]>([first.group])
  const [collapsed, setCollapsed] = useState(false)
  const [filter, setFilter] = useState('')
  const [reveal, setReveal] = useState(0)

  const query = filter.trim().toLowerCase()
  const hits = useMemo(() => themes.filter((theme) => matchesFilter(theme, query)), [themes, query])
  const hitGroups = useMemo(() => [...new Set(hits.map((theme) => theme.group))], [hits])
  const series = useMemo(() => new Set(themes.map((theme) => theme.group)).size, [themes])
  const accent = useMemo(() => accentFor(current), [current])

  const hitsRef = useRef(hits)
  hitsRef.current = hits
  const currentRef = useRef(current)
  currentRef.current = current
  const filterRef = useRef<HTMLInputElement>(null)
  const cycleTimer = useRef(0)
  const turbo = useRef(false)
  const reduced = useRef(false)

  const stopCycle = () => clearTimeout(cycleTimer.current)

  const cycle = () => {
    if (reduced.current) return
    stopCycle()
    cycleTimer.current = window.setTimeout(() => advance(CYCLE_STEP), turbo.current ? TURBO_MS : CYCLE_MS)
  }

  const wear = (theme: Theme, { expand = false, reveal: shouldReveal = false }: WearOptions = {}) => {
    stopCycle()
    setCurrent(theme)
    if (expand) setOpen((groups) => (groups.includes(theme.group) ? groups : [...groups, theme.group]))
    if (shouldReveal) setReveal((tick) => tick + 1)
    cycle()
  }

  const advance = (step: number, options?: WearOptions) => {
    const list = hitsRef.current
    const index = list.indexOf(currentRef.current)
    const next = list[((index === -1 ? 0 : index) + step + list.length * Math.abs(step)) % list.length]
    if (next) wear(next, options)
    else cycle()
  }

  const openGroups = (groups: string[]) => {
    const opened = groups.find((group) => !open.includes(group))
    setOpen(groups)
    if (!opened || currentRef.current.group === opened) return
    const lead =
      themes.find((theme) => theme.group === opened && theme.lead) ?? themes.find((theme) => theme.group === opened)
    if (lead) wear(lead)
  }

  const submitFilter = () => {
    const head = hitsRef.current[0]
    if (head && !hitsRef.current.includes(currentRef.current)) wear(head, { expand: true, reveal: true })
  }

  const focusFilter = () => {
    setCollapsed(false)
    requestAnimationFrame(() => filterRef.current?.focus())
  }

  useEffect(() => {
    reduced.current = matchMedia('(prefers-reduced-motion: reduce)').matches
    const root = document.documentElement
    if (!root.classList.contains('cpreg') && typeof CSS !== 'undefined' && 'registerProperty' in CSS) {
      CSS.registerProperty({ name: '--accent', syntax: '<color>', inherits: true, initialValue: '#8cb8e8' })
      root.classList.add('cpreg')
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.target instanceof HTMLInputElement) return
      if (event.key === 'ArrowRight') advance(1, { expand: true, reveal: true })
      else if (event.key === 'ArrowLeft') advance(-1, { expand: true, reveal: true })
      else if (event.key === '\\') setCollapsed((value) => !value)
      else if (event.key === '/') {
        event.preventDefault()
        focusFilter()
      }
    }
    const konamiBuffer: string[] = []
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return
      const key = event.key.toLowerCase()
      if (KONAMI[konamiBuffer.length] === key) konamiBuffer.push(key)
      else konamiBuffer.length = 0
      if (konamiBuffer.length === KONAMI.length) {
        konamiBuffer.length = 0
        turbo.current = !turbo.current
        cycle()
      }
    }
    const onVisibility = () => {
      if (document.hidden) stopCycle()
      else cycle()
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('keyup', onKeyUp)
    document.addEventListener('visibilitychange', onVisibility)
    cycle()
    return () => {
      stopCycle()
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('keyup', onKeyUp)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', accent)
  }, [accent])

  const index = hits.indexOf(current)

  return (
    <Tooltip.Provider delay={400} closeDelay={0}>
      <div className="relative grid min-h-0 grid-cols-[minmax(0,1fr)_auto]">
        <HeroSession
          theme={current}
          position={`${index === -1 ? '–' : index + 1}/${hits.length}`}
          count={themes.length}
          series={series}
        />
        <PaletteSidebar
          themes={themes}
          current={current}
          open={query ? hitGroups : open}
          onOpenChange={openGroups}
          collapsed={collapsed}
          onCollapsedChange={setCollapsed}
          filter={filter}
          onFilterChange={setFilter}
          onSubmit={submitFilter}
          onStep={(direction) => advance(direction, { expand: true, reveal: true })}
          onWear={(theme) => wear(theme)}
          reveal={reveal}
          inputRef={filterRef}
        />
      </div>
    </Tooltip.Provider>
  )
}
