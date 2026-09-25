'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Market } from '@/lib/markets'
import type { GateRule, Theme } from '@/lib/themes'
import { isLight } from '@/lib/wear'
import { FilterBar, type Filters } from './filter-bar'
import { PaletteCard } from './palette-card'
import { PaletteDialog } from './palette-dialog'

export interface Section {
  key: string
  title: string
  href?: string
  themes: Theme[]
}

function matches(theme: Theme, { query, source, ground }: Filters): boolean {
  if (source === 'official' && theme.market) return false
  if (source === 'markets' && !theme.market) return false
  if (ground !== 'both' && isLight(theme) !== (ground === 'light')) return false
  const q = query.trim().toLowerCase()
  return !q || `${theme.id} ${theme.group} ${theme.native ?? ''}`.toLowerCase().includes(q)
}

export function MarketGallery({
  sections,
  markets,
  gate,
  sources = true,
}: {
  sections: Section[]
  markets: Market[]
  gate: GateRule[]
  sources?: boolean
}) {
  const [filters, setFilters] = useState<Filters>({ query: '', source: 'all', ground: 'both', scene: 'shell' })
  const [openId, setOpenId] = useState<string | null>(null)
  const all = useMemo(() => sections.flatMap((section) => section.themes), [sections])
  const open = all.find((theme) => theme.id === openId) ?? null

  useEffect(() => {
    const read = () => {
      const id = decodeURIComponent(window.location.hash.slice(1))
      setOpenId(all.some((theme) => theme.id === id) ? id : null)
    }
    read()
    window.addEventListener('hashchange', read)
    return () => window.removeEventListener('hashchange', read)
  }, [all])

  const show = useCallback((id: string | null) => {
    setOpenId(id)
    const url = `${window.location.pathname}${window.location.search}${id ? `#${id}` : ''}`
    window.history.replaceState(null, '', url)
  }, [])

  const visible = sections
    .map((section) => ({ ...section, themes: section.themes.filter((theme) => matches(theme, filters)) }))
    .filter((section) => section.themes.length > 0)
  const shown = visible.reduce((sum, section) => sum + section.themes.length, 0)
  const firstMarket = visible.find((section) => section.themes[0]?.market)

  return (
    <>
      <FilterBar
        filters={filters}
        onChange={(next) => setFilters((current) => ({ ...current, ...next }))}
        shown={shown}
        total={all.length}
        sources={sources}
      />
      <div className="grid gap-8 pt-5 pb-15">
        {visible.map((section) => (
          <section key={section.key} aria-label={section.title} className="grid gap-4">
            {section === firstMarket && sources ? (
              <div className="flex items-center gap-3 text-sm text-muted-foreground after:h-px after:flex-1 after:bg-border">
                ── markets
              </div>
            ) : null}
            <h2 className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-base font-semibold">{section.title}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{section.themes.length}</span>
              {section.href ? (
                <Link
                  href={section.href}
                  className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                >
                  market page
                </Link>
              ) : null}
            </h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
              {section.themes.map((theme) => (
                <PaletteCard key={theme.id} theme={theme} scene={filters.scene} onOpen={() => show(theme.id)} />
              ))}
            </div>
          </section>
        ))}
        {shown === 0 ? (
          <div className="py-15 text-center text-muted-foreground">
            <strong className="block font-semibold text-foreground">
              no palette matches{filters.query.trim() ? ` “${filters.query.trim()}”` : ' these filters'} ( ˘ω˘ )
            </strong>
            clear a filter, or search for a series instead.
          </div>
        ) : null}
      </div>
      <PaletteDialog
        theme={open}
        market={markets.find((market) => market.id === open?.market)}
        gate={gate}
        scene={filters.scene}
        onScene={(scene) => setFilters((current) => ({ ...current, scene }))}
        onClose={() => show(null)}
      />
    </>
  )
}
