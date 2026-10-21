import { escapeHtml } from '@kitajs/html'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Pane, Run } from '@/lib/share-view'
import { GRID } from '@/lib/share-view'

const LIGHTS = ['#ff5f57', '#febc2e', '#28c840']

function Line({ runs }: { runs: Run[] }) {
  return (
    <div class="ln">
      {runs.map((run) => (
        <span
          class={run.bold ? 'r font-bold' : 'r'}
          data-t={String(run.t)}
          data-g={String(run.g)}
          data-f={run.faint ? '' : undefined}
          data-c={run.cursor ? '' : undefined}
          safe
        >
          {run.text}
        </span>
      ))}
    </div>
  )
}

function PaneView({ pane, first, prefix }: { pane: Pane; first: boolean; prefix: string }) {
  return (
    <div
      role="tabpanel"
      id={`${prefix}-pane-${pane.name}`}
      aria-labelledby={`${prefix}-tab-${pane.name}`}
      data-pane-panel={pane.name}
      hidden={!first}
      class="mock-pane"
    >
      <div class="mock-body" data-tail={pane.footer.length === 0 ? '' : undefined}>
        {pane.body.map((runs) => (
          <Line runs={runs} />
        ))}
      </div>
      {pane.footer.length > 0 ? (
        <div class="mock-foot">
          {pane.footer.map((runs) => (
            <Line runs={runs} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function MockWindow({
  panes,
  style,
  prefix,
  controls,
}: {
  panes: Pane[]
  style: string
  prefix: string
  controls?: JSX.Element
}) {
  return (
    <div data-mock class="mock" style={`${style};--cols:${GRID.cols};--rows:${GRID.rows}`}>
      <div class="flex h-10 flex-none items-center gap-3 bg-card pr-1.5 pl-3.5">
        <span aria-hidden="true" class="flex gap-2">
          {LIGHTS.map((color) => (
            <i class="size-3 rounded-full inset-ring inset-ring-black/18" style={`background:${color}`} />
          ))}
        </span>
        <TabsList label="terminal tabs" variant="track" class="flex-1">
          {panes.map((pane, i) => (
            <TabsTrigger
              variant="track"
              selected={i === 0}
              id={`${prefix}-tab-${pane.name}`}
              aria-controls={`${prefix}-pane-${pane.name}`}
              data-pane={pane.name}
            >
              {escapeHtml(pane.name)}
            </TabsTrigger>
          ))}
        </TabsList>
        {controls ?? null}
      </div>
      <div data-term class="mock-term">
        {panes.map((pane, i) => (
          <PaneView pane={pane} first={i === 0} prefix={prefix} />
        ))}
        <div data-inspector hidden class="absolute z-20" />
      </div>
    </div>
  )
}
