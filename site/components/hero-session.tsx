'use client'

import { type CSSProperties, useEffect, useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { Theme } from '@/lib/themes'
import { CopyCommand } from './copy-command'
import { ListSurface } from './hero-surfaces'

const WEAR: Record<string, string> = {
  '--foreground': 'var(--fg)',
  '--card': 'var(--bg)',
  '--card-foreground': 'var(--fg)',
  '--primary': 'var(--cu)',
  '--primary-foreground': 'var(--bg)',
  '--secondary': 'color-mix(in srgb, var(--se) 85%, var(--bg))',
  '--muted-foreground': 'color-mix(in srgb, var(--fg) 55%, transparent)',
  '--border': 'color-mix(in srgb, var(--fg) 14%, transparent)',
  '--ring': 'var(--cu)',
}

function paletteStyle(theme: Theme): CSSProperties {
  const style: Record<string, string> = {
    ...WEAR,
    '--bg': theme.background,
    '--fg': theme.foreground,
    '--cu': theme.cursor,
    '--se': theme.selectionBackground,
  }
  for (const [index, color] of theme.ansi.entries()) style[`--a${index}`] = color
  return style as CSSProperties
}

export function HeroSession({ theme, themes, position }: { theme: Theme; themes: Theme[]; position: string }) {
  const viewport = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = viewport.current
    if (element) element.scrollTop = element.scrollHeight
  }, [])

  return (
    <section className="@container grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_44px] px-3.5 pt-3.5">
      <Card
        className="term hero-win grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_auto] gap-0 rounded-lg py-0 focus-within:ring-primary/55"
        style={paletteStyle(theme)}
      >
        <CardContent className="grid min-h-0 min-w-0 px-0">
          <ScrollArea
            viewportRef={viewport}
            orientation="both"
            contentClassName="flex min-h-full flex-col p-[var(--cell-h)_calc(var(--cell-w)*2)] [&>:first-child]:mt-auto"
          >
            <ListSurface theme={theme} themes={themes} />
          </ScrollArea>
        </CardContent>

        <CardFooter className="h-[calc(var(--cell-h)*2)] gap-[calc(var(--cell-w)*2)] overflow-hidden rounded-none bg-secondary px-[calc(var(--cell-w)*2)] py-0 text-[0.88em]">
          <Badge className="h-(--cell-h) flex-none rounded-[2px] px-[1ch] text-[1em] font-bold">◆ {theme.name}</Badge>
          <span className="min-w-0 truncate text-muted-foreground max-sm:hidden">
            {theme.group}
            {theme.native ? ` ${theme.native}` : ''}
          </span>
          <Badge
            variant="outline"
            className="h-(--cell-h) flex-none rounded-[2px] px-[1ch] text-[1em] font-normal text-muted-foreground max-lg:hidden"
          >
            ANSI {theme.ansiSource}
          </Badge>
          <span className="ml-auto flex-none text-muted-foreground tabular-nums">{position}</span>
        </CardFooter>
      </Card>

      <footer className="flex items-center justify-end">
        <CopyCommand command="npx @kecan0406/ttheme init" />
      </footer>
    </section>
  )
}
