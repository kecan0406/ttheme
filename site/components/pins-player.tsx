import { Pause, Play, RotateCcw } from 'lucide'
import { Button } from '@/components/ui/button'
import { Icon } from '@/lib/icons'
import type { Frame, ListRow, Role, Run, Swatch } from '@/lib/pins-play'
import { json } from '@/lib/render'
import { cn } from '@/lib/utils'
import { TerminalFrame } from './terminal-frame'

export interface PinsData {
  frames: Frame[]
  swatches: Record<string, Swatch>
}

const ROLES: Record<Role, string> = {
  dim: 'text-(--fg)/55',
  c2: 'term-c2',
  c3: 'term-c3',
  c6: 'term-c6',
}

export function swatchIn(swatches: Record<string, Swatch>, id: string): Swatch {
  if (!Object.hasOwn(swatches, id)) throw new Error(`a pins fence has no colors for ${id}`)

  return swatches[id] as Swatch
}

export function titleOf(frame: Frame): string {
  return frame.host ? `deploy@${frame.host}` : frame.cwd
}

function styleOf(run: Run, swatches: Record<string, Swatch>): string | undefined {
  if (run.chip) {
    const chip = swatchIn(swatches, run.chip)

    return `background:${chip.background};color:${chip.foreground}`
  }

  return run.tip ? `color:${swatchIn(swatches, run.tip).cursor}` : undefined
}

function Runs({ runs, swatches }: { runs: Run[]; swatches: Record<string, Swatch> }) {
  return (
    <>
      {runs.map((run) => (
        <span
          class={cn(run.role && ROLES[run.role], run.bold && 'font-bold') || undefined}
          style={styleOf(run, swatches)}
          safe
        >
          {run.text}
        </span>
      ))}
    </>
  )
}

export function PinsShell({
  frame,
  typing,
  swatches,
}: {
  frame: Frame
  typing: string
  swatches: Record<string, Swatch>
}) {
  return (
    <>
      {frame.shell.map((line) => (
        <div class="h-5 flex-none">
          <Runs runs={line} swatches={swatches} />
        </div>
      ))}
      <div class="h-5 flex-none">
        <Runs runs={frame.prompt} swatches={swatches} />
        <span safe>{typing}</span>
        <span data-pins-cursor class="bg-(--cu)">
          {' '}
        </span>
      </div>
    </>
  )
}

function Row({ row, swatches }: { row: ListRow; swatches: Record<string, Swatch> }) {
  const live = row.live
    ? `background:color-mix(in oklab,${swatchIn(swatches, row.live).cursor} 20%,var(--bg))`
    : undefined

  return (
    <div class="h-5 rounded-sm px-1" style={live}>
      <Runs runs={row.runs} swatches={swatches} />
    </div>
  )
}

export function PinsList({ frame, swatches }: { frame: Frame; swatches: Record<string, Swatch> }) {
  return (
    <>
      {frame.list.map((row) => (
        <Row row={row} swatches={swatches} />
      ))}
    </>
  )
}

export function PinsCaption({ frame, swatches }: { frame: Frame; swatches: Record<string, Swatch> }) {
  const shown = swatchIn(swatches, frame.tab)

  return (
    <>
      <p class="flex items-center gap-2 text-sm font-semibold text-foreground">
        <span safe>{frame.lead}</span>
        <span class="size-2.5 flex-none rounded-full forced-color-adjust-none" style={`background:${shown.cursor}`} />
        <span class="font-mono" translate="no" safe>
          {shown.label}
        </span>
      </p>
      <p class="mt-1 text-sm text-pretty text-soft-foreground" safe>
        {frame.why}
      </p>
    </>
  )
}

export function PlayLabel({ playing }: { playing: boolean }) {
  return (
    <>
      <Icon node={playing ? Pause : Play} />
      <span>{playing ? 'Pause' : 'Play'}</span>
    </>
  )
}

export function PinsPlayer({ frames, swatches }: PinsData) {
  const first = frames[0]

  if (!first) throw new Error('a pins fence plays at least one frame')

  return (
    <pins-player data-slot="pins-player" class="block @container">
      <figure class="m-0 grid grid-cols-[minmax(0,1fr)] gap-3">
        <TerminalFrame data-pins-window title={titleOf(first)} style={swatchIn(swatches, first.tab).style}>
          <div aria-hidden="true" class="h-0.5">
            <i
              data-pins-progress
              class="block h-full w-0 bg-(--cu) transition-[width] duration-100 ease-linear motion-reduce:transition-none"
            />
          </div>
          <div class="grid h-56 grid-cols-[minmax(0,34ch)_2px_minmax(0,1fr)] font-mono text-code @max-[34rem]:h-auto @max-[34rem]:grid-cols-[minmax(0,1fr)] @max-[34rem]:grid-rows-[11rem_2px_auto]">
            <div
              data-pins-shell
              aria-hidden="true"
              translate="no"
              class="flex flex-col justify-end overflow-hidden px-3.5 pt-1 pb-3.5 whitespace-pre"
            >
              <PinsShell frame={first} typing="" swatches={swatches} />
            </div>
            <div aria-hidden="true" class="bg-black/35" />
            <div
              data-pins-list
              translate="no"
              class="overflow-hidden bg-(--bg) px-2.5 pt-1 pb-3.5 text-xs leading-5 whitespace-pre text-(--fg)"
              style={swatchIn(swatches, first.local).style}
            >
              <PinsList frame={first} swatches={swatches} />
            </div>
          </div>
        </TerminalFrame>
        <figcaption class="flex items-start gap-3 px-1">
          <div data-pins-caption class="min-w-0 flex-1">
            <PinsCaption frame={first} swatches={swatches} />
          </div>
          <div class="flex flex-none gap-0.5">
            <Button variant="ghost" size="sm" data-pins-toggle>
              <PlayLabel playing={false} />
            </Button>
            <Button variant="ghost" size="sm" data-pins-restart>
              <Icon node={RotateCcw} />
              <span>Restart</span>
            </Button>
          </div>
        </figcaption>
      </figure>
      <script type="application/json" data-pins>
        {json({ frames, swatches })}
      </script>
    </pins-player>
  )
}
