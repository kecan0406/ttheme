'use client'

import { type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { accentFor } from '@/lib/accent'
import type { Theme } from '@/lib/themes'
import { HeroTerminal } from './hero-terminal'
import { PaletteWall } from './palette-wall'

const CMD = 'ttheme next'
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
const COLOR_PROPS = [
  '--bg',
  '--fg',
  '--cur',
  '--sel',
  '--accent',
  '--glow',
  ...Array.from({ length: 16 }, (_, index) => `--a${index}`),
  ...Array.from({ length: 6 }, (_, index) => `--wm${index}`),
]

export function Landing({ themes, children }: { themes: Theme[]; children: ReactNode }) {
  const [group, setGroup] = useState('all')
  const [current, setCurrent] = useState(themes[0] as Theme)
  const [applied, setApplied] = useState<Theme | null>(null)
  const [typed, setTyped] = useState('')
  const [typing, setTyping] = useState(false)

  const list = useMemo(
    () => (group === 'all' ? themes : themes.filter((theme) => theme.group === group)),
    [group, themes],
  )
  const accent = useMemo(() => accentFor(current), [current])

  const stageRef = useRef<HTMLDivElement>(null)
  const listRef = useRef(list)
  listRef.current = list
  const currentRef = useRef(current)
  currentRef.current = current
  const holdTimer = useRef(0)
  const stepTimer = useRef(0)
  const turbo = useRef(false)
  const reduced = useRef(false)

  const stopAll = () => {
    clearTimeout(holdTimer.current)
    clearTimeout(stepTimer.current)
    setTyping(false)
  }

  const wear = (theme: Theme) => {
    setCurrent(theme)
    setApplied(theme)
  }

  const advance = (direction: number) => {
    const themesInList = listRef.current
    const index = themesInList.indexOf(currentRef.current)
    const next = themesInList[
      ((index === -1 ? 0 : index) + direction + themesInList.length) % themesInList.length
    ] as Theme
    wear(next)
    return next
  }

  const typeCmd = (text: string, done: () => void) => {
    setTyping(true)
    setTyped('')
    let length = 0
    const step = () => {
      length += 1
      setTyped(text.slice(0, length))
      if (length < text.length) {
        stepTimer.current = window.setTimeout(step, 45 + Math.random() * 65)
      } else {
        setTyping(false)
        stepTimer.current = window.setTimeout(done, 320)
      }
    }
    stepTimer.current = window.setTimeout(step, 60)
  }

  const cycle = () => {
    if (reduced.current) return
    stopAll()
    if (turbo.current) {
      holdTimer.current = window.setTimeout(() => {
        setTyped(CMD)
        advance(1)
        cycle()
      }, 300)
      return
    }
    holdTimer.current = window.setTimeout(
      () =>
        typeCmd(CMD, () => {
          advance(1)
          cycle()
        }),
      3200,
    )
  }

  const manual = (direction: number) => {
    stopAll()
    const next = advance(direction)
    setTyped(direction < 0 ? `ttheme apply ${next.name}` : CMD)
    cycle()
  }

  const wearTheme = (theme: Theme) => {
    stopAll()
    setTyped(`ttheme apply ${theme.name}`)
    wear(theme)
    cycle()
    stageRef.current?.scrollIntoView({ behavior: reduced.current ? 'auto' : 'smooth', block: 'center' })
  }

  const pickGroup = (nextGroup: string) => {
    setGroup(nextGroup)
    const nextList = nextGroup === 'all' ? themes : themes.filter((theme) => theme.group === nextGroup)
    const head = nextList[0]
    if (head && !nextList.includes(currentRef.current)) {
      stopAll()
      setTyped(`ttheme menu — ${nextGroup}`)
      wear(head)
      cycle()
    }
  }

  useEffect(() => {
    reduced.current = matchMedia('(prefers-reduced-motion: reduce)').matches
    if (typeof CSS !== 'undefined' && 'registerProperty' in CSS) {
      for (const name of COLOR_PROPS) {
        try {
          CSS.registerProperty({ name, syntax: '<color>', inherits: true, initialValue: 'transparent' })
        } catch {
          break
        }
      }
      document.documentElement.classList.add('cpreg')
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
      if (document.hidden) stopAll()
      else cycle()
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('keyup', onKeyUp)
    document.addEventListener('visibilitychange', onVisibility)
    cycle()
    return () => {
      stopAll()
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('keyup', onKeyUp)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', accent)
  }, [accent])

  return (
    <>
      <section className="mx-auto max-w-[840px] px-5 pt-5 text-center">
        <div ref={stageRef} className="stage relative" style={{ '--glow': `${accent}26` } as CSSProperties}>
          <HeroTerminal
            theme={current}
            position={`${list.indexOf(current) + 1}/${list.length}`}
            typed={typed}
            typing={typing}
            applied={applied}
            onNext={() => manual(1)}
          />
        </div>
        <p className="mt-4 text-xs text-muted">
          click the terminal — next palette ·{' '}
          <kbd className="rounded border border-line px-1.5 py-px text-[11px]">←</kbd>{' '}
          <kbd className="rounded border border-line px-1.5 py-px text-[11px]">→</kbd> browse
        </p>
        {children}
      </section>
      <PaletteWall themes={themes} group={group} list={list} current={current} onGroup={pickGroup} onWear={wearTheme} />
    </>
  )
}
