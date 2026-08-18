'use client'

import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { accentFor } from '@/lib/color'
import type { Theme } from '@/lib/themes'
import { HeroField } from './hero-field'
import { PaletteWall } from './palette-wall'

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

export function Landing({ themes, children }: { themes: Theme[]; children: ReactNode }) {
  const [group, setGroup] = useState('all')
  const [current, setCurrent] = useState(themes[0] as Theme)

  const list = useMemo(
    () => (group === 'all' ? themes : themes.filter((theme) => theme.group === group)),
    [group, themes],
  )
  const accent = useMemo(() => accentFor(current), [current])

  const stickyRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const listRef = useRef(list)
  listRef.current = list
  const currentRef = useRef(current)
  currentRef.current = current
  const cycleTimer = useRef(0)
  const turbo = useRef(false)
  const reduced = useRef(false)

  const stopCycle = () => clearTimeout(cycleTimer.current)

  const advance = (step: number) => {
    const themesInList = listRef.current
    const index = themesInList.indexOf(currentRef.current)
    const next = themesInList[
      ((index === -1 ? 0 : index) + step + themesInList.length * Math.abs(step)) % themesInList.length
    ] as Theme
    setCurrent(next)
  }

  const cycle = () => {
    if (reduced.current) return
    stopCycle()
    cycleTimer.current = window.setTimeout(
      () => {
        advance(CYCLE_STEP)
        cycle()
      },
      turbo.current ? TURBO_MS : CYCLE_MS,
    )
  }

  const manual = (direction: number) => {
    stopCycle()
    advance(direction)
    cycle()
  }

  const wearTheme = (theme: Theme) => {
    stopCycle()
    setCurrent(theme)
    cycle()
  }

  const pickGroup = (nextGroup: string) => {
    setGroup(nextGroup)
    const nextList = nextGroup === 'all' ? themes : themes.filter((theme) => theme.group === nextGroup)
    const head = nextList[0]
    if (head && !nextList.includes(currentRef.current)) {
      stopCycle()
      setCurrent(head)
      cycle()
    }
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
      if (event.key === 'ArrowRight') manual(1)
      if (event.key === 'ArrowLeft') manual(-1)
    }
    const konamiBuffer: string[] = []
    const onKeyUp = (event: KeyboardEvent) => {
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

  useEffect(() => {
    let raf = 0
    let field: HTMLElement | null = null
    const update = () => {
      raf = 0
      const sentinel = sentinelRef.current
      const sticky = stickyRef.current
      if (!sentinel || !sticky) return
      field ??= sticky.querySelector('.hero-field')
      const range = Math.max(field?.offsetHeight ?? 380, 120)
      let progress = Math.min(Math.max(-sentinel.getBoundingClientRect().top / range, 0), 1)
      if (reduced.current) progress = progress > 0.5 ? 1 : 0
      sticky.style.setProperty('--morph', String(progress))
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    update()
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [])

  return (
    <>
      <div ref={sentinelRef} aria-hidden />
      <div ref={stickyRef} className="hero-sticky">
        <div className="hero-wrap mx-auto max-w-[1160px] px-6">
          <HeroField
            theme={current}
            position={`${list.indexOf(current) + 1}/${list.length}`}
            onNext={() => manual(1)}
          />
        </div>
      </div>
      <section className="mx-auto max-w-[840px] px-5 text-center">{children}</section>
      <PaletteWall themes={themes} group={group} list={list} current={current} onGroup={pickGroup} onWear={wearTheme} />
    </>
  )
}
