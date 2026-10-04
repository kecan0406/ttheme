import { escapeHtml } from '@kitajs/html'
import { Contrast, Layers, Moon, Store } from 'lucide'
import { Badge } from '@/components/ui/badge'
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Icon } from '@/lib/icons'
import type { Theme } from '@/lib/themes'
import { isLight, wearStyle } from '@/lib/wear'
import { Signature } from './palette-parts'
import { type Scene, TerminalPreview } from './terminal-preview'

export function PaletteBadges({ theme }: { theme: Theme }) {
  return (
    <div class="flex gap-1.5" style={wearStyle(theme)}>
      <Badge variant="preview">
        <Icon node={theme.market ? Store : Layers} />
        {theme.market ? 'market' : 'official'}
      </Badge>
      <Badge variant="preview">
        <Icon node={isLight(theme) ? Contrast : Moon} />
        {isLight(theme) ? 'light' : 'dark'}
      </Badge>
    </div>
  )
}

export function PaletteCard({ theme, scene }: { theme: Theme; scene: Scene }) {
  return (
    <Card
      data-palette={theme.id}
      class="hover:-translate-y-0.5 hover:border-input hover:shadow-md active:scale-98 active:duration-500 active:ease-spring has-focus-visible:border-ring motion-safe:animate-enter motion-reduce:hover:translate-y-0"
    >
      <button type="button" data-open={theme.id} aria-label={`open ${theme.id}`} class="text-left outline-none">
        <div class="relative">
          <div class="absolute top-2.5 right-2.5 z-1">
            <PaletteBadges theme={theme} />
          </div>
          <TerminalPreview theme={theme} scene={scene} class="pt-12" />
        </div>
        <CardHeader class="border-t">
          <CardTitle>{escapeHtml(theme.name)}</CardTitle>
          <CardAction>
            <Signature theme={theme} />
          </CardAction>
          <CardDescription>
            {escapeHtml(theme.market ? theme.id : `${theme.group}${theme.lead ? ' · lead' : ''}`)}
          </CardDescription>
        </CardHeader>
      </button>
    </Card>
  )
}
