import { escapeHtml } from '@kitajs/html'
import { ChevronDown, ChevronLeft, ChevronRight, Gauge, List, SwatchBook } from 'lucide'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { catalogsOf } from '@/lib/catalogs'
import { Icon } from '@/lib/icons'
import { json } from '@/lib/render'
import { gatePassed, sheetNumber } from '@/lib/sheet'
import type { GateRule, Theme } from '@/lib/themes'
import { wearStyle } from '@/lib/wear'
import { CommandRow } from './command-row'
import { GateList, PropertyList, SectionLabel, Signature, SwatchGrid } from './palette-parts'
import { SiteHeader } from './site-header'
import { TerminalWindow } from './terminal-window'

export function SheetHeading({ themes, theme, gate }: { themes: Theme[]; theme: Theme; gate: GateRule[] }) {
  const passed = gatePassed(theme, gate)
  return (
    <>
      <span class="font-mono text-xs text-muted-foreground tabular-nums" safe>
        {`${sheetNumber(themes, theme)} / ${themes.length}`}
      </span>
      <h1 class="font-display text-display-lg font-black text-primary [overflow-wrap:anywhere]" safe>
        {theme.name}
      </h1>
      <div class="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-soft-foreground">
        <span safe>{`${theme.catalog ?? ''}${theme.lead ? ' · lead' : ''}`}</span>
        <Signature theme={theme} />
        <Badge variant={passed === gate.length ? 'success' : 'warning'}>
          {passed} / {gate.length} floors
        </Badge>
      </div>
    </>
  )
}

export function SheetDetails({ theme, gate }: { theme: Theme; gate: GateRule[] }) {
  return (
    <>
      <div class="grid content-start gap-6">
        <section>
          <SectionLabel icon={<Icon node={List} />}>Properties</SectionLabel>
          <PropertyList
            rows={[
              ['Catalog', `${theme.catalog ?? ''}${theme.lead ? ' · lead' : ''}`],
              ['ANSI from', theme.ansiSource],
              ['Signature', theme.signatureSlots.join(' · ')],
            ]}
          />
        </section>
        <section>
          <SectionLabel icon={<Icon node={Gauge} />}>Contrast gate</SectionLabel>
          <GateList theme={theme} gate={gate} />
        </section>
      </div>
      <section>
        <SectionLabel icon={<Icon node={SwatchBook} />}>Slots</SectionLabel>
        <SwatchGrid theme={theme} />
      </section>
    </>
  )
}

export function SheetUse({ theme }: { theme: Theme }) {
  return <CommandRow command={`ttheme use ${theme.name}`} class="min-w-70 flex-1 bg-card" />
}

export function Sheets({ themes, gate }: { themes: Theme[]; gate: GateRule[] }) {
  const theme = themes[0] as Theme
  const tabs = themes.slice(0, 3).map((sheet, id) => ({ id, theme: sheet }))

  return (
    <sheet-browser class="wear ground flex min-h-dvh flex-col" style={wearStyle(theme)}>
      <div class="mx-auto grid w-[min(1280px,calc(100%-40px))] flex-1 grid-cols-[minmax(0,1fr)] content-start gap-5 pt-4.5">
        <SiteHeader current="/sheets" themeToggle={false} />

        <section data-sheet-label aria-label={theme.name} class="grid justify-items-center gap-6 pt-8 pb-10">
          <div class="grid w-full max-w-[880px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4">
            <Button variant="outline" size="icon" aria-label="previous sheet" data-step="-1">
              <Icon node={ChevronLeft} />
            </Button>
            <div data-heading class="grid justify-items-center gap-2 text-center">
              <SheetHeading themes={themes} theme={theme} gate={gate} />
            </div>
            <Button variant="outline" size="icon" aria-label="next sheet" data-step="1">
              <Icon node={ChevronRight} />
            </Button>
          </div>

          <div class="w-full max-w-[880px]">
            <TerminalWindow theme={theme} tabs={tabs} active={0} />
          </div>

          <div class="grid w-full max-w-[880px] gap-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div data-use class="contents">
                <SheetUse theme={theme} />
              </div>
              <Button
                variant="outline"
                class="group/details"
                aria-expanded="false"
                aria-controls="sheet-details"
                data-details
              >
                slots and contrast
                <Icon node={ChevronDown} class="transition-transform group-aria-expanded/details:rotate-180" />
              </Button>
            </div>
            <div
              id="sheet-details"
              hidden
              class="grid grid-cols-2 gap-6 rounded-3xl border bg-glass-panel p-6 shadow-md backdrop-blur-[22px] backdrop-saturate-170 motion-safe:animate-enter max-[760px]:grid-cols-1"
            >
              <SheetDetails theme={theme} gate={gate} />
            </div>
          </div>
        </section>
      </div>

      <nav
        aria-label="every sheet"
        class="sticky bottom-4 mx-auto mb-4 flex w-[min(1280px,calc(100%-40px))] items-center gap-2 rounded-xl border bg-glass p-2 shadow-md backdrop-blur-[14px]"
      >
        <Button variant="ghost" size="icon-sm" aria-label="scroll back" data-scroll="-1">
          <Icon node={ChevronLeft} />
        </Button>
        <div data-strip class="flex min-w-0 flex-1 snap-x gap-2 overflow-x-auto py-1 [scrollbar-width:none]">
          {catalogsOf(themes).map((entry) => (
            <div class="flex flex-none items-stretch gap-2">
              <span
                class="flex flex-none items-center pr-1 pl-2 text-2xs font-bold tracking-caps whitespace-nowrap text-muted-foreground uppercase"
                safe
              >
                {entry.catalog}
              </span>
              {entry.themes.map((sheet) => (
                <button
                  type="button"
                  data-sheet={String(themes.indexOf(sheet))}
                  aria-current={sheet === theme ? 'true' : undefined}
                  style={`background:${sheet.background};color:${sheet.foreground}`}
                  class="grid w-32 flex-none snap-center gap-1 rounded-2xl border border-[color-mix(in_oklab,currentColor_14%,transparent)] px-3 py-2 text-left transition-transform duration-200 outline-none hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring active:scale-98 active:duration-500 active:ease-spring aria-[current=true]:ring-2 aria-[current=true]:ring-ring motion-reduce:hover:translate-y-0"
                >
                  <span class="truncate font-display text-sm font-extrabold" style={`color:${sheet.cursor}`}>
                    {escapeHtml(sheet.name)}
                  </span>
                  <Signature theme={sheet} />
                </button>
              ))}
            </div>
          ))}
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="scroll on" data-scroll="1">
          <Icon node={ChevronRight} />
        </Button>
      </nav>
      <script type="application/json" data-sheets>
        {json({ themes, gate })}
      </script>
    </sheet-browser>
  )
}
