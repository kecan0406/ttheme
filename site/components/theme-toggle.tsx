'use client'

import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { applyMode, readMode, type ThemeMode } from '@/lib/theme-mode'

const MODES: { mode: ThemeMode; label: string; icon: ReactNode }[] = [
  { mode: 'system', label: 'follow the system', icon: <MonitorIcon /> },
  { mode: 'light', label: 'light', icon: <SunIcon /> },
  { mode: 'dark', label: 'dark', icon: <MoonIcon /> },
]

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>('system')

  useEffect(() => setMode(readMode()), [])

  useEffect(() => {
    if (mode !== 'system') return
    const query = matchMedia('(prefers-color-scheme: dark)')
    const follow = () => applyMode('system')
    query.addEventListener('change', follow)
    return () => query.removeEventListener('change', follow)
  }, [mode])

  return (
    <ToggleGroup
      aria-label="color theme"
      value={[mode]}
      onValueChange={(value) => {
        const next = value[0] as ThemeMode | undefined
        if (!next) return
        setMode(next)
        applyMode(next)
      }}
    >
      {MODES.map(({ mode: value, label, icon }) => (
        <ToggleGroupItem key={value} value={value} aria-label={label} className="px-2">
          {icon}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
