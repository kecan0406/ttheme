import { escapeHtml } from '@kitajs/html'
import { arrange, type Section } from '@/lib/gallery'
import { json } from '@/lib/render'
import type { GateRule, Marketplace } from '@/lib/themes'
import { FilterBar } from './filter-bar'
import { PaletteCard } from './palette-card'
import { PaletteDialog } from './palette-dialog'

export function MarketplaceGallery({
  sections,
  marketplaces,
  gate,
  sources = true,
}: {
  sections: Section[]
  marketplaces: Marketplace[]
  gate: GateRule[]
  sources?: boolean
}) {
  const all = sections.flatMap((section) => section.themes)
  const placed = arrange(
    sections.map((section) => ({
      title: section.title,
      marketplace: section.themes[0]?.marketplace != null,
      count: section.themes.length,
    })),
    sources,
  )

  return (
    <palette-gallery class="contents" data-sources={sources ? 'all' : 'one'}>
      <FilterBar total={all.length} sources={sources} />
      <div class="grid gap-8 pt-5 pb-15">
        {sections.map((section, index) => {
          const place = placed[index]
          return (
            <section
              data-shelf={section.title}
              data-marketplace={section.themes[0]?.marketplace ? '' : undefined}
              aria-label={section.subtitle ? `${section.title} ${section.subtitle}` : section.title}
              hidden={!place?.shown}
              class="grid gap-4"
            >
              {sources ? (
                <div
                  data-divider
                  hidden={!place?.divider}
                  class="flex items-center gap-3 text-sm text-muted-foreground after:h-px after:flex-1 after:bg-border"
                >
                  ── Marketplaces
                </div>
              ) : null}
              <h2 data-heading hidden={!place?.heading} class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span class="text-base font-semibold" safe>
                  {section.title}
                </span>
                <span data-total class="text-xs text-muted-foreground tabular-nums">
                  {place?.total ?? 0}
                </span>
                {section.href ? (
                  <a href={section.href} class="text-xs font-medium text-primary underline-offset-4 hover:underline">
                    marketplace page
                  </a>
                ) : null}
              </h2>
              {section.subtitle ? (
                <h3 class="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm font-semibold text-soft-foreground">
                  {escapeHtml(section.subtitle)}
                  <span data-count class="text-xs font-normal text-muted-foreground tabular-nums">
                    {section.themes.length}
                  </span>
                </h3>
              ) : null}
              <div class="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
                {section.themes.map((theme) => (
                  <PaletteCard theme={theme} scene="shell" />
                ))}
              </div>
            </section>
          )
        })}
        <div data-empty hidden={all.length > 0} class="py-15 text-center text-muted-foreground">
          <strong data-empty-title class="block font-semibold text-foreground">
            no palette matches these filters ( ˘ω˘ )
          </strong>
          clear a filter, or search for a series instead.
        </div>
      </div>
      <PaletteDialog />
      <script type="application/json" data-gallery>
        {json({ themes: all, marketplaces, gate })}
      </script>
    </palette-gallery>
  )
}
