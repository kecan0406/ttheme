import { ChevronRight } from 'lucide'
import { COMMANDS, type Command, sectionId } from '@/lib/commands'
import { DOC_PAGES, DOCS, DOCS_PATH, type DocPage, guideOf } from '@/lib/docs'
import type { Facts } from '@/lib/facts'
import { Icon } from '@/lib/icons'
import { renderInline } from '@/lib/markdown'
import { SETTING_GROUPS } from '@/lib/settings'
import { DocsFrame, TocDetails } from './docs-frame'

const COMMANDS_PATH = `${DOCS_PATH}/reference/commands`

function Crumbs({ group }: { group?: string }) {
  return (
    <p class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <a href={DOCS_PATH} class="transition-colors hover:text-foreground">
        docs
      </a>
      {group ? (
        <>
          <Icon node={ChevronRight} class="size-3.5" />
          <span safe>{group.toLowerCase()}</span>
        </>
      ) : null}
    </p>
  )
}

function Chips({ verbs }: { verbs: string[] }) {
  return verbs.length === 0 ? null : (
    <ul aria-label="commands on this page" class="flex flex-wrap gap-1.5">
      {verbs.map((verb) => (
        <li>
          <a
            href={`${COMMANDS_PATH}#${verb}`}
            translate="no"
            class="inline-flex items-center rounded-full border border-border bg-muted/65 px-2.5 py-1 font-mono text-xs text-foreground transition-colors hover:border-input"
            safe
          >
            {`ttheme ${verb}`}
          </a>
        </li>
      ))}
    </ul>
  )
}

function Head({ page }: { page: DocPage }) {
  const safeLede = page.safeLede

  return (
    <header class="grid gap-4">
      <Crumbs group={page.group.title} />
      <h1 class="font-display text-display-lg font-black text-balance" safe>
        {page.title}
      </h1>
      <p data-lede class="max-w-[62ch] text-pretty text-soft-foreground">
        {safeLede}
      </p>
      <Chips verbs={page.verbs} />
      <TocDetails toc={page.toc} />
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
        <code translate="no" safe>
          {command.name}
        </code>
      </h3>
      <pre data-slot="usage" translate="no">
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
          <h2 id={sectionId(section)} safe>
            {section.title}
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
          <h2 id={group.id} safe>
            {group.title}
          </h2>
          {group.settings.map((setting) => (
            <section data-entry>
              <h3 id={setting.id}>
                <code translate="no" safe>
                  {setting.name}
                </code>
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

export function DocsPage({ page, facts }: { page: DocPage; facts: Facts }) {
  const safeBody = page.safeBody

  return (
    <DocsFrame
      facts={facts}
      path={page.path}
      toc={page.toc}
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

export function DocsIndex({ facts, about }: { facts: Facts; about: string }) {
  const [first] = DOC_PAGES

  return (
    <DocsFrame facts={facts} path={DOCS_PATH} toc={[]} next={first && { title: first.title, path: first.path }}>
      <header class="grid gap-4">
        <h1 class="font-display text-display-lg font-black">docs</h1>
        <p class="max-w-[62ch] text-pretty text-soft-foreground" safe>
          {about}
        </p>
      </header>
      <div class="grid grid-cols-[repeat(auto-fit,minmax(min(100%,17rem),1fr))] items-start gap-3">
        {DOCS.map((group) => (
          <section
            class="grid content-start gap-2.5 rounded-xl border border-border bg-card p-4.5"
            aria-labelledby={`index-${group.slug}`}
          >
            <h2
              id={`index-${group.slug}`}
              class="text-2xs font-bold tracking-caps text-muted-foreground uppercase"
              safe
            >
              {group.title}
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
