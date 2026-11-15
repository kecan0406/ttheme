import { COMMANDS, type Command, sectionId, sectionTitle } from '@/lib/commands'
import { bodyOf, DOCS_HOME, type DocPage, guideOf, homeBody } from '@/lib/docs'
import type { Facts } from '@/lib/facts'
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
              <span safe>{sectionTitle(section)}</span>
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

export function DocsIndex({ facts, icons }: { facts: Facts; icons: Readonly<Record<string, string>> }) {
  const home = DOCS_HOME
  const safeLede = home.safeLede
  const safeBody = homeBody(icons)
  const toc = home.toc.filter((heading) => heading.depth === 2)

  return (
    <DocsFrame facts={facts} path={home.path} toc={toc} next={home.next} source={home.file}>
      <header class="grid gap-3">
        <h1 class="font-display text-display-lg font-black text-balance" safe>
          {home.title}
        </h1>
        <p data-lede class="max-w-[62ch] text-pretty text-soft-foreground">
          {safeLede}
        </p>
        <TocDetails toc={toc} />
      </header>
      <div data-doc-body>{safeBody}</div>
    </DocsFrame>
  )
}
