'use client'

import Link from 'next/link'
import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react'
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group'
import { ScrollArea } from '@/components/ui/scroll-area'
import { seriesOf, sheetNumber } from '@/lib/sheet'
import type { Theme } from '@/lib/themes'
import { CopyCommand } from './copy-command'

const LINK = 'text-muted-foreground transition-colors hover:text-primary'

function matches(theme: Theme, query: string): boolean {
  return !query || `${theme.name} ${theme.group} ${theme.native ?? ''}`.toLowerCase().includes(query)
}

function Row({
  theme,
  number,
  current,
  onPick,
}: {
  theme: Theme
  number: string
  current: boolean
  onPick: () => void
}) {
  return (
    <button
      type="button"
      data-sheet={theme.name}
      aria-current={current}
      onClick={onPick}
      style={{ '--pb': theme.background, '--pf': theme.foreground, '--pc': theme.cursor } as CSSProperties}
      className="grid w-full cursor-pointer grid-cols-[3ch_auto_minmax(0,1fr)] items-center gap-2.5 rounded-[2px] border border-[color-mix(in_oklab,var(--pf)_12%,var(--pb))] bg-(--pb) px-2 py-[5px] text-left text-[12.5px] text-(--pf) hover:border-(--pc) aria-[current=true]:font-bold aria-[current=true]:outline-2 aria-[current=true]:outline-offset-1 aria-[current=true]:outline-ring"
    >
      <span className="text-[10.5px] text-[color-mix(in_oklab,var(--pf)_50%,var(--pb))] tabular-nums">{number}</span>
      <span aria-hidden="true" className="flex">
        {theme.signature.map((color, index) =>
          theme.signatureSlots[index] === 'selection' ? (
            <i
              key="selection"
              className="h-2.5 w-4 rounded-full shadow-[0_0_0_2px_var(--pb),inset_0_0_0_1px_color-mix(in_oklab,var(--pf)_55%,transparent)] not-first:-ml-0.5"
              style={{ background: color }}
            />
          ) : (
            <i
              key={theme.signatureSlots[index]}
              className="size-2.5 rounded-full shadow-[0_0_0_2px_var(--pb)] not-first:-ml-0.5"
              style={{ background: color }}
            />
          ),
        )}
      </span>
      <span className="truncate">{theme.name}</span>
    </button>
  )
}

export function SheetSidebar({
  themes,
  current,
  version,
  command,
  open,
  onPick,
}: {
  themes: Theme[]
  current: Theme
  version: string
  command: string
  open: boolean
  onPick: (theme: Theme) => void
}) {
  const [filter, setFilter] = useState('')
  const viewportRef = useRef<HTMLDivElement>(null)
  const series = useMemo(() => seriesOf(themes), [themes])
  const query = filter.trim().toLowerCase()
  const visible = series
    .map((entry) => ({ ...entry, count: entry.themes.length, themes: entry.themes.filter((t) => matches(t, query)) }))
    .filter((entry) => entry.themes.length > 0)
  const hits = visible.reduce((sum, entry) => sum + entry.themes.length, 0)

  useEffect(() => {
    const viewport = viewportRef.current
    const row = viewport?.querySelector<HTMLElement>(`[data-sheet="${current.name}"]`)
    if (!viewport || !row) return
    const top = row.getBoundingClientRect().top - viewport.getBoundingClientRect().top + viewport.scrollTop
    const bottom = top + row.offsetHeight + 10
    if (top - 36 < viewport.scrollTop) viewport.scrollTop = top - 36
    else if (bottom > viewport.scrollTop + viewport.clientHeight) viewport.scrollTop = bottom - viewport.clientHeight
  }, [current.name])

  return (
    <aside
      id="sheets"
      aria-label="sheets"
      data-open={open ? '' : undefined}
      className="grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)_auto] border-r bg-sidebar max-[860px]:fixed max-[860px]:inset-y-0 max-[860px]:left-0 max-[860px]:z-30 max-[860px]:w-[min(88vw,320px)] max-[860px]:-translate-x-full max-[860px]:transition-transform max-[860px]:duration-250 max-[860px]:data-open:translate-x-0 motion-reduce:transition-none"
    >
      <div className="flex items-baseline justify-between gap-3 px-4 pt-3.5 pb-3 text-xs text-muted-foreground">
        <span>
          <b className="text-[13px] text-foreground">ttheme</b> {version}
        </span>
        <nav className="flex gap-3.5">
          <Link href="/markets" className={LINK}>
            markets
          </Link>
          <a href="https://github.com/kecan0406/ttheme" className={LINK}>
            github
          </a>
          <a href="https://www.npmjs.com/package/@kecan0406/ttheme" className={LINK}>
            npm
          </a>
        </nav>
      </div>

      <div className="grid gap-2.5 border-y px-4 py-3">
        <h2 className="text-[13px] font-bold">
          {themes.length} sheets <span className="font-normal text-muted-foreground">in {series.length} series</span>
        </h2>
        <InputGroup className="h-auto rounded-[3px] border-border bg-background has-[[data-slot=input-group-control]:focus-visible]:border-primary has-[[data-slot=input-group-control]:focus-visible]:ring-0 dark:bg-background">
          <InputGroupAddon>
            <InputGroupText className="text-primary">/</InputGroupText>
          </InputGroupAddon>
          <InputGroupInput
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="name or series"
            aria-label="filter sheets by name or series"
            spellCheck={false}
            autoComplete="off"
            className="h-7 text-[12.5px] placeholder:text-muted-foreground/70 md:text-[12.5px]"
          />
          <InputGroupAddon align="inline-end">
            <InputGroupText className="text-[11px] tabular-nums">
              {hits}/{themes.length}
            </InputGroupText>
          </InputGroupAddon>
        </InputGroup>
      </div>

      <ScrollArea viewportRef={viewportRef} contentClassName="px-2.5 pb-3.5 contain-inline-size">
        {visible.map((entry) => (
          <section key={entry.name} aria-label={entry.name}>
            <h3 className="sticky top-0 z-1 flex items-baseline justify-between gap-2.5 bg-sidebar px-1.5 pt-3 pb-1.5 text-[11px] font-bold tracking-[.06em] uppercase">
              {entry.name}
              <span className="font-normal tracking-normal text-muted-foreground/70 tabular-nums">{entry.count}</span>
            </h3>
            <div className="grid gap-[3px]">
              {entry.themes.map((theme) => (
                <Row
                  key={theme.name}
                  theme={theme}
                  number={sheetNumber(themes, theme)}
                  current={theme === current}
                  onPick={() => onPick(theme)}
                />
              ))}
            </div>
          </section>
        ))}
        {hits === 0 ? <p className="mx-1.5 my-4 text-muted-foreground">no sheet matches “{filter.trim()}”</p> : null}
      </ScrollArea>

      <div className="grid gap-2 border-t px-4 pt-3 pb-3.5 text-[11.5px] text-muted-foreground">
        <CopyCommand command={command} />
        <p>
          ghostty · kitty · alacritty · iterm2. wezterm gets an archive in the{' '}
          <a
            href="https://github.com/kecan0406/ttheme/releases/latest"
            className="text-foreground underline decoration-border underline-offset-[3px] hover:decoration-primary"
          >
            latest release
          </a>
          .
        </p>
      </div>
    </aside>
  )
}
