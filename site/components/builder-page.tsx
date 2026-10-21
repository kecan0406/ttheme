import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { type BuilderData, editOf, madeMode, nameTrouble } from '@/lib/builder'
import { aboutOf, dotsOf, fileOf, gateOf, marketOf, modesOf, rowsOf, seedRowsOf, slotVars } from '@/lib/builder-view'
import type { Facts } from '@/lib/facts'
import { json } from '@/lib/render'
import type { Shared } from '@/lib/share'
import type { Pane } from '@/lib/view-types'
import { grow, SEEDS } from '../../src/core/seeds.ts'
import { listOf, misses, slotLabel } from '../../src/core/slots.ts'
import { brightLinks } from '../../src/core/tune.ts'
import { AppBar } from './app-bar'
import { ExportDialog } from './builder-export'
import { AddPopover, LinkSection, LinkStrip } from './builder-link'
import { AboutPanel, BuilderBar, ColorsPanel, EditMode, SeedsPanel, StatusText } from './builder-parts'
import { StartPopover } from './builder-start'
import { MockWindow } from './mock-window'
import { SiteHeader } from './site-header'

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
  const waive = edit.meta.waive ?? []
  const missed = misses(list, edit.signature, waive)
  const gate = gateOf(list, edit.signature, waive)
  const linked = new Set(brightLinks(list).keys())
  const rows = rowsOf(list, edit.signature, missed, new Set(), 'hex', null, linked, false)
  const mode = madeMode(edit)
  const seeded = listOf(grow(SEEDS))

  return (
    <div class="ground flex min-h-dvh flex-col app:h-dvh app:overflow-hidden">
      <SiteHeader current="/builder" fixed />
      <palette-builder class="builder-app">
        {shared && shared.palettes.length > 1 ? <LinkStrip shared={shared} /> : null}
        <div class="border-b border-border bg-sidebar [grid-area:tabs] app:border-r">
          <TabsList label="sidebar" class="h-full">
            <TabsTrigger
              variant="underline"
              selected
              id="builder-tab-colors"
              aria-controls="builder-colors"
              data-panel="colors"
            >
              <span data-first-tab>colors</span>
            </TabsTrigger>
            <TabsTrigger
              variant="underline"
              selected={false}
              id="builder-tab-about"
              aria-controls="builder-about"
              data-panel="about"
            >
              about
            </TabsTrigger>
          </TabsList>
        </div>
        <BuilderBar
          name={edit.name}
          problem={nameTrouble(edit.name)}
          source={data.first.name}
          dots={dotsOf(list, edit.signature)}
          changed={0}
          link={shared?.link ?? null}
        />
        <aside
          aria-label="palette"
          data-side
          class="bg-sidebar [grid-area:side] app:min-h-0 app:overflow-y-auto app:overscroll-contain app:border-r app:border-border app:[scrollbar-color:var(--border)_transparent] app:[scrollbar-width:thin]"
        >
          <SeedsPanel seeds={seedRowsOf(SEEDS)} list={seeded} gate={gateOf(seeded, ['cursor', 'ansi5', 'ansi4'], [])} />
          <ColorsPanel
            gate={gate}
            misses={missed.size}
            rows={rows}
            format="hex"
            names={list.map((_, slot) => slotLabel(slot).name)}
          />
          <AboutPanel
            about={aboutOf(edit, 'made')}
            modes={modesOf(edit)}
            link={shared ? <LinkSection shared={shared} /> : null}
          />
        </aside>
        <main id="content" aria-label="preview" data-stage class="mock-stage [grid-area:stage]">
          <MockWindow
            panes={panes}
            prefix="builder"
            style={slotVars(list)}
            controls={<EditMode made={mode} editing={mode} />}
          />
          <p
            data-hint
            hidden
            class="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs whitespace-nowrap text-soft-foreground shadow-md max-[760px]:hidden"
          >
            hover any text in the window to see its slots · click to pin
          </p>
        </main>
        <StartPopover />
        {shared ? <AddPopover shared={shared} /> : null}
        <ExportDialog
          file={fileOf(edit)}
          link={{ name: edit.name, link: null, code: null, failed: null, clash: null }}
          market={marketOf('', '')}
          description=""
        />
        <script type="application/json" data-builder>
          {json(data)}
        </script>
      </palette-builder>
      <AppBar facts={facts}>
        <span data-status class="flex min-w-0 items-center gap-2">
          <StatusText status={{ ok: true, text: 'your drafts stay in this browser' }} />
        </span>
      </AppBar>
    </div>
  )
}
