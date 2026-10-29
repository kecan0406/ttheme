import { History, Info, Palette } from 'lucide'
import { TabsCount, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { type BuilderData, editOf, madeMode, nameTrouble } from '@/lib/builder'
import {
  aboutOf,
  dotsOf,
  draftListOf,
  fileOf,
  gateOf,
  marketOf,
  modesOf,
  rowsOf,
  seedRowsOf,
  slotVars,
} from '@/lib/builder-view'
import type { Facts } from '@/lib/facts'
import { Icon } from '@/lib/icons'
import { json } from '@/lib/render'
import type { Shared } from '@/lib/share'
import type { Pane } from '@/lib/view-types'
import { grow, SEEDS } from '../../src/core/seeds.ts'
import { FACE, listOf, misses, slotLabel } from '../../src/core/slots.ts'
import { brightLinks } from '../../src/core/tune.ts'
import { DraftsPanel } from './builder-drafts'
import { ExportDialog } from './builder-export'
import { AddPopover, LinkSection, LinkStrip } from './builder-link'
import { AboutPanel, BuilderBar, ColorsPanel, EditMode, GatePopover, SeedsPanel, StatusText } from './builder-parts'
import { StartPopover } from './builder-start'
import { MockWindow } from './mock-window'
import { WorkspacePage, WorkspaceSide, WorkspaceStage } from './workspace-shell'

export function BuilderPage({
  data,
  panes,
  facts,
  shared,
}: {
  data: BuilderData
  panes: Pane[]
  facts: Facts
  shared: Shared | null
}) {
  const edit = editOf(data.first.draft, data.first.name, shared !== null, 'first', 0)
  const list = edit.made
  const missed = misses(list, edit.signature)
  const gate = gateOf(list, edit.signature)
  const linked = new Set(brightLinks(list).keys())
  const rows = rowsOf(list, edit.signature, missed, new Set(), 'hex', null, linked, false)
  const mode = madeMode(edit)
  const seeded = listOf(grow(SEEDS))
  const about = aboutOf(edit, 'made')

  return (
    <WorkspacePage
      current="/builder"
      facts={facts}
      status={
        <span data-status class="flex min-w-0 items-center gap-2">
          <StatusText status={{ ok: true, text: 'your drafts stay in this browser' }} />
        </span>
      }
    >
      <palette-builder class="workspace" data-stack="window">
        {shared && shared.palettes.length > 1 ? <LinkStrip shared={shared} /> : null}
        <WorkspaceSide
          aria-label="palette"
          head={
            <TabsList label="sidebar" variant="track" class="w-full">
              <TabsTrigger
                variant="track"
                selected
                id="builder-tab-colors"
                aria-controls="builder-colors"
                data-panel="colors"
              >
                <Icon node={Palette} class="size-3.5" />
                <span data-first-tab>colors</span>
              </TabsTrigger>
              <TabsTrigger
                variant="track"
                selected={false}
                id="builder-tab-about"
                aria-controls="builder-about"
                data-panel="about"
              >
                <Icon node={Info} class="size-3.5" />
                about
              </TabsTrigger>
              <TabsTrigger
                variant="track"
                selected={false}
                id="builder-tab-drafts"
                aria-controls="builder-drafts"
                data-panel="drafts"
              >
                <Icon node={History} class="size-3.5" />
                drafts
                <TabsCount data-drafts-count hidden />
              </TabsTrigger>
            </TabsList>
          }
        >
          <div
            data-side
            class="app:min-h-0 app:flex-1 app:overflow-y-auto app:overscroll-contain app:[scrollbar-color:var(--border)_transparent] app:[scrollbar-width:thin]"
          >
            <SeedsPanel seeds={seedRowsOf(SEEDS)} list={seeded} gate={gateOf(seeded, ['cursor', 'ansi5', 'ansi4'])} />
            <ColorsPanel rows={rows} format="hex" />
            <AboutPanel
              about={about}
              modes={modesOf(edit)}
              link={shared ? <LinkSection shared={shared} /> : undefined}
            />
            <DraftsPanel list={draftListOf([], edit.id, '', null, 0)} />
          </div>
        </WorkspaceSide>
        <BuilderBar
          name={edit.name}
          problem={nameTrouble(edit.name)}
          source={data.first.name}
          dots={dotsOf(list, FACE)}
          changed={0}
          gate={gate}
          link={shared?.link ?? null}
        />
        <main id="content" aria-label="preview" data-stage class="flex min-h-0 min-w-0 flex-col [grid-area:stage]">
          <WorkspaceStage>
            <MockWindow
              panes={panes}
              prefix="builder"
              style={slotVars(list)}
              controls={<EditMode made={mode} editing={mode} />}
            />
          </WorkspaceStage>
        </main>
        <StartPopover />
        <GatePopover gate={gate} names={list.map((_, slot) => slotLabel(slot).name)} />
        {shared ? <AddPopover shared={shared} /> : null}
        <ExportDialog
          file={fileOf(edit)}
          link={{ name: edit.name, link: null, code: null, failed: null }}
          market={marketOf('', '')}
          description=""
        />
        <script type="application/json" data-builder>
          {json(data)}
        </script>
      </palette-builder>
    </WorkspacePage>
  )
}
