import type { PropsWithChildren } from '@kitajs/html'
import { ArrowUp, ChevronDown, ChevronLeft, ChevronRight, Menu, Search } from 'lucide'
import { siGithub } from 'simple-icons'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from '@/components/ui/collapsible'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Kbd } from '@/components/ui/kbd'
import { Popover, PopoverTrigger } from '@/components/ui/popover'
import { DOCS, DOCS_PATH, type DocLink, REPOSITORY } from '@/lib/docs'
import type { Facts } from '@/lib/facts'
import { BrandIcon, Icon } from '@/lib/icons'
import type { Heading } from '@/lib/markdown'
import { SiteFooter } from './site-footer'
import { SiteHeader } from './site-header'

const GLASS = 'border border-border bg-glass-panel backdrop-blur-[22px] backdrop-saturate-170'

function termsOf(title: string, label: string, toc: Heading[]): string {
  return [title, label, ...toc.map((heading) => heading.text)].join(' ').toLowerCase()
}

function DocsNav({ path }: { path: string }) {
  return (
    <Popover
      id="docs-menu"
      render={(props) => (
        <nav
          {...props}
          aria-label="docs"
          class={`${GLASS} top-34 left-5 m-0 max-h-[calc(100dvh-10rem)] w-72 max-w-[calc(100vw-2.5rem)] content-start gap-1 overflow-y-auto rounded-xl p-3 text-foreground shadow-lg inset-auto open:grid docs-side:sticky docs-side:top-(--clearance) docs-side:grid docs-side:max-h-[min(100dvh_-_var(--clearance)_-_--spacing(3),var(--docs-room,100dvh))] docs-side:w-auto docs-side:self-start docs-side:shadow-none`}
        />
      )}
    >
      <search data-docs-search>
        <InputGroup>
          <InputGroupAddon>
            <Icon node={Search} />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            name="docs-query"
            placeholder="Search docs"
            aria-label="Search docs"
            aria-keyshortcuts="Meta+K Control+K"
            spellcheck="false"
            autocomplete="off"
            autocapitalize="none"
            autocorrect="off"
            enterkeyhint="go"
          />
          <InputGroupAddon align="inline-end">
            <Kbd>
              <span data-key="apple">⌘</span>
              <span data-key="other">ctrl</span>k
            </Kbd>
          </InputGroupAddon>
        </InputGroup>
      </search>
      {DOCS.map((group) => (
        <section data-group class="grid gap-0.5" aria-labelledby={`docs-${group.slug}`}>
          <p
            id={`docs-${group.slug}`}
            class="mt-3 mb-1 px-2.5 text-2xs font-bold tracking-caps text-muted-foreground uppercase"
            safe
          >
            {group.title}
          </p>
          <ul class="grid gap-0.5">
            {group.pages.map((page) => (
              <li data-terms={termsOf(page.title, page.label, page.toc)}>
                <a
                  href={page.path}
                  aria-current={page.path === path ? 'page' : undefined}
                  class="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium text-soft-foreground transition-colors hover:bg-muted hover:text-foreground aria-[current=page]:bg-accent aria-[current=page]:text-foreground aria-[current=page]:after:ml-auto aria-[current=page]:after:size-1.5 aria-[current=page]:after:flex-none aria-[current=page]:after:rounded-full aria-[current=page]:after:bg-primary aria-[current=page]:after:content-['']"
                  safe
                >
                  {page.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p data-none hidden class="px-2.5 py-3 text-sm text-muted-foreground">
        No page matches ( ˘ω˘ )
      </p>
    </Popover>
  )
}

function TocList({ toc }: { toc: Heading[] }) {
  return (
    <ol data-toc class="grid">
      {toc.map((heading) => (
        <li data-depth={heading.depth}>
          <a href={`#${heading.id}`} safe>
            {heading.text}
          </a>
        </li>
      ))}
    </ol>
  )
}

function DocsToc({ toc }: { toc: Heading[] }) {
  return (
    <aside
      aria-labelledby="docs-toc"
      class={`${GLASS} sticky top-(--clearance) hidden max-h-[min(100dvh_-_var(--clearance)_-_--spacing(3),var(--docs-room,100dvh))] content-start gap-3 overflow-y-auto rounded-xl p-4 docs-toc:grid`}
    >
      <p id="docs-toc" class="text-2xs font-bold tracking-caps text-muted-foreground uppercase">
        On this page
      </p>
      <TocList toc={toc} />
      <a
        href="#top"
        class="inline-flex items-center gap-1.5 justify-self-start text-xs font-medium text-soft-foreground transition-colors hover:text-foreground"
      >
        <Icon node={ArrowUp} class="size-3.5" />
        Back to top
      </a>
    </aside>
  )
}

export function TocDetails({ toc }: { toc: Heading[] }) {
  return toc.length === 0 ? null : (
    <Collapsible class="group/toc rounded-xl border border-border bg-muted/65 docs-toc:hidden">
      <CollapsibleTrigger class="flex items-center justify-between gap-2 px-4 py-2.5 text-sm font-medium text-soft-foreground">
        On this page
        <Icon node={ChevronDown} class="size-4 transition-transform group-data-open/toc:rotate-180" />
      </CollapsibleTrigger>
      <CollapsiblePanel>
        <div class="px-4 pb-3">
          <TocList toc={toc} />
        </div>
      </CollapsiblePanel>
    </Collapsible>
  )
}

function Step({ link, rel }: { link: DocLink; rel: 'prev' | 'next' }) {
  return (
    <a
      href={link.path}
      rel={rel}
      data-rel={rel}
      class="flex items-center gap-3.5 rounded-xl border border-border bg-card px-4.5 py-4 text-foreground transition-colors hover:border-input hover:bg-muted data-[rel=next]:col-start-2 data-[rel=next]:justify-end data-[rel=next]:text-right"
    >
      {rel === 'prev' ? <Icon node={ChevronLeft} class="size-4 flex-none text-muted-foreground" /> : null}
      <span class="grid min-w-0 gap-0.5">
        <span class="text-2xs font-bold tracking-caps text-muted-foreground uppercase">
          {rel === 'prev' ? 'previous' : 'next'}
        </span>
        <span class="font-semibold [overflow-wrap:anywhere]" safe>
          {link.title}
        </span>
      </span>
      {rel === 'next' ? <Icon node={ChevronRight} class="size-4 flex-none text-muted-foreground" /> : null}
    </a>
  )
}

export function DocsFrame({
  facts,
  path,
  toc,
  prev,
  next,
  source,
  made,
  children,
}: PropsWithChildren<{
  facts: Facts
  path: string
  toc: Heading[]
  prev?: DocLink
  next?: DocLink
  source?: string
  made?: boolean
}>) {
  return (
    <div class="ground flex min-h-dvh flex-col">
      <SiteHeader current={DOCS_PATH} facts={facts} />
      <div data-docs class="mx-auto w-[min(1280px,calc(100%-40px))] pt-3 pb-12">
        <docs-page class="grid grid-cols-[minmax(0,1fr)] items-start gap-3 docs-side:grid-cols-[15.5rem_minmax(0,1fr)] docs-toc:grid-cols-[15.5rem_minmax(0,1fr)_13.5rem]">
          <PopoverTrigger
            popover="docs-menu"
            dialog={false}
            render={(props) => (
              <Button {...props} variant="outline" size="sm" class="justify-self-start docs-side:hidden">
                <Icon node={Menu} />
                Pages
              </Button>
            )}
          />
          <DocsNav path={path} />
          <main
            id="content"
            class="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-6 rounded-3xl border border-border bg-card px-4.5 pt-6 pb-6 text-card-foreground shadow-md docs-side:px-10 docs-side:pt-10"
          >
            {children}
            <footer class="grid gap-6 pt-6">
              {prev || next ? (
                <nav aria-label="pages" class="grid grid-cols-2 gap-3">
                  {prev ? <Step link={prev} rel="prev" /> : null}
                  {next ? <Step link={next} rel="next" /> : null}
                </nav>
              ) : null}
              {source ? (
                <p class="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
                  {made ? (
                    <span>
                      made from{' '}
                      <code class="font-mono" safe>
                        {source}
                      </code>
                    </span>
                  ) : null}
                  <a
                    href={`${REPOSITORY}/${made ? 'blob' : 'edit'}/main/${source}`}
                    target="_blank"
                    rel="noopener"
                    class="ml-auto inline-flex items-center gap-1.5 font-medium text-soft-foreground transition-colors hover:text-foreground"
                  >
                    <BrandIcon icon={siGithub} class="size-3" />
                    {made ? 'view the source on github' : 'edit this page on github'}
                  </a>
                </p>
              ) : null}
            </footer>
          </main>
          {toc.length > 0 ? <DocsToc toc={toc} /> : null}
        </docs-page>
      </div>
      <SiteFooter facts={facts} />
    </div>
  )
}
