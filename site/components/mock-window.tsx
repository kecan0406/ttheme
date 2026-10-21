import { escapeHtml } from '@kitajs/html'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Pane, Run } from '@/lib/view-types'

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
          data-blank={run.cursor || run.text.trim() !== '' ? undefined : ''}
          safe
        >
          {run.text}
        </span>
      ))}
    </div>
  )
}

export function PaneBody({ pane }: { pane: Pane }) {
  return (
    <>
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
    </>
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
      <PaneBody pane={pane} />
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
    <div data-mock class="mock" style={style}>
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
        {controls ? controls : null}
      </div>
      <div data-term class="mock-term">
        {panes.map((pane, i) => (
          <PaneView pane={pane} first={i === 0} prefix={prefix} />
        ))}
        <div data-inspector hidden class="pointer-events-none absolute z-20 data-pinned:pointer-events-auto" />
      </div>
    </div>
  )
}
