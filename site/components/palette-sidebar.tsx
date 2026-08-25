'use client'

import { useMemo } from 'react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { Theme } from '@/lib/themes'

const sigSlots = ['signature', 'support', 'accent']

export function matchesFilter(theme: Theme, filter: string): boolean {
  const query = filter.trim().toLowerCase()
  return !query || `${theme.name} ${theme.group} ${theme.native ?? ''}`.toLowerCase().includes(query)
}

interface Band {
  group: string
  native: string | null
  accent: string
  themes: Theme[]
}

export function bandsOf(themes: Theme[]): Band[] {
  const bands: Band[] = []
  for (const theme of themes) {
    const open = bands.at(-1)
    if (open?.group === theme.group) open.themes.push(theme)
    else bands.push({ group: theme.group, native: theme.native, accent: theme.signature[0] as string, themes: [theme] })
  }
  for (const band of bands) {
    band.accent = (band.themes.find((theme) => theme.lead) ?? band.themes[0])?.signature[0] as string
  }
  return bands
}

function Signature({ theme, className }: { theme: Theme; className: string }) {
  return (
    <span className={`flex gap-0.5 ${className}`}>
      {theme.signature.map((color, index) => (
        <i
          key={sigSlots[index]}
          className={`rounded-[2px] ${index === 0 ? 'flex-[2.4]' : 'flex-1'}`}
          style={{ background: color }}
        />
      ))}
    </span>
  )
}

function Row({ theme, active, onWear }: { theme: Theme; active: boolean; onWear: () => void }) {
  return (
    <button
      type="button"
      onClick={onWear}
      aria-current={active ? 'true' : undefined}
      className="flex w-full cursor-pointer items-center gap-2.5 rounded-[5px] px-2 py-[5px] text-left text-[12.5px] text-muted-foreground hover:bg-card hover:text-foreground aria-[current=true]:bg-accent aria-[current=true]:font-bold aria-[current=true]:text-foreground"
    >
      <Signature theme={theme} className="h-2.5 w-[30px] flex-none" />
      <span>{theme.name}</span>
      {theme.lead ? <span className="ml-auto text-[10px] font-normal text-muted-foreground/80">lead</span> : null}
    </button>
  )
}

function Group({ band, current, onWear }: { band: Band; current: Theme; onWear: (theme: Theme) => void }) {
  const holds = band.themes.includes(current)
  return (
    <AccordionItem value={band.group}>
      <AccordionTrigger className="group text-[12.5px]">
        <i className="size-0 flex-none border-4 border-transparent border-l-[5px] border-l-muted-foreground transition-transform group-data-panel-open:rotate-90 motion-reduce:transition-none" />
        <i className="size-2 flex-none rounded-[2px]" style={{ background: band.accent }} />
        <span className="font-bold">{band.group}</span>
        {band.native ? <span className="min-w-0 truncate text-[11px] text-muted-foreground">{band.native}</span> : null}
        {holds ? (
          <Signature theme={current} className="ml-auto h-2 w-[22px] flex-none group-data-panel-open:hidden" />
        ) : null}
        <span
          className={`pl-2 text-[11px] text-muted-foreground tabular-nums ${holds ? 'group-data-panel-open:ml-auto' : 'ml-auto'}`}
        >
          {band.themes.length}
        </span>
      </AccordionTrigger>
      <AccordionContent className="flex flex-col pt-0.5 pb-1.5 pl-3.5">
        {band.themes.map((theme) => (
          <Row key={theme.name} theme={theme} active={theme === current} onWear={() => onWear(theme)} />
        ))}
      </AccordionContent>
    </AccordionItem>
  )
}

export function PaletteSidebar({
  themes,
  current,
  open,
  onOpenChange,
  filter,
  onFilterChange,
  onWear,
}: {
  themes: Theme[]
  current: Theme
  open: string[]
  onOpenChange: (open: string[]) => void
  filter: string
  onFilterChange: (filter: string) => void
  onWear: (theme: Theme) => void
}) {
  const bands = useMemo(() => bandsOf(themes), [themes])
  const visible = useMemo(
    () =>
      bands
        .map((band) => ({ ...band, themes: band.themes.filter((theme) => matchesFilter(theme, filter)) }))
        .filter((band) => band.themes.length > 0),
    [bands, filter],
  )

  return (
    <aside
      aria-label="palettes"
      className="flex min-h-0 w-[304px] flex-col border-l max-md:w-auto max-md:border-t max-md:border-l-0"
    >
      <div className="flex items-baseline gap-2.5 border-b py-3 pr-2.5 pl-4 whitespace-nowrap">
        <b className="text-[13px]">palettes</b>
        <span className="text-[11.5px] text-muted-foreground tabular-nums">
          {themes.length} · {bands.length} series
        </span>
      </div>
      <InputGroup className="mx-3 mt-2.5 mb-1.5 w-auto">
        <InputGroupAddon>
          <InputGroupText>/</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput
          value={filter}
          onChange={(event) => onFilterChange(event.target.value)}
          placeholder="find a character or series"
          spellCheck={false}
          className="text-xs md:text-xs"
        />
      </InputGroup>
      <ScrollArea className="flex-1" contentClassName="contain-inline-size px-2 pt-1 pb-4">
        <Accordion multiple value={open} onValueChange={onOpenChange} disabled={filter.trim() !== ''}>
          {visible.map((band) => (
            <Group key={band.group} band={band} current={current} onWear={onWear} />
          ))}
        </Accordion>
        {visible.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">no palette matches “{filter}”</p>
        ) : null}
      </ScrollArea>
    </aside>
  )
}
