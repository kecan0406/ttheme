'use client'

import { Accordion } from '@base-ui/react/accordion'
import { Collapsible } from '@base-ui/react/collapsible'
import { Input } from '@base-ui/react/input'
import { ScrollArea } from '@base-ui/react/scroll-area'
import { Tooltip } from '@base-ui/react/tooltip'
import {
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
} from 'react'
import type { Theme } from '@/lib/themes'

const sigSlots = ['signature', 'support', 'accent']

export function matchesFilter(theme: Theme, filter: string): boolean {
  return !filter || `${theme.name} ${theme.group} ${theme.native ?? ''}`.toLowerCase().includes(filter)
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

export function Tip({
  label,
  side = 'bottom',
  children,
}: {
  label: ReactNode
  side?: 'bottom' | 'left'
  children: ReactElement
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={children} />
      <Tooltip.Portal>
        <Tooltip.Positioner side={side} sideOffset={6}>
          <Tooltip.Popup className="origin-(--transform-origin) rounded border border-line bg-ground px-2 py-1 text-[11px] whitespace-nowrap text-ink shadow-lg shadow-black/40 transition-[opacity,transform] duration-100 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:transition-none">
            {label}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}

function Row({ theme, active, onWear }: { theme: Theme; active: boolean; onWear: () => void }) {
  return (
    <button
      type="button"
      onClick={onWear}
      aria-current={active ? 'true' : undefined}
      className="flex w-full cursor-pointer items-center gap-2.5 rounded-[5px] px-2 py-[5px] text-left text-[12.5px] text-muted hover:bg-card hover:text-ink aria-[current=true]:bg-accent/15 aria-[current=true]:font-bold aria-[current=true]:text-ink"
    >
      <Signature theme={theme} className="h-2.5 w-[30px] flex-none" />
      <span>{theme.name}</span>
      {theme.lead ? <span className="ml-auto text-[10px] font-normal text-muted/80">lead</span> : null}
    </button>
  )
}

function Group({ band, current, onWear }: { band: Band; current: Theme; onWear: (theme: Theme) => void }) {
  const holds = band.themes.includes(current)
  return (
    <Accordion.Item value={band.group}>
      <Accordion.Header className="text-[12.5px] font-normal">
        <Accordion.Trigger className="group flex w-full cursor-pointer items-center gap-2 rounded-[5px] px-2 py-[7px] text-left whitespace-nowrap hover:not-data-disabled:bg-card data-disabled:cursor-default">
          <i className="size-0 flex-none border-4 border-transparent border-l-[5px] border-l-muted transition-transform group-data-panel-open:rotate-90 motion-reduce:transition-none" />
          <i className="size-2 flex-none rounded-[2px]" style={{ background: band.accent }} />
          <span className="font-bold">{band.group}</span>
          {band.native ? <span className="min-w-0 truncate text-[11px] text-muted">{band.native}</span> : null}
          {holds ? (
            <Signature theme={current} className="ml-auto h-2 w-[22px] flex-none group-data-panel-open:hidden" />
          ) : null}
          <span
            className={`pl-2 text-[11px] text-muted tabular-nums ${holds ? 'group-data-panel-open:ml-auto' : 'ml-auto'}`}
          >
            {band.themes.length}
          </span>
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Panel className="h-(--accordion-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none">
        <div className="flex flex-col pt-0.5 pb-1.5 pl-3.5">
          {band.themes.map((theme) => (
            <Row key={theme.name} theme={theme} active={theme === current} onWear={() => onWear(theme)} />
          ))}
        </div>
      </Accordion.Panel>
    </Accordion.Item>
  )
}

export function PaletteSidebar({
  themes,
  current,
  open,
  onOpenChange,
  collapsed,
  onCollapsedChange,
  filter,
  onFilterChange,
  onSubmit,
  onStep,
  onWear,
  reveal,
  inputRef,
}: {
  themes: Theme[]
  current: Theme
  open: string[]
  onOpenChange: (open: string[]) => void
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  filter: string
  onFilterChange: (filter: string) => void
  onSubmit: () => void
  onStep: (direction: number) => void
  onWear: (theme: Theme) => void
  reveal: number
  inputRef: RefObject<HTMLInputElement | null>
}) {
  const bands = useMemo(() => bandsOf(themes), [themes])
  const visible = useMemo(
    () =>
      bands
        .map((band) => ({ ...band, themes: band.themes.filter((theme) => matchesFilter(theme, filter)) }))
        .filter((band) => band.themes.length > 0),
    [bands, filter],
  )
  const viewportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!reveal) return
    const scroll = () =>
      viewportRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' })
    scroll()
    const settle = window.setTimeout(scroll, 220)
    return () => clearTimeout(settle)
  }, [reveal])

  const onFilterKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') event.currentTarget.blur()
    else if (event.key === 'Enter') onSubmit()
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      onStep(event.key === 'ArrowDown' ? 1 : -1)
    }
  }

  return (
    <Collapsible.Root
      open={!collapsed}
      onOpenChange={(isOpen) => onCollapsedChange(!isOpen)}
      render={<aside aria-label="palettes" />}
      className="relative flex min-h-0 border-l border-line max-md:absolute max-md:inset-y-0 max-md:right-0 max-md:z-10 max-md:bg-ground max-md:shadow-[-12px_0_32px_rgba(0,0,0,0.55)]"
    >
      <Collapsible.Panel className="w-(--collapsible-panel-width) overflow-hidden transition-[width] duration-250 ease-out data-ending-style:w-0 data-starting-style:w-0 motion-reduce:transition-none">
        <div className="flex h-full w-[304px] flex-col">
          <div className="flex items-baseline gap-2.5 border-b border-line py-3 pr-2.5 pl-4 whitespace-nowrap">
            <b className="text-[13px]">palettes</b>
            <span className="text-[11.5px] text-muted tabular-nums">
              {themes.length} · {bands.length} series
            </span>
            <Tip
              label={
                <>
                  collapse <kbd>\</kbd>
                </>
              }
            >
              <Collapsible.Trigger
                aria-label="collapse sidebar"
                className="ml-auto size-6 cursor-pointer self-center rounded text-muted hover:bg-card hover:text-ink"
              >
                ⟩
              </Collapsible.Trigger>
            </Tip>
          </div>
          <label
            htmlFor="palette-filter"
            className="mx-3 mt-2.5 mb-1.5 flex items-center gap-2 rounded-md border border-line px-2.5 py-1.5 text-xs text-muted focus-within:border-accent"
          >
            <span>/</span>
            <Input
              id="palette-filter"
              ref={inputRef}
              value={filter}
              onValueChange={onFilterChange}
              onKeyDown={onFilterKey}
              placeholder="find a character or series"
              spellCheck={false}
              className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-muted/70"
            />
          </label>
          <ScrollArea.Root className="min-h-0 flex-1">
            <ScrollArea.Viewport
              ref={viewportRef}
              className="h-full focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
            >
              <ScrollArea.Content className="contain-inline-size px-2 pt-1 pb-4">
                <Accordion.Root multiple value={open} onValueChange={onOpenChange} disabled={filter !== ''}>
                  {visible.map((band) => (
                    <Group key={band.group} band={band} current={current} onWear={onWear} />
                  ))}
                </Accordion.Root>
                {visible.length === 0 ? (
                  <p className="px-2 py-3 text-xs text-muted">no palette matches “{filter}”</p>
                ) : null}
              </ScrollArea.Content>
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar className="m-px flex w-1.5 justify-center opacity-0 transition-opacity data-hovering:opacity-100 data-scrolling:opacity-100 data-scrolling:duration-0">
              <ScrollArea.Thumb className="w-full rounded-full bg-line" />
            </ScrollArea.Scrollbar>
          </ScrollArea.Root>
        </div>
      </Collapsible.Panel>
      <Tip
        side="left"
        label={
          <>
            open palettes <kbd>\</kbd>
          </>
        }
      >
        <Collapsible.Trigger
          aria-label="open sidebar"
          className="flex w-9 cursor-pointer flex-col items-center gap-3.5 pt-3 pb-3.5 text-muted hover:bg-card hover:text-ink data-panel-open:hidden"
        >
          <span>⟨</span>
          <span className="text-[11px] tracking-[0.06em] [writing-mode:vertical-rl]">palettes · {themes.length}</span>
          <Signature theme={current} className="mt-auto h-[34px] w-2.5 flex-col" />
        </Collapsible.Trigger>
      </Tip>
    </Collapsible.Root>
  )
}
