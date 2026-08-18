'use client'

import { useEffect, useRef } from 'react'
import { luminance } from '@/lib/color'
import type { Theme } from '@/lib/themes'

const RAMP = '  ..··::--==++**##%%@@'
const MASK_MIN_ROWS = 9
const REST_X = 0.5
const REST_Y = 0.42

export function HeroField({ theme, position, onNext }: { theme: Theme; position: string; onNext: () => void }) {
  const collapseRef = useRef<HTMLButtonElement>(null)
  const fieldRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const themeRef = useRef(theme)
  themeRef.current = theme
  const syncRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    syncRef.current?.()
  }, [theme])

  useEffect(() => {
    const collapse = collapseRef.current
    const field = fieldRef.current
    const canvas = canvasRef.current
    if (!collapse || !field || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const family = getComputedStyle(canvas).fontFamily || 'ui-monospace, monospace'
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')

    let cols = 0
    let rows = 0
    let cellWidth = 0
    let cellHeight = 0
    let glyph = 12
    let viewWidth = 0
    let viewHeight = 0
    let ramp: string[] = []
    let mask: Float32Array | null = null
    let row = new Float64Array(0)
    let elapsed = 0
    let previous = 0
    let raf = 0
    let dirty = true
    let pointerX = REST_X
    let pointerY = REST_Y

    const measure = () => {
      const rect = canvas.getBoundingClientRect()
      if (!rect.width || !rect.height) return false
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.round(rect.width * dpr)
      canvas.height = Math.round(rect.height * dpr)
      glyph = Math.max(8, Math.min(15, Math.round(rect.width / 74)))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.font = `${glyph}px ${family}`
      ctx.textBaseline = 'top'
      cellWidth = ctx.measureText('M').width || glyph * 0.6
      cellHeight = Math.round(glyph * 1.44)
      cols = Math.max(24, Math.floor(rect.width / cellWidth))
      rows = Math.max(8, Math.floor(rect.height / cellHeight))
      if (row.length !== cols) row = new Float64Array(cols)
      viewWidth = rect.width
      viewHeight = rect.height
      return true
    }

    const buildRamp = () => {
      const seen = new Set<string>()
      ramp = [...themeRef.current.ansi, themeRef.current.foreground]
        .filter((color) => {
          if (seen.has(color)) return false
          seen.add(color)
          return true
        })
        .sort((a, b) => luminance(a) - luminance(b))
    }

    const buildMask = () => {
      if (!cols || rows < MASK_MIN_ROWS) {
        mask = null
        return
      }
      const stencil = document.createElement('canvas')
      stencil.width = cols
      stencil.height = rows
      const paint = stencil.getContext('2d', { willReadFrequently: true })
      if (!paint) {
        mask = null
        return
      }
      const word = themeRef.current.name.toUpperCase()
      paint.fillStyle = '#000'
      paint.fillRect(0, 0, cols, rows)
      paint.textAlign = 'center'
      paint.textBaseline = 'middle'
      paint.font = `700 100px ${family}`
      const reference = paint.measureText(word).width || 1
      const squash = cellWidth / cellHeight
      const size = Math.max(6, Math.floor(Math.min((rows * 0.58) / squash, (100 * cols * 0.78) / reference)))
      paint.font = `700 ${size}px ${family}`
      paint.fillStyle = '#fff'
      paint.translate(cols / 2, rows / 2)
      paint.scale(1, squash)
      paint.fillText(word, 0, 0)
      const pixels = paint.getImageData(0, 0, cols, rows).data
      const next = new Float32Array(cols * rows)
      for (let index = 0; index < next.length; index += 1) next[index] = (pixels[index * 4] ?? 0) / 255
      mask = next
    }

    const valueAt = (x: number, y: number, seconds: number) => {
      if (mask && (mask[y * cols + x] ?? 0) > 0.5) return 0.97
      const nx = x / cols
      const ny = y / rows
      const noise =
        Math.sin(nx * 4.2 + seconds * 0.23) * 0.42 +
        Math.sin(ny * 6.4 - seconds * 0.19) * 0.34 +
        Math.sin(nx * 3.1 + ny * 7.3 + seconds * 0.13) * 0.4 +
        Math.sin(nx * 9 - ny * 11 - seconds * 0.31) * 0.16
      const dx = (x - pointerX * cols) / cols
      const dy = ((y - pointerY * rows) / rows) * 0.52
      const light = Math.max(0, 1 - Math.hypot(dx, dy) / 0.34)
      return Math.min(0.84, Math.max(0, 0.26 + (noise / 1.32) * 0.22 + light * light * 0.26))
    }

    const slotOf = (value: number) => Math.min(ramp.length - 1, Math.floor(value * ramp.length))

    const render = () => {
      if (!cols || ramp.length === 0) return
      const palette = themeRef.current
      const seconds = elapsed / 1000
      const baseline = (cellHeight - glyph) * 0.42
      ctx.fillStyle = palette.background
      ctx.fillRect(0, 0, viewWidth, viewHeight)
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) row[x] = valueAt(x, y, seconds)
        let x = 0
        while (x < cols) {
          const slot = slotOf(row[x] ?? 0)
          const start = x
          let text = ''
          while (x < cols && slotOf(row[x] ?? 0) === slot) {
            text += RAMP[Math.floor((row[x] ?? 0) * RAMP.length)] ?? ' '
            x += 1
          }
          ctx.fillStyle = ramp[slot] ?? palette.foreground
          ctx.fillText(text, start * cellWidth, y * cellHeight + baseline)
        }
      }
    }

    const sync = () => {
      buildRamp()
      buildMask()
      dirty = true
    }

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const delta = Math.min(48, now - (previous || now))
      previous = now
      if (reduced.matches) {
        if (!dirty) return
        dirty = false
      } else {
        elapsed += delta
      }
      render()
    }

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      pointerX = (event.clientX - rect.left) / rect.width
      pointerY = (event.clientY - rect.top) / rect.height
      dirty = true
    }

    const onPointerLeave = () => {
      pointerX = REST_X
      pointerY = REST_Y
      dirty = true
    }

    const observer = new ResizeObserver(() => {
      collapse.style.setProperty('--collapse-h', `${field.offsetHeight}px`)
      if (measure()) sync()
    })
    observer.observe(field)
    collapse.addEventListener('pointermove', onPointerMove)
    collapse.addEventListener('pointerleave', onPointerLeave)
    syncRef.current = sync

    if (measure()) sync()
    raf = requestAnimationFrame(tick)
    document.fonts.ready.then(() => {
      if (measure()) sync()
    })

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      collapse.removeEventListener('pointermove', onPointerMove)
      collapse.removeEventListener('pointerleave', onPointerLeave)
      syncRef.current = null
    }
  }, [])

  return (
    <>
      <button
        ref={collapseRef}
        type="button"
        aria-label="Switch to the next palette"
        onClick={onNext}
        className="hero-collapse block w-full cursor-pointer text-left"
      >
        <div ref={fieldRef} className="hero-field">
          <canvas ref={canvasRef} aria-hidden />
        </div>
      </button>
      <div className="mt-2.5 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs text-muted">
        <b className="text-[13px] text-ink">{theme.name}</b>
        <span>{theme.group}</span>
        <span className="tabular-nums">{position}</span>
        <span className="ml-auto max-sm:hidden">
          hover to light the field · click — next palette ·{' '}
          <kbd className="rounded border border-line px-1.5 py-px text-[11px]">←</kbd>{' '}
          <kbd className="rounded border border-line px-1.5 py-px text-[11px]">→</kbd> browse
        </span>
      </div>
    </>
  )
}
