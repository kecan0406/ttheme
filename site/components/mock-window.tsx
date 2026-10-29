import { escapeHtml } from '@kitajs/html'
import { TabsList, TabsPanel, TabsTrigger } from '@/components/ui/tabs'
import type { Pane } from '@/lib/view-types'
import { TerminalScreen } from './terminal'
import { TerminalFrame } from './terminal-frame'

export function PaneBody({ pane }: { pane: Pane }) {
  return (
    <>
      <TerminalScreen
        lines={pane.body}
        inspect
        class="mock-body"
        data-tail={pane.footer.length === 0 ? '' : undefined}
      />
      {pane.footer.length > 0 ? <TerminalScreen lines={pane.footer} inspect class="mock-foot" /> : null}
    </>
  )
}

function PaneView({ pane, first, prefix }: { pane: Pane; first: boolean; prefix: string }) {
  return (
    <TabsPanel
      id={`${prefix}-pane-${pane.name}`}
      aria-labelledby={`${prefix}-tab-${pane.name}`}
      data-pane-panel={pane.name}
      selected={first}
      class="mock-pane"
    >
      <PaneBody pane={pane} />
    </TabsPanel>
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
    <TerminalFrame
      data-mock
      class="mock"
      style={style}
      raised
      controls={controls}
      tabs={
        <TabsList label="terminal tabs" variant="track" class="flex-1" data-panes>
          {panes.map((pane, i) => (
            <TabsTrigger
              variant="track"
              value={pane.name}
              selected={i === 0}
              id={`${prefix}-tab-${pane.name}`}
              aria-controls={`${prefix}-pane-${pane.name}`}
            >
              <span data-mark aria-hidden="true">
                ❯
              </span>
              {escapeHtml(pane.name)}
            </TabsTrigger>
          ))}
        </TabsList>
      }
    >
      <div data-term class="mock-term">
        {panes.map((pane, i) => (
          <PaneView pane={pane} first={i === 0} prefix={prefix} />
        ))}
        <div data-inspector hidden class="pointer-events-none absolute z-20 data-pinned:pointer-events-auto" />
      </div>
    </TerminalFrame>
  )
}
