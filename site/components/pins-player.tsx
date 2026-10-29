import { Pause, Play, RotateCcw } from 'lucide'
import { Button } from '@/components/ui/button'
import { Icon } from '@/lib/icons'
import type { Frame, ListRow, Run as PinsRun, Role, Swatch } from '@/lib/pins-play'
import { json } from '@/lib/render'
import { type Line, plain, type Run } from '@/lib/terminal'
import { TerminalLines, TerminalScreen } from './terminal'
import { TerminalFrame } from './terminal-frame'

export interface PinsData {
  frames: Frame[]
  swatches: Record<string, Swatch>
}

const ROLES: Record<Role, Partial<Run>> = {
  dim: { faint: true },
  c2: { t: 6 },
  c3: { t: 7 },
  c6: { t: 10 },
}

const CURSOR: Run = { text: ' ', t: 1, g: 2, cursor: true }

export function swatchIn(swatches: Record<string, Swatch>, id: string): Swatch {
  if (!Object.hasOwn(swatches, id)) throw new Error(`a pins fence has no colors for ${id}`)

  return swatches[id] as Swatch
}

export function titleOf(frame: Frame): string {
  return frame.host ? `deploy@${frame.host}` : frame.cwd
}

function inkOf(run: PinsRun, swatches: Record<string, Swatch>): Partial<Run> {
  if (run.chip) {
    const chip = swatchIn(swatches, run.chip)

    return { ink: chip.foreground, ground: chip.background }
  }

  return run.tip ? { ink: swatchIn(swatches, run.tip).cursor } : {}
}

function runIn(run: PinsRun, swatches: Record<string, Swatch>): Run {
  return {
    ...plain(run.text),
    ...(run.role ? ROLES[run.role] : {}),
    ...(run.bold ? { bold: true } : {}),
    ...inkOf(run, swatches),
  }
}

function linesIn(lines: PinsRun[][], swatches: Record<string, Swatch>): Line[] {
  return lines.map((line) => line.map((run) => runIn(run, swatches)))
}

function shellLines(frame: Frame, typing: string, swatches: Record<string, Swatch>): Line[] {
  const [prompt = []] = linesIn([frame.prompt], swatches)

  return [...linesIn(frame.shell, swatches), [...prompt, plain(typing), CURSOR]]
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
  return <TerminalLines lines={shellLines(frame, typing, swatches)} />
}

function Row({ row, swatches }: { row: ListRow; swatches: Record<string, Swatch> }) {
  const live = row.live
    ? `background:color-mix(in oklab,${swatchIn(swatches, row.live).cursor} 20%,var(--bg))`
    : undefined

  return (
    <span class="block rounded-sm px-1" style={live}>
      <TerminalLines lines={linesIn([row.runs], swatches)} />
    </span>
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
            <div class="flex flex-col justify-end overflow-hidden px-3.5 pt-1 pb-3.5">
              <TerminalScreen data-pins-shell decorative lines={shellLines(first, '', swatches)} />
            </div>
            <div aria-hidden="true" class="bg-[color-mix(in_oklab,var(--bg)_55%,black)]" />
            <TerminalScreen
              data-pins-list
              class="overflow-hidden bg-(--bg) px-2.5 pt-1 pb-3.5 text-xs text-(--fg)"
              style={swatchIn(swatches, first.local).style}
            >
              <PinsList frame={first} swatches={swatches} />
            </TerminalScreen>
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
