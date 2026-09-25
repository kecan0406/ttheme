import { ContrastIcon, LayersIcon, MoonIcon, StoreIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { Theme } from '@/lib/themes'
import { isLight, wearStyle } from '@/lib/wear'
import { Signature } from './palette-parts'
import { type Scene, TerminalPreview } from './terminal-preview'

export function PaletteBadges({ theme }: { theme: Theme }) {
  return (
    <div className="flex gap-1.5" style={wearStyle(theme)}>
      <Badge variant="preview">
        {theme.market ? <StoreIcon /> : <LayersIcon />}
        {theme.market ? 'market' : 'official'}
      </Badge>
      <Badge variant="preview">
        {isLight(theme) ? <ContrastIcon /> : <MoonIcon />}
        {isLight(theme) ? 'light' : 'dark'}
      </Badge>
    </div>
  )
}

export function PaletteCard({ theme, scene, onOpen }: { theme: Theme; scene: Scene; onOpen: () => void }) {
  return (
    <Card className="hover:-translate-y-0.5 hover:border-input hover:shadow-md active:scale-98 active:duration-500 active:ease-spring has-focus-visible:border-ring motion-safe:animate-enter motion-reduce:hover:translate-y-0">
      <button type="button" onClick={onOpen} aria-label={`open ${theme.id}`} className="text-left outline-none">
        <div className="relative">
          <div className="absolute top-2.5 right-2.5 z-1">
            <PaletteBadges theme={theme} />
          </div>
          <TerminalPreview theme={theme} scene={scene} className="pt-12" />
        </div>
        <CardHeader className="border-t">
          <CardTitle>{theme.name}</CardTitle>
          <CardAction>
            <Signature theme={theme} />
          </CardAction>
          <CardDescription>{theme.market ? theme.id : `${theme.group}${theme.lead ? ' · lead' : ''}`}</CardDescription>
        </CardHeader>
      </button>
    </Card>
  )
}
