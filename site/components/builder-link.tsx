import { Check, Copy, Link } from 'lucide'
import { Button, LinkButton } from '@/components/ui/button'
import { INIT } from '@/lib/gallery'
import { Icon } from '@/lib/icons'
import type { Shared } from '@/lib/share'
import { pinned } from '@/lib/themes'
import { CommandRow } from './command-row'
import { SectionLabel, Signature } from './palette-parts'

function bringing(count: number): string {
  return `It brings ${count === 1 ? 'a picture, downloaded from its post' : `${count} pictures, downloaded from their posts`} as it installs.`
}

function picturesIn(shared: Shared): number {
  return shared.drafts.reduce((sum, draft) => sum + (draft.pictures?.length ?? 0), 0)
}

function Installs({ shared }: { shared: Shared }) {
  const pictures = picturesIn(shared)

  return (
    <>
      <CommandRow command={`ttheme add ${shared.code}`} class="bg-card" />
      {shared.palettes.length > 1 ? (
        <p class="text-xs text-muted-foreground" safe>
          {`It installs all ${shared.palettes.length} palettes in this link.`}
        </p>
      ) : null}
      {pictures > 0 ? (
        <p class="text-xs text-muted-foreground" safe>
          {bringing(pictures)}
        </p>
      ) : null}
      <p class="text-xs text-muted-foreground">New to ttheme? Set it up first:</p>
      <CommandRow command={INIT} class="bg-card" />
    </>
  )
}

export function LinkStrip({ shared }: { shared: Shared }) {
  return (
    <nav
      data-strip
      aria-label="palettes in this link"
      class="flex min-w-0 items-center gap-1.5 overflow-x-auto border-b border-border bg-background px-4 py-2 [grid-area:strip] [scrollbar-width:none] app:py-0"
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

export function AddPopover({ shared }: { shared: Shared }) {
  return (
    <div
      id="builder-add"
      popover="auto"
      class="m-0 hidden w-[min(440px,calc(100vw-32px))] gap-2.5 rounded-3xl border border-border bg-popover p-4 text-popover-foreground shadow-lg inset-auto open:grid"
    >
      <Installs shared={shared} />
      <p class="text-xs text-muted-foreground">
        Or{' '}
        <button
          type="button"
          data-export-open
          class="font-medium text-foreground underline underline-offset-4 outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
        >
          export it
        </button>{' '}
        as a file.
      </p>
    </div>
  )
}

export function LinkSection({ shared }: { shared: Shared }) {
  const { code, link } = shared

  return (
    <div data-link-only class="grid gap-2.5 border-b border-border p-4">
      <SectionLabel icon={<Icon node={Link} />}>Share link</SectionLabel>
      <p data-touched-note hidden class="text-xs text-warning">
        Your changes are not in this link — export makes one that carries them.
      </p>
      <code
        translate="no"
        class="block rounded-lg border border-border bg-muted px-3 py-2.5 font-mono text-xs leading-relaxed [overflow-wrap:anywhere] text-soft-foreground"
        safe
      >
        {code}
      </code>
      <div class="flex flex-wrap gap-1.5">
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
      <Installs shared={shared} />
    </div>
  )
}
