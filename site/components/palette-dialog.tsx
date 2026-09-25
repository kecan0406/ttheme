'use client'

import { GaugeIcon, ListIcon, PaletteIcon, SwatchBookIcon } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { Market } from '@/lib/markets'
import { gatePassed, luminance } from '@/lib/sheet'
import type { GateRule, Theme } from '@/lib/themes'
import { wearStyle } from '@/lib/wear'
import { CommandRow } from './command-row'
import { PaletteBadges } from './palette-card'
import { GateList, PropertyList, SectionLabel, Signature, SwatchGrid } from './palette-parts'
import { SCENES, type Scene, TerminalPreview } from './terminal-preview'

function commands(theme: Theme, market: Market | undefined): string[] {
  if (!market) return [`ttheme add ${theme.name}`, `ttheme use ${theme.name}`]
  return [`ttheme market add ${market.add}`, `ttheme add ${theme.id}`, `ttheme use ${theme.id}`]
}

function lightness(hex: string): string {
  const y = luminance(hex)
  return (y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : (24389 / 27) * y).toFixed(1)
}

export function PaletteDialog({
  theme,
  market,
  gate,
  scene,
  onScene,
  onClose,
}: {
  theme: Theme | null
  market: Market | undefined
  gate: GateRule[]
  scene: Scene
  onScene: (scene: Scene) => void
  onClose: () => void
}) {
  return (
    <Dialog open={theme !== null} onOpenChange={(open) => (open ? null : onClose())}>
      {theme ? (
        <DialogContent
          style={wearStyle(theme)}
          className="wear grid grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)] grid-rows-[minmax(0,1fr)_auto] max-[860px]:grid-cols-1 max-[860px]:grid-rows-none max-[860px]:overflow-y-auto"
        >
          <DialogHeader className="min-w-0 px-6 pt-5.5 pb-4 max-[860px]:pr-18">
            <DialogTitle>{theme.name}</DialogTitle>
            <DialogDescription className="sr-only">
              {theme.market ? theme.id : theme.group} palette, its slots, its contrast readings and how to install it
            </DialogDescription>
            <PaletteBadges theme={theme} />
            <TerminalPreview theme={theme} scene={scene} bare className="min-h-50 pt-1" />
            <ToggleGroup
              variant="scene"
              aria-label="scene"
              value={[scene]}
              onValueChange={(value) => (value[0] ? onScene(value[0] as Scene) : null)}
              className="self-start"
            >
              {SCENES.map((name) => (
                <ToggleGroupItem key={name} value={name}>
                  {name}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </DialogHeader>
          <aside className="col-start-2 row-span-2 m-3 ml-2.5 flex min-h-0 min-w-0 flex-col gap-4.5 overflow-y-auto rounded-xl border border-(--fg)/14 bg-glass-panel px-4.5 pt-6 pb-5 shadow-md backdrop-blur-[22px] backdrop-saturate-170 max-[860px]:col-start-1 max-[860px]:row-span-1 max-[860px]:mt-0 max-[860px]:ml-3">
            <section>
              <SectionLabel icon={<ListIcon />}>Properties</SectionLabel>
              <PropertyList
                rows={[
                  [theme.market ? 'Market' : 'Series', `${theme.group}${theme.lead ? ' · lead' : ''}`],
                  ['ANSI from', theme.ansiSource],
                  ['Background L*', lightness(theme.background)],
                  ['Foreground L*', lightness(theme.foreground)],
                  ['Gate', `${gatePassed(theme, gate)} / ${gate.length} floors${theme.market ? ' · advisory' : ''}`],
                ]}
              />
            </section>
            <section>
              <SectionLabel icon={<PaletteIcon />}>Signature</SectionLabel>
              <Signature theme={theme} size="lg" />
            </section>
            <section>
              <SectionLabel icon={<SwatchBookIcon />}>Slots</SectionLabel>
              <SwatchGrid theme={theme} />
            </section>
            <section>
              <SectionLabel icon={<GaugeIcon />}>Contrast gate</SectionLabel>
              <GateList theme={theme} gate={gate} />
            </section>
          </aside>
          <DialogFooter className="col-start-1 row-start-2 grid gap-2 max-[860px]:row-start-auto">
            {commands(theme, market).map((command) => (
              <CommandRow key={command} command={command} />
            ))}
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}
