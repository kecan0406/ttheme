'use client'

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'

interface Spark {
  id: number
  x: number
  y: number
  size: number
  color: string
}

const STAR =
  'M80 0C80 0 84 60 104 76C124 92 160 80 160 80C160 80 124 84 104 104C84 124 80 160 80 160C80 160 76 124 56 104C36 84 0 80 0 80C0 80 36 76 56 56C76 36 80 0 80 0Z'

export function Sparkles({ colors, burst, children }: { colors: string[]; burst: string; children: ReactNode }) {
  const [sparks, setSparks] = useState<Spark[]>([])
  const next = useRef(0)

  const spawn = useCallback(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    for (const [index, color] of colors.entries()) {
      window.setTimeout(() => {
        const spark = {
          id: next.current++,
          x: Math.random() * 100,
          y: Math.random() * 90 - 20,
          size: 10 + Math.random() * 10,
          color,
        }
        setSparks((list) => [...list, spark])
        window.setTimeout(() => setSparks((list) => list.filter((s) => s.id !== spark.id)), 800)
      }, index * 140)
    }
  }, [colors])

  useEffect(() => {
    if (burst) spawn()
  }, [burst, spawn])

  return (
    <span className="relative inline-block" onPointerEnter={spawn}>
      {children}
      {sparks.map((spark) => (
        <svg
          key={spark.id}
          aria-hidden="true"
          viewBox="0 0 160 160"
          className="pointer-events-none absolute animate-sparkle"
          style={{ left: `${spark.x}%`, top: `${spark.y}%`, width: spark.size, height: spark.size }}
        >
          <path fill={spark.color} d={STAR} />
        </svg>
      ))}
    </span>
  )
}
