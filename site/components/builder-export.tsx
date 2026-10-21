import { Check, Copy, Download, FileCode, Link, Package } from 'lucide'
import { Button, LinkButton } from '@/components/ui/button'
import { Dialog, DialogClose, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { FileView, LinkView, MarketView } from '@/lib/builder-view'
import { INIT } from '@/lib/gallery'
import { Icon, NewTab } from '@/lib/icons'
import { CommandRow } from './command-row'

const PANEL = 'grid content-start gap-4 pt-5'

const NOTE = 'text-sm text-muted-foreground'

const STEP = 'text-2xs font-bold tracking-caps text-muted-foreground uppercase'

function Problem({ text }: { text: string }) {
  return (
    <p class="rounded-xl border border-destructive/45 bg-destructive/8 px-3.5 py-2.5 text-sm text-destructive" safe>
      {text}
    </p>
  )
}

export function FilePanel({ view }: { view: FileView }) {
  if (view.problem) return <Problem text={view.problem} />

  return (
    <>
      <p class={NOTE} safe>
        {view.other}
      </p>
      <pre
        translate="no"
        class="max-h-64 overflow-auto rounded-xl border border-border bg-muted/65 px-3.5 py-3 font-mono text-xs leading-relaxed text-soft-foreground"
        safe
      >
        {view.text}
      </pre>
      <div class="flex flex-wrap gap-2">
        <LinkButton data-download-toml download={view.file} href="#">
          <Icon node={Download} />
          <span safe>{`download ${view.file}`}</span>
        </LinkButton>
        <Button
          variant="outline"
          class="group/copy"
          data-copy={view.text}
          data-copy-hold="1200"
          data-copy-status="copied (・ω・)"
        >
          <Icon node={Copy} class="group-data-copied/copy:hidden" />
          <Icon node={Check} class="hidden group-data-copied/copy:block" />
          copy
        </Button>
      </div>
      <p class={STEP}>then, in your terminal</p>
      <CommandRow command={`ttheme add ~/Downloads/${view.file}`} class="bg-card" />
      <p class={NOTE}>
        It goes into your own marketplace, named after your GitHub handle, and{' '}
        <code class="font-mono">ttheme edit</code> changes it from there.
      </p>
      <p class={NOTE}>New to ttheme? Set it up first:</p>
      <CommandRow command={INIT} class="bg-card" />
    </>
  )
}

export function LinkPanel({ view }: { view: LinkView }) {
  if (view.failed) return <Problem text={view.failed} />

  if (!view.link || !view.code) return <p class={NOTE}>making the link…</p>

  return (
    <>
      <p class={NOTE}>
        A link carries the whole palette — both modes, its signature and its pictures — and anyone with ttheme adds it
        in one line.
      </p>
      {view.clash ? <Problem text={view.clash} /> : null}
      <CommandRow command={`ttheme add ${view.link}`} class="bg-card" />
      <figure class="grid gap-2">
        <img
          src={`/builder/${view.code}/card.png`}
          alt={`the card chat apps show for the link to ${view.name}`}
          loading="lazy"
          class="aspect-[40/21] w-full rounded-xl border border-border bg-muted"
        />
        <figcaption class="text-xs text-muted-foreground">
          The card chat apps show for the link: its name in the cursor color, the signature dots and the shell scene.
        </figcaption>
      </figure>
      <code
        translate="no"
        class="block rounded-lg border border-border bg-muted/65 px-3 py-2.5 font-mono text-xs leading-relaxed [overflow-wrap:anywhere] text-soft-foreground select-all"
        safe
      >
        {view.link}
      </code>
      <div class="flex flex-wrap gap-2">
        <Button class="group/copy" data-copy={view.link} data-copy-hold="1400" data-copy-status="copied (・ω・)">
          <Icon node={Link} class="group-data-copied/copy:hidden" />
          <Icon node={Check} class="hidden group-data-copied/copy:block" />
          copy link
        </Button>
        <LinkButton variant="outline" href={view.link} target="_blank" rel="noopener">
          open its page
          <NewTab />
        </LinkButton>
      </div>
      <p class={NOTE}>New to ttheme? Set it up first:</p>
      <CommandRow command={INIT} class="bg-card" />
    </>
  )
}

export function MarketSteps({ view }: { view: MarketView }) {
  if (view.problem) return <Problem text={view.problem} />

  return (
    <>
      <LinkButton data-download-zip download={view.zip} href="#" class="w-fit">
        <Icon node={Download} />
        <span safe>{`download ${view.zip}`}</span>
      </LinkButton>
      <p class={STEP}>then</p>
      <p class={NOTE}>Unzip it and push the folder to GitHub as a repository of its own:</p>
      <CommandRow
        command={`cd ${view.repo} && git init -b main && git add . && git commit -m "First palette"`}
        class="bg-card"
      />
      <CommandRow command={`gh repo create ${view.owner}/${view.repo} --public --source . --push`} class="bg-card" />
      <p class={NOTE}>
        Give it the <code class="font-mono">ttheme-marketplace</code> topic: Browse's search and /marketplace list it
        after the next index run, every 30 minutes.
      </p>
      <CommandRow command={`gh repo edit ${view.owner}/${view.repo} --add-topic ttheme-marketplace`} class="bg-card" />
      <p class={NOTE}>Anyone adds it — you too:</p>
      <CommandRow command={`ttheme marketplace add ${view.owner}/${view.repo}`} class="bg-card" />
      <p class={NOTE}>
        Or let the terminal do all of it: <code class="font-mono">ttheme share</code>, then a marketplace on GitHub.
      </p>
    </>
  )
}

export function MarketPanel({ view, description }: { view: MarketView; description: string }) {
  return (
    <>
      <p class={NOTE}>
        A marketplace is a GitHub repository of palettes. This one holds the palette you made, ready to push.
      </p>
      <div class="grid gap-3 min-[560px]:grid-cols-2">
        <label for="builder-market-owner" class="grid gap-1.5 text-sm">
          <span class="text-muted-foreground">your GitHub handle</span>
          <Input
            id="builder-market-owner"
            data-market="owner"
            value={view.owner}
            placeholder="octocat"
            maxlength="39"
            spellcheck="false"
            autocomplete="off"
            autocapitalize="none"
            autocorrect="off"
            translate="no"
            class="h-9 font-mono text-sm"
          />
        </label>
        <label for="builder-market-name" class="grid gap-1.5 text-sm">
          <span class="text-muted-foreground">marketplace name</span>
          <Input
            id="builder-market-name"
            data-market="name"
            value={view.name}
            placeholder="pastel"
            maxlength="40"
            spellcheck="false"
            autocomplete="off"
            autocapitalize="none"
            autocorrect="off"
            translate="no"
            class="h-9 font-mono text-sm"
          />
        </label>
        <label for="builder-market-about" class="grid gap-1.5 text-sm min-[560px]:col-span-2">
          <span class="text-muted-foreground">description</span>
          <Input
            id="builder-market-about"
            data-market="description"
            value={description}
            placeholder="what the palettes are"
            maxlength="200"
            autocomplete="off"
            class="h-9 text-sm"
          />
        </label>
      </div>
      <div data-market-steps class="grid gap-3">
        <MarketSteps view={view} />
      </div>
    </>
  )
}

export function ExportDialog({
  file,
  link,
  market,
  description,
}: {
  file: FileView
  link: LinkView
  market: MarketView
  description: string
}) {
  return (
    <Dialog
      id="builder-export"
      aria-labelledby="builder-export-title"
      data-export
      class="w-[min(720px,calc(100%-24px))]"
    >
      <DialogClose />
      <div class="grid max-h-[calc(100dvh-48px)] grid-rows-[auto_auto_minmax(0,1fr)] gap-4 px-6 pt-6 pb-6 max-[560px]:px-4">
        <DialogHeader class="pr-12">
          <DialogTitle id="builder-export-title" class="text-display-sm">
            export{' '}
            <span data-export-name translate="no" safe>
              {file.name}
            </span>
          </DialogTitle>
          <DialogDescription>
            Take it as a file, as a link anyone can open, or as a marketplace of your own.
          </DialogDescription>
        </DialogHeader>
        <TabsList label="export as" class="border-b border-border">
          <TabsTrigger
            selected
            id="builder-export-tab-toml"
            aria-controls="builder-export-toml"
            data-export-tab="toml"
            class="h-10"
          >
            <Icon node={FileCode} class="size-4" />
            toml
          </TabsTrigger>
          <TabsTrigger
            selected={false}
            id="builder-export-tab-link"
            aria-controls="builder-export-link"
            data-export-tab="link"
            class="h-10"
          >
            <Icon node={Link} class="size-4" />
            link
          </TabsTrigger>
          <TabsTrigger
            selected={false}
            id="builder-export-tab-market"
            aria-controls="builder-export-market"
            data-export-tab="market"
            class="h-10"
          >
            <Icon node={Package} class="size-4" />
            marketplace
          </TabsTrigger>
        </TabsList>
        <div class="-mx-1 min-h-0 overflow-y-auto overscroll-contain px-1">
          <section
            id="builder-export-toml"
            role="tabpanel"
            aria-labelledby="builder-export-tab-toml"
            data-export-panel="toml"
            class={PANEL}
          >
            <FilePanel view={file} />
          </section>
          <section
            id="builder-export-link"
            role="tabpanel"
            aria-labelledby="builder-export-tab-link"
            data-export-panel="link"
            hidden
            class={PANEL}
          >
            <LinkPanel view={link} />
          </section>
          <section
            id="builder-export-market"
            role="tabpanel"
            aria-labelledby="builder-export-tab-market"
            data-export-panel="market"
            hidden
            class={PANEL}
          >
            <MarketPanel view={market} description={description} />
          </section>
        </div>
      </div>
    </Dialog>
  )
}
