'use client'

import { type CSSProperties, Fragment, useEffect, useLayoutEffect, useRef } from 'react'
import type { Theme } from '@/lib/themes'

const GLYPHS: Record<string, string[]> = {
  T: ['11111', '00100', '00100', '00100', '00100'],
  H: ['10001', '10001', '11111', '10001', '10001'],
  E: ['11111', '10000', '11110', '10000', '11111'],
  M: ['10001', '11011', '10101', '10001', '10001'],
}
const WORD = 'TTHEME'
const WORDMARK = [0, 1, 2, 3, 4].map((row) => ({
  key: `row${row}`,
  breakBefore: row > 0,
  cells: [...WORD].map((letter, column) => ({
    key: `row${row}-${letter}${column}`,
    color: `var(--wm${column})`,
    gapBefore: column > 0,
    text: [...(GLYPHS[letter]?.[row] ?? '')].map((cell) => (cell === '1' ? '██' : '  ')).join(''),
  })),
}))
const BASES = WORDMARK.flatMap((row) => row.cells.map((cell) => cell.text))
const STRIP = Array.from({ length: 16 }, (_, index) => ({ key: `a${index}`, color: `var(--a${index})` }))
const SHADES = '░▒▓'
const NAME_GLYPHS = 'abcdefghijklmnopqrstuvwxyz0123456789-·*+'

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

function themeVars(theme: Theme): CSSProperties {
  const vars: Record<string, string> = {
    '--bg': theme.background,
    '--fg': theme.foreground,
    '--cur': theme.cursor,
    '--sel': theme.selectionBackground,
  }
  theme.ansi.forEach((color, index) => {
    vars[`--a${index}`] = color
  })
  for (let index = 0; index < 6; index++) {
    vars[`--wm${index}`] = theme.ansi[9 + index] ?? theme.foreground
  }
  return vars as CSSProperties
}

export function HeroTerminal({
  theme,
  position,
  typed,
  typing,
  applied,
  onNext,
}: {
  theme: Theme
  position: string
  typed: string
  typing: boolean
  applied: Theme | null
  onNext: () => void
}) {
  const wordmarkRef = useRef<HTMLPreElement>(null)
  const nameRef = useRef<HTMLElement>(null)
  const dissolveRaf = useRef(0)
  const scrambleRaf = useRef(0)
  const firstDissolve = useRef(true)
  const firstScramble = useRef(true)

  useEffect(() => {
    if (firstDissolve.current) {
      firstDissolve.current = false
      return
    }
    if (reducedMotion()) return
    const spans = wordmarkRef.current?.querySelectorAll('span')
    if (!spans) return
    cancelAnimationFrame(dissolveRaf.current)
    const start = performance.now()
    let lastStep = 0
    const tick = (now: number) => {
      const progress = Math.min((now - start) / 460, 1)
      if (progress >= 1) {
        spans.forEach((span, index) => {
          span.textContent = BASES[index] ?? ''
        })
        return
      }
      if (now - lastStep >= 50) {
        lastStep = now
        const chance = 0.55 * (1 - progress)
        spans.forEach((span, index) => {
          span.textContent = [...(BASES[index] ?? '')]
            .map((cell) => (cell === '█' && Math.random() < chance ? SHADES[(Math.random() * 3) | 0] : cell))
            .join('')
        })
      }
      dissolveRaf.current = requestAnimationFrame(tick)
    }
    dissolveRaf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(dissolveRaf.current)
  }, [theme])

  useLayoutEffect(() => {
    if (firstScramble.current) {
      firstScramble.current = false
      return
    }
    if (reducedMotion()) return
    const target = nameRef.current
    if (!target) return
    cancelAnimationFrame(scrambleRaf.current)
    const next = theme.name
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min((now - start) / 380, 1)
      if (progress >= 1) {
        target.textContent = next
        return
      }
      const keep = Math.floor(progress * next.length)
      target.textContent = [...next]
        .map((char, index) =>
          index < keep || char === ' ' ? char : NAME_GLYPHS[(Math.random() * NAME_GLYPHS.length) | 0],
        )
        .join('')
      scrambleRaf.current = requestAnimationFrame(tick)
    }
    scrambleRaf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(scrambleRaf.current)
  }, [theme])

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Switch to the next palette"
      onClick={onNext}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onNext()
        }
      }}
      className="term relative cursor-pointer overflow-hidden rounded-[10px] border border-line bg-(--bg) text-left shadow-[0_30px_90px_-30px_rgba(0,0,0,0.75)]"
      style={themeVars(theme)}
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-center px-3.5 pt-[11px] pb-[9px] text-[11.5px] max-sm:grid-cols-[auto_1fr]">
        <span className="flex gap-[7px]">
          <i className="size-[11px] rounded-full bg-(--a1) opacity-85" />
          <i className="size-[11px] rounded-full bg-(--a3) opacity-85" />
          <i className="size-[11px] rounded-full bg-(--a2) opacity-85" />
        </span>
        <span className="text-center text-(--a8) max-sm:text-right">
          ttheme ·{' '}
          <b ref={nameRef} className="text-(--fg)">
            {theme.name}
          </b>
        </span>
        <span className="text-right text-(--a8) tabular-nums max-sm:hidden">{position}</span>
      </div>
      <div className="px-6 pt-5 pb-3.5 text-(--fg) max-sm:px-3.5 max-sm:pt-3.5 max-sm:pb-2.5">
        <pre
          ref={wordmarkRef}
          aria-hidden
          className="mt-2.5 mb-[22px] overflow-hidden text-[length:clamp(6px,1.45vw,12px)] font-bold leading-[1.06]"
        >
          {WORDMARK.map((row) => (
            <Fragment key={row.key}>
              {row.breakBefore ? '\n' : null}
              {row.cells.map((cell) => (
                <Fragment key={cell.key}>
                  {cell.gapBefore ? '  ' : null}
                  <span style={{ color: cell.color }}>{cell.text}</span>
                </Fragment>
              ))}
            </Fragment>
          ))}
        </pre>
        <pre className="overflow-x-auto text-[length:clamp(10.5px,1.6vw,13.5px)] leading-[1.8]">
          <span className="text-(--a2)">❯</span> <span className="text-(--a4)">ttheme</span> preview{'\n'}
          <span className="text-(--a8)">contrast</span> <span className="text-(--a2)">✓ 16/16 pass</span>{' '}
          <span className="text-(--a8)">· wcag gate on</span>
          {'\n'}
          <span className="text-(--a2)">❯</span> git diff --stat{'\n'}
          {' themes/'}
          <span className="text-(--a5)">{theme.slug}.toml</span>
          {' | '}
          <span className="text-(--a2)">+18</span> <span className="text-(--a1)">-6</span>
          {'\n'}
          <span className="text-(--a2)">❯</span> ls{'\n'}
          <span className="text-(--a4)">src</span>
          {'  '}
          <span className="text-(--a4)">themes</span>
          {'  '}
          <span className="text-(--a6)">dist</span>
          {'  mise.toml  README.md\n'}
          <span className="bg-(--sel)">selection looks like this</span>
        </pre>
        <pre className="mt-1 overflow-x-auto text-[length:clamp(10.5px,1.6vw,13.5px)] leading-[1.8]">
          <span className="text-(--a2)">❯</span> {typed}
          <span className="cursor" data-typing={typing || undefined} />
        </pre>
        <pre className="min-h-[1.8em] overflow-x-auto text-[length:clamp(10.5px,1.6vw,13.5px)] leading-[1.8]">
          {applied ? (
            <>
              <span className="text-(--a2)">✓</span> applied <b className="text-(--fg)">{applied.name}</b>{' '}
              <span className="text-(--a8)">· {applied.group}</span>
            </>
          ) : (
            ' '
          )}
        </pre>
      </div>
      <div aria-hidden className="flex h-3">
        {STRIP.map((slot) => (
          <i key={slot.key} className="flex-1" style={{ background: slot.color }} />
        ))}
      </div>
    </div>
  )
}
