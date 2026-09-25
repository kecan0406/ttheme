'use client'

import { useEffect, useRef, useState } from 'react'

const FACES = ['(・ω・)', '(＾▽＾)', '( ˘ω˘ )', '(>ω<)', 'uwu', 'owo', '(｡•ᴗ•｡)']
const WORD = 'uwu'

interface Drop {
  id: number
  face: string
  left: number
  slot: number
}

export function KaomojiRain() {
  const [drops, setDrops] = useState<Drop[]>([])
  const typed = useRef('')
  const next = useRef(0)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.metaKey || event.ctrlKey) return
      typed.current = (typed.current + event.key).slice(-WORD.length)
      if (typed.current !== WORD || matchMedia('(prefers-reduced-motion: reduce)').matches) return
      typed.current = ''
      const batch = Array.from({ length: 24 }, (_, index) => ({
        id: next.current++,
        face: FACES[index % FACES.length] as string,
        left: Math.random() * 96,
        slot: [1, 3, 5, 9, 12, 13, 14][index % 7] as number,
      }))
      setDrops((list) => [...list, ...batch])
      window.setTimeout(() => setDrops((list) => list.filter((drop) => !batch.includes(drop))), 2400)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {drops.map((drop, index) => (
        <span
          key={drop.id}
          className="absolute -top-8 animate-rain font-display text-base font-extrabold"
          style={{ left: `${drop.left}%`, color: `var(--a${drop.slot})`, animationDelay: `${(index % 24) * 45}ms` }}
        >
          {drop.face}
        </span>
      ))}
    </div>
  )
}
