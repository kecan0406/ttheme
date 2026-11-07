import { ArrowRight } from 'lucide'
import { InitRow } from '@/components/command-row'
import { LinkButton } from '@/components/ui/button'
import { COMMANDS, type Command, sectionId } from '@/lib/commands'
import { bodyOf, DOC_PAGES, DOCS, DOCS_PATH, type DocPage, docAt, guideOf } from '@/lib/docs'
import type { Facts } from '@/lib/facts'
import { Icon } from '@/lib/icons'
import { renderInline } from '@/lib/markdown'
import { SETTING_GROUPS } from '@/lib/settings'
import { DocGroupIcon } from './doc-group-icon'
import { DocsFrame, TocDetails } from './docs-frame'
import { HeadingAnchor } from './heading-anchor'

function Crumbs({ group }: { group: DocPage['group'] }) {
  return (
    <p class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <DocGroupIcon group={group.slug} class="size-3.25 flex-none" />
      <span safe>{group.title}</span>
    </p>
  )
}

function sectionsOf(page: DocPage): DocPage['toc'] {
  return page.toc.filter((heading) => heading.depth === 2)
}

function Head({ page }: { page: DocPage }) {
  const safeLede = page.safeLede

  return (
    <header class="grid gap-3">
      <Crumbs group={page.group} />
      <h1 class="font-display text-display-lg font-black text-balance" safe>
        {page.title}
      </h1>
      <p data-lede class="max-w-[62ch] text-pretty text-soft-foreground">
        {safeLede}
      </p>
      <TocDetails toc={sectionsOf(page)} />
    </header>
  )
}

function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <dl data-rows>
      {rows.map(([term, about]) => {
        const safeAbout = renderInline(about)

        return (
          <div>
            <dt>
              <code translate="no" safe>
                {term}
              </code>
            </dt>
            <dd>{safeAbout}</dd>
          </div>
        )
      })}
    </dl>
  )
}

function CommandEntry({ command }: { command: Command }) {
  const safeAbout = renderInline(command.about)
  const guide = guideOf(command.name)

  return (
    <section data-entry>
      <h3 id={command.name}>
        <HeadingAnchor id={command.name}>
          <code translate="no" safe>
            {command.name}
          </code>
        </HeadingAnchor>
      </h3>
      <pre data-slot="usage" tabindex="0" translate="no">
        <code safe>{command.usage}</code>
      </pre>
      <p>{safeAbout}</p>
      {command.actions.length > 0 ? <Rows rows={command.actions} /> : null}
      {command.flags.length > 0 ? <Rows rows={command.flags} /> : null}
      {command.notes.map((note) => {
        const safeNote = renderInline(note)

        return <p>{safeNote}</p>
      })}
      {command.exits ? <Rows rows={COMMANDS.exits} /> : null}
      {guide ? (
        <p data-guide>
          guide:{' '}
          <a href={guide.path} safe>
            {guide.title}
          </a>
        </p>
      ) : null}
    </section>
  )
}

function CommandsBody() {
  return (
    <>
      {COMMANDS.sections.map((section) => (
        <section>
          <h2 id={sectionId(section)}>
            <HeadingAnchor id={sectionId(section)}>
              <span safe>{section.title}</span>
            </HeadingAnchor>
          </h2>
          {section.commands.map((command) => (
            <CommandEntry command={command} />
          ))}
        </section>
      ))}
    </>
  )
}

function SettingsBody() {
  return (
    <>
      {SETTING_GROUPS.map((group) => (
        <section>
          <h2 id={group.id}>
            <HeadingAnchor id={group.id}>
              <span safe>{group.title}</span>
            </HeadingAnchor>
          </h2>
          {group.settings.map((setting) => (
            <section data-entry>
              <h3 id={setting.id}>
                <HeadingAnchor id={setting.id}>
                  <code translate="no" safe>
                    {setting.name}
                  </code>
                </HeadingAnchor>
              </h3>
              <p data-default>
                default{' '}
                <code translate="no" safe>
                  {setting.fallback}
                </code>
              </p>
              <p safe>{setting.about}</p>
            </section>
          ))}
        </section>
      ))}
    </>
  )
}

export function DocsPage({
  page,
  facts,
  icons,
}: {
  page: DocPage
  facts: Facts
  icons: Readonly<Record<string, string>>
}) {
  const safeBody = bodyOf(page, icons)

  return (
    <DocsFrame
      facts={facts}
      path={page.path}
      toc={sectionsOf(page)}
      prev={page.prev}
      next={page.next}
      source={page.source}
      made={page.made !== undefined}
    >
      <Head page={page} />
      <div data-doc-body>
        {safeBody}
        {page.made === 'commands' ? <CommandsBody /> : null}
        {page.made === 'settings' ? <SettingsBody /> : null}
      </div>
    </DocsFrame>
  )
}

function StartHere() {
  const quick = docAt('guide', 'quickstart')

  return quick ? (
    <section aria-labelledby="start-here" class="grid gap-3 rounded-xl border border-border bg-muted/65 px-4 py-3">
      <div class="grid gap-1">
        <h2 id="start-here" class="text-2xs font-bold tracking-caps text-muted-foreground uppercase">
          start here
        </h2>
        <p class="max-w-[62ch] text-pretty text-foreground" safe>
          {quick.description}
        </p>
      </div>
      <InitRow class="bg-card" />
      <div class="flex flex-wrap gap-2">
        <LinkButton href={quick.path}>
          <span safe>{quick.title.toLowerCase()}</span>
          <Icon node={ArrowRight} />
        </LinkButton>
      </div>
    </section>
  ) : null
}

export function DocsIndex({ facts, about }: { facts: Facts; about: string }) {
  const [first] = DOC_PAGES

  return (
    <DocsFrame facts={facts} path={DOCS_PATH} toc={[]} next={first && { title: first.title, path: first.path }}>
      <header class="grid gap-3">
        <h1 class="font-display text-display-lg font-black">docs</h1>
        <p class="max-w-[62ch] text-pretty text-soft-foreground" safe>
          {about}
        </p>
      </header>
      <StartHere />
      <div class="grid grid-cols-[repeat(auto-fit,minmax(min(100%,17rem),1fr))] items-start gap-3">
        {DOCS.map((group) => (
          <section
            class="grid content-start gap-3 rounded-xl border border-border bg-card px-4 py-3"
            aria-labelledby={`index-${group.slug}`}
          >
            <h2
              id={`index-${group.slug}`}
              class="flex items-center gap-1.5 text-2xs font-bold tracking-caps text-muted-foreground uppercase"
            >
              <DocGroupIcon group={group.slug} class="size-3.25 flex-none" />
              <span safe>{group.title}</span>
            </h2>
            <ul class="grid gap-3">
              {group.pages.map((page) => (
                <li class="grid gap-0.5">
                  <a href={page.path} class="font-semibold text-foreground transition-colors hover:text-primary" safe>
                    {page.title}
                  </a>
                  <span class="text-sm text-muted-foreground" safe>
                    {page.description}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </DocsFrame>
  )
}
