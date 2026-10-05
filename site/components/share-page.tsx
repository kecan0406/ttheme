import { escapeHtml } from '@kitajs/html'
import { Gauge, Image, List, SwatchBook } from 'lucide'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Icon } from '@/lib/icons'
import { json } from '@/lib/render'
import type { Picture, Shared } from '@/lib/share'
import { gatePassed } from '@/lib/sheet'
import type { GateRule } from '@/lib/themes'
import { wearStyle } from '@/lib/wear'
import { CommandRow } from './command-row'
import { GateList, PropertyList, SectionLabel, Signature, SwatchGrid } from './palette-parts'
import { SiteHeader } from './site-header'
import { SCENES, TerminalPreview } from './terminal-preview'

const INIT = 'npx @kecan0406/ttheme init'

function PictureList({ pictures }: { pictures: Picture[] }) {
  return (
    <ul class="grid gap-1.5 text-sm">
      {pictures.map((picture) => (
        <li class="flex flex-wrap items-baseline justify-between gap-x-3">
          {picture.href ? (
            <a href={picture.href} class="font-mono text-code text-primary underline-offset-4 hover:underline" safe>
              {picture.post}
            </a>
          ) : (
            <span class="font-mono text-code" safe>
              {picture.post}
            </span>
          )}
          {picture.framing ? (
            <span class="text-xs text-muted-foreground" safe>
              {picture.framing}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

export function SharePage({ shared, gate }: { shared: Shared; gate: GateRule[] }) {
  const { theme, code, pictures } = shared
  const passed = gatePassed(theme, gate)

  return (
    <share-sheet class="wear ground flex min-h-dvh flex-col" style={wearStyle(theme)}>
      <div class="mx-auto grid w-[min(1280px,calc(100%-40px))] flex-1 grid-cols-[minmax(0,1fr)] content-start gap-5 pt-4.5">
        <SiteHeader current="" themeToggle={false} />

        <section aria-label={theme.name} class="grid justify-items-center gap-6 pt-8 pb-10">
          <div class="grid justify-items-center gap-2 text-center">
            <span class="text-2xs font-bold tracking-caps text-muted-foreground uppercase">shared palette</span>
            <h1 class="font-display text-display-lg font-black text-primary [overflow-wrap:anywhere]" safe>
              {theme.name}
            </h1>
            <div class="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-soft-foreground">
              <span safe>{theme.market ?? theme.group}</span>
              <Signature theme={theme} />
              <Badge variant={passed === gate.length ? 'success' : 'warning'}>
                {passed} / {gate.length} floors
              </Badge>
            </div>
          </div>

          <div class="grid w-full max-w-[880px] gap-3">
            <Card class="w-full border-input shadow-lg">
              <TerminalPreview theme={theme} scene="shell" worn class="min-h-60" />
            </Card>
            <ToggleGroup variant="scene" label="scene">
              {SCENES.map((name) => (
                <ToggleGroupItem variant="scene" name="scene" value={name} checked={name === 'shell'}>
                  {name}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <div class="grid w-full max-w-[880px] gap-2">
            <CommandRow command={`ttheme add ${code}`} class="bg-card" />
            <p class="text-sm text-soft-foreground">
              {pictures.length > 0
                ? escapeHtml(
                    `It brings ${pictures.length === 1 ? 'a picture, downloaded from its post' : `${pictures.length} pictures, downloaded from their posts`} as it installs. New to ttheme? Set it up first:`,
                  )
                : 'New to ttheme? Set it up first:'}
            </p>
            <CommandRow command={INIT} class="bg-card" />
          </div>

          <div class="grid w-full max-w-[880px] grid-cols-2 gap-6 rounded-3xl border bg-glass-panel p-6 shadow-md backdrop-blur-[22px] backdrop-saturate-170 max-[760px]:grid-cols-1">
            <div class="grid content-start gap-6">
              <section>
                <SectionLabel icon={<Icon node={List} />}>Properties</SectionLabel>
                <PropertyList
                  rows={[
                    [theme.market ? 'Market' : 'Series', theme.market ?? theme.group],
                    ['ANSI from', theme.ansiSource],
                    ['Signature', theme.signatureSlots.join(' · ')],
                  ]}
                />
              </section>
              {pictures.length > 0 ? (
                <section>
                  <SectionLabel icon={<Icon node={Image} />}>Pictures</SectionLabel>
                  <PictureList pictures={pictures} />
                </section>
              ) : null}
              <section>
                <SectionLabel icon={<Icon node={Gauge} />}>Contrast gate · advisory</SectionLabel>
                <GateList theme={theme} gate={gate} />
              </section>
            </div>
            <section>
              <SectionLabel icon={<Icon node={SwatchBook} />}>Slots</SectionLabel>
              <SwatchGrid theme={theme} />
            </section>
          </div>
        </section>
      </div>
      <script type="application/json" data-share>
        {json(theme)}
      </script>
    </share-sheet>
  )
}
