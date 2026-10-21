import { Check, Code, Copy, Image, Link, List, Plus, SquareDashedMousePointer, Terminal } from 'lucide'
import { Button, LinkButton } from '@/components/ui/button'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { INIT } from '@/lib/gallery'
import { Icon } from '@/lib/icons'
import { json } from '@/lib/render'
import type { Builder, Shared } from '@/lib/share'
import type { GateLine, ShareView, SlotView } from '@/lib/share-view'
import { pinned, shelfOf } from '@/lib/themes'
import { wearStyle } from '@/lib/wear'
import { CommandRow } from './command-row'
import { MockWindow } from './mock-window'
import { PropertyList, SectionLabel, Signature } from './palette-parts'
import { PictureList } from './picture-list'
import { Marks, Verdict } from './share-popovers'
import { GateRows, Group, Swatch } from './slot-list'
import { Wordmark } from './wordmark'

const PAIRS = [0, 1, 2, 3, 4, 5, 6, 7]

function bringing(count: number): string {
  return `It brings ${count === 1 ? 'a picture, downloaded from its post' : `${count} pictures, downloaded from their posts`} as it installs.`
}

function BaseRow({ slot, s }: { slot: number; s: SlotView }) {
  return (
    <div
      data-row={String(slot)}
      class="grid h-13 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 pr-3 pl-4 hover:bg-muted data-open:bg-accent"
    >
      <button
        type="button"
        data-slot-open={String(slot)}
        aria-label={`${s.name} ${s.key} ${s.hex}`}
        class="flex min-w-0 items-center gap-3 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Swatch hex={s.hex} size="row" />
        <span class="grid min-w-0 gap-px">
          <span class="flex items-center gap-1.5 text-sm font-medium">
            <span safe>{s.name}</span>
            <Marks signature={s.signature} miss={s.miss} />
          </span>{' '}
          <span class="font-mono text-xs text-muted-foreground" safe>
            {s.key}
          </span>
        </span>
      </button>
      <button
        type="button"
        aria-label={`copy ${s.key} ${s.hex}`}
        data-copy={s.hex}
        data-copy-hold="1200"
        class="group/copy rounded-sm px-2 py-1 font-mono text-xs text-soft-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span class="group-data-copied/copy:hidden" safe>
          {s.hex}
        </span>
        <Icon node={Check} class="hidden size-3.5 group-data-copied/copy:block" />
      </button>
    </div>
  )
}

function Cell({ slot, s }: { slot: number; s: SlotView }) {
  return (
    <button
      type="button"
      data-row={String(slot)}
      data-slot-open={String(slot)}
      aria-label={`${s.name} ${s.hex}`}
      class="flex h-8 min-w-0 items-center gap-1.5 rounded-md pr-1.5 pl-1 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring data-open:bg-accent data-open:inset-ring data-open:inset-ring-primary/45"
    >
      <Swatch hex={s.hex} size="cell" />
      <span class="font-mono text-xs text-soft-foreground" safe>
        {s.hex}
      </span>
      <Marks signature={s.signature} miss={s.miss} />
    </button>
  )
}

function ColorsPanel({ gate, view }: { gate: GateLine[]; view: ShareView }) {
  const passed = gate.filter((line) => line.ok !== false).length
  const waived = gate.filter((line) => line.ok === null).length
  const slot = (index: number) => view.slots[index] as SlotView

  return (
    <section
      id="share-colors"
      role="tabpanel"
      aria-labelledby="share-tab-colors"
      data-panel-body="colors"
      class="relative pb-6"
    >
      <div class="flex h-13 items-center border-b border-border pr-3 pl-2.5">
        <button
          type="button"
          data-gate-jump
          class="inline-flex h-8 items-center gap-2 rounded-full pr-2.5 pl-1.5 text-sm font-semibold outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Verdict ok={passed === gate.length} />
          <span safe>{`${passed} / ${gate.length} floors`}</span>
          <span class="font-medium text-muted-foreground" safe>
            {waived > 0 ? `contrast gate · ${waived} waived` : 'contrast gate'}
          </span>
        </button>
      </div>
      <Group name="base" count="4">
        {[0, 1, 2, 3].map((index) => (
          <BaseRow slot={index} s={slot(index)} />
        ))}
      </Group>
      <Group name="ansi" count="16">
        <div
          aria-hidden="true"
          class="grid h-7 grid-cols-[60px_minmax(0,1fr)_minmax(0,1fr)] items-end gap-1.5 pr-3 pb-1.5 pl-4 text-2xs font-semibold text-muted-foreground"
        >
          <span />
          <span class="pl-1">normal 0–7</span>
          <span class="pl-1">bright 8–15</span>
        </div>
        {PAIRS.map((pair) => (
          <div data-pair class="grid h-10 grid-cols-[60px_minmax(0,1fr)_minmax(0,1fr)] items-center gap-1.5 pr-3 pl-4">
            <span class="text-sm text-soft-foreground" safe>
              {slot(4 + pair).name}
            </span>
            <Cell slot={4 + pair} s={slot(4 + pair)} />
            <Cell slot={12 + pair} s={slot(12 + pair)} />
          </div>
        ))}
      </Group>
      <Group name="gate" count={`${passed}/${gate.length}`} id="share-gate">
        <GateRows lines={gate} names={view.slots.map((slot) => slot.name)} />
      </Group>
      <div data-slot-popover hidden class="absolute inset-x-3 z-20" />
    </section>
  )
}

function AboutPanel({ shared }: { shared: Shared }) {
  const { theme, code, link, pictures } = shared
  const copied: [string, string][] = theme.from ? [['Copied from', theme.from]] : []

  return (
    <section id="share-about" role="tabpanel" aria-labelledby="share-tab-about" data-panel-body="about" hidden>
      <div class="border-b border-border p-4">
        <SectionLabel icon={<Icon node={List} />}>Palette</SectionLabel>
        <PropertyList
          rows={[
            [theme.marketplace ? 'Marketplace' : 'Catalog', shelfOf(theme)],
            ...copied,
            ['ANSI from', theme.ansiSource],
            ['Signature', theme.signatureSlots.join(' · ')],
          ]}
        />
      </div>
      {pictures.length > 0 ? (
        <div class="border-b border-border p-4">
          <SectionLabel icon={<Icon node={Image} />}>Pictures</SectionLabel>
          <p class="mb-2.5 text-xs text-muted-foreground" safe>
            {bringing(pictures.length)}
          </p>
          <PictureList pictures={pictures} />
        </div>
      ) : null}
      <div class="border-b border-border p-4">
        <SectionLabel icon={<Icon node={Code} />}>Share code</SectionLabel>
        <code
          class="block rounded-lg border border-border bg-muted px-3 py-2.5 font-mono text-xs leading-relaxed [overflow-wrap:anywhere] text-soft-foreground"
          safe
        >
          {code}
        </code>
        <div class="mt-2.5 flex flex-wrap gap-1.5">
          <Button variant="outline" size="sm" class="group/copy" data-copy={code} data-copy-hold="1200">
            <Icon node={Copy} class="group-data-copied/copy:hidden" />
            <Icon node={Check} class="hidden group-data-copied/copy:block" />
            copy code
          </Button>
          <Button variant="outline" size="sm" class="group/copy" data-copy={link} data-copy-hold="1200">
            <Icon node={Link} class="group-data-copied/copy:hidden" />
            <Icon node={Check} class="hidden group-data-copied/copy:block" />
            copy link
          </Button>
        </div>
      </div>
      <div class="grid gap-2 p-4">
        <SectionLabel icon={<Icon node={Terminal} />}>Get it</SectionLabel>
        <CommandRow command={`ttheme add ${code}`} class="bg-card" />
        <p class="text-xs text-muted-foreground">New to ttheme? Set it up first:</p>
        <CommandRow command={INIT} class="bg-card" />
      </div>
    </section>
  )
}

function Strip({ shared }: { shared: Shared }) {
  return (
    <nav
      data-strip
      aria-label="palettes in this link"
      class="flex min-w-0 items-center gap-1.5 overflow-x-auto border-b border-border bg-background px-4 [grid-area:strip] [scrollbar-width:none] max-[760px]:py-2"
    >
      <span class="mr-2 flex-none text-xs font-medium text-muted-foreground" safe>
        {`${shared.palettes.length} palettes`}
      </span>
      {shared.palettes.map((theme, at) => (
        <LinkButton variant="ghost" size="sm" href={`?i=${at}`} aria-current={at === shared.index ? 'page' : undefined}>
          <Signature theme={pinned(theme)} />
          <span safe>{theme.name}</span>
        </LinkButton>
      ))}
    </nav>
  )
}

function Bar({ shared }: { shared: Shared }) {
  const { theme, code, link, pictures } = shared

  return (
    <header class="relative z-10 flex min-w-0 items-center justify-between gap-4 border-b border-border bg-background pr-4 pl-5 [grid-area:bar] max-[760px]:flex-wrap max-[760px]:gap-3 max-[760px]:px-4 max-[760px]:py-3.5">
      <nav aria-label="palette" class="flex min-w-0 items-center gap-2.5 max-[760px]:flex-wrap max-[760px]:gap-y-1">
        <a href="/" class="rounded-sm text-display-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Wordmark />
        </a>
        <span aria-hidden="true" class="text-base text-faint-foreground">
          /
        </span>
        <span class="min-w-0 truncate text-sm font-medium text-soft-foreground min-[761px]:max-[1100px]:hidden" safe>
          {shelfOf(theme)}
        </span>
        <span aria-hidden="true" class="text-base text-faint-foreground min-[761px]:max-[1100px]:hidden">
          /
        </span>
        <h1 class="font-display text-display-sm font-black whitespace-nowrap" safe>
          {theme.name}
        </h1>
        <Signature theme={pinned(theme)} />
      </nav>
      <div class="flex flex-none items-center gap-1.5 max-[760px]:w-full">
        <Button variant="ghost" size="sm" aria-pressed="false" data-inspect>
          <Icon node={SquareDashedMousePointer} />
          <span class="max-[1100px]:sr-only">inspect</span>
        </Button>
        <span aria-hidden="true" class="mx-1 h-5 w-px bg-border" />
        <Button
          variant="ghost"
          size="icon-sm"
          class="group/copy"
          aria-label="copy link"
          data-copy={link}
          data-copy-hold="1400"
          data-copy-status="copied (・ω・)"
        >
          <Icon node={Link} class="group-data-copied/copy:hidden" />
          <Icon node={Check} class="hidden group-data-copied/copy:block" />
        </Button>
        <Button size="sm" popovertarget="share-add" data-add class="max-[760px]:ml-auto">
          <Icon node={Plus} />
          add to ttheme
        </Button>
      </div>
      <div
        id="share-add"
        popover="auto"
        class="m-0 hidden w-[min(440px,calc(100vw-32px))] gap-2.5 rounded-3xl border border-border bg-popover p-4 text-popover-foreground shadow-lg inset-auto open:grid"
      >
        <CommandRow command={`ttheme add ${code}`} class="bg-card" />
        {shared.palettes.length > 1 ? (
          <p class="text-xs text-muted-foreground" safe>
            {`It installs all ${shared.palettes.length} palettes in this link.`}
          </p>
        ) : null}
        {pictures.length > 0 ? (
          <p class="text-xs text-muted-foreground" safe>
            {bringing(pictures.length)}
          </p>
        ) : null}
        <p class="text-xs text-muted-foreground">New to ttheme? Set it up first:</p>
        <CommandRow command={INIT} class="bg-card" />
      </div>
    </header>
  )
}

function Stage({ shared, builder }: { shared: Shared; builder: Builder }) {
  const { panes, view } = builder

  return (
    <main id="content" aria-label="preview" class="mock-stage [grid-area:stage]">
      <MockWindow panes={panes} style={`${wearStyle(pinned(shared.theme))};--faint:${view.faint}`} prefix="share" />
      <p
        data-hint
        hidden
        class="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs whitespace-nowrap text-soft-foreground shadow-md max-[760px]:hidden"
      >
        hover any text in the window to see its slots · click to pin
      </p>
    </main>
  )
}

export function SharePage({ shared, builder }: { shared: Shared; builder: Builder }) {
  return (
    <share-sheet class="builder">
      {shared.palettes.length > 1 ? <Strip shared={shared} /> : null}
      <div class="border-r border-b border-border bg-sidebar [grid-area:tabs] max-[760px]:border-t max-[760px]:border-r-0">
        <TabsList label="sidebar" class="h-full">
          <TabsTrigger
            variant="underline"
            selected
            id="share-tab-colors"
            aria-controls="share-colors"
            data-panel="colors"
          >
            colors
          </TabsTrigger>
          <TabsTrigger
            variant="underline"
            selected={false}
            id="share-tab-about"
            aria-controls="share-about"
            data-panel="about"
          >
            about
          </TabsTrigger>
        </TabsList>
      </div>
      <Bar shared={shared} />
      <div class="min-h-0 overflow-y-auto overscroll-contain border-r border-border bg-sidebar [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin] [grid-area:side] max-[760px]:overflow-visible max-[760px]:border-r-0">
        <ColorsPanel gate={builder.gate} view={builder.view} />
        <AboutPanel shared={shared} />
      </div>
      <Stage shared={shared} builder={builder} />
      <script type="application/json" data-share>
        {json(builder.view)}
      </script>
    </share-sheet>
  )
}
