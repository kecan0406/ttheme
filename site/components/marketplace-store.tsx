import { escapeHtml, type PropsWithChildren } from '@kitajs/html'
import { CalendarDays, FolderTree, GitBranch, Package, Palette, Scale, ShieldCheck } from 'lucide'
import { Badge } from '@/components/ui/badge'
import { catalogsOf } from '@/lib/catalogs'
import { catalogAnchor, OFFICIAL, OFFICIAL_ABOUT, OFFICIAL_REPO } from '@/lib/gallery'
import { Icon } from '@/lib/icons'
import { gatePassed } from '@/lib/sheet'
import type { GateRule, Marketplace, Theme } from '@/lib/themes'
import { CommandRow, INIT } from './command-row'
import { Crumbs, MarketplaceFrame } from './marketplace-frame'
import { PaletteRow } from './palette-rows'

function Meta({ icon, children }: PropsWithChildren<{ icon: JSX.Element }>) {
  return (
    <span class="inline-flex items-center gap-1.5 [&_svg]:size-4 [&_svg]:text-muted-foreground">
      {icon}
      {children}
    </span>
  )
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

export function MarketplaceStore({
  marketplace,
  palettes,
  gate,
}: {
  marketplace: Marketplace | null
  palettes: Theme[]
  gate: GateRule[]
}) {
  const id = marketplace?.id ?? OFFICIAL
  const shelves = catalogsOf(palettes)
  const clean = palettes.filter((theme) => gatePassed(theme, gate) === gate.length).length
  const repo = marketplace?.repo ?? OFFICIAL_REPO

  return (
    <MarketplaceFrame>
      <header class="grid gap-4">
        <Crumbs trail={[{ label: 'marketplace', href: '/marketplace' }, { label: id }]} />
        <h1 class="font-display text-display-lg font-black [overflow-wrap:anywhere]" safe>
          {id}
        </h1>
        <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-soft-foreground">
          <Meta icon={<Icon node={Palette} />}>{escapeHtml(plural(palettes.length, 'palette'))}</Meta>
          <Meta icon={<Icon node={FolderTree} />}>
            {escapeHtml(plural(shelves.filter((shelf) => shelf.catalog !== null).length, 'catalog'))}
          </Meta>
          <Meta icon={<Icon node={ShieldCheck} />}>
            {escapeHtml(
              marketplace ? `${clean} of ${palettes.length} clear the gate · advisory` : 'every one clears the gate',
            )}
          </Meta>
          {marketplace ? (
            <>
              <Meta icon={<Icon node={Scale} />}>
                {marketplace.license ? (
                  escapeHtml(marketplace.license)
                ) : (
                  <Badge variant="warning">no license stated</Badge>
                )}
              </Meta>
              <Meta icon={<Icon node={CalendarDays} />}>{escapeHtml(`pushed ${marketplace.pushedAt}`)}</Meta>
            </>
          ) : (
            <Meta icon={<Icon node={Package} />}>comes with ttheme</Meta>
          )}
          <Meta icon={<Icon node={GitBranch} />}>
            <a href={`https://github.com/${repo}`} class="transition-colors hover:text-foreground" safe>
              {repo}
            </a>
            {marketplace ? (
              <span class="text-muted-foreground">{escapeHtml(`· ${plural(marketplace.stars, 'GitHub star')}`)}</span>
            ) : null}
          </Meta>
        </div>
        <p class="max-w-[68ch] text-soft-foreground" safe>
          {marketplace ? marketplace.about : OFFICIAL_ABOUT}
        </p>
        <CommandRow
          command={marketplace ? `ttheme marketplace add ${marketplace.add}` : INIT}
          class="max-w-[760px] bg-card"
        />
      </header>
      {shelves.map(({ catalog, themes }) => (
        <section
          id={catalogAnchor(catalog)}
          aria-labelledby={`${catalogAnchor(catalog)}-title`}
          class="grid scroll-mt-28 grid-cols-[minmax(0,1fr)] gap-4"
        >
          <div class="grid gap-1">
            <h2
              id={`${catalogAnchor(catalog)}-title`}
              class="font-display text-display-sm font-black [overflow-wrap:anywhere]"
              safe
            >
              {catalog ?? 'other palettes'}
            </h2>
            <p class="text-sm text-muted-foreground" safe>
              {[themes[0]?.native, plural(themes.length, 'palette')].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div class="grid grid-cols-[minmax(0,1fr)] border-t">
            {themes.map((theme) => (
              <PaletteRow theme={theme} gate={gate} where={marketplace !== null} />
            ))}
          </div>
        </section>
      ))}
    </MarketplaceFrame>
  )
}

export function NoSuchMarketplace({ id }: { id: string }) {
  return (
    <MarketplaceFrame>
      <div class="grid justify-items-start gap-3">
        <Crumbs trail={[{ label: 'marketplace', href: '/marketplace' }, { label: id }]} />
        <h1 class="font-display text-display-lg font-black">no such marketplace</h1>
        <p class="max-w-[68ch] text-soft-foreground">
          {escapeHtml(`No repository with the ttheme-marketplace topic publishes ${id}.`)} The list is refreshed from
          GitHub every hour. ( ˘ω˘ )
        </p>
        <a href="/marketplace" class="text-sm font-medium text-primary underline-offset-4 hover:underline">
          back to every palette
        </a>
      </div>
    </MarketplaceFrame>
  )
}
