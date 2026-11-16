import { TERMINALS } from '@/components/terminal-list'
import { themes } from '@/lib/builtin'
import { COMMANDS, commandsToc } from '@/lib/commands'
import { type Doc, type Heading, renderDoc } from '@/lib/markdown'
import type { DocIcon, GroupSlug, MenuDocGroup, MenuDocs } from '@/lib/menu'
import { SETTING_GROUPS } from '@/lib/settings'
import commands from '../../docs/cli/commands.md' with { type: 'text' }
import configuration from '../../docs/cli/configuration.md' with { type: 'text' }
import environment from '../../docs/cli/environment.md' with { type: 'text' }
import make from '../../docs/guide/make.md' with { type: 'text' }
import quickstart from '../../docs/guide/quickstart.md' with { type: 'text' }
import use from '../../docs/guide/use.md' with { type: 'text' }
import indexText from '../../docs/index.md' with { type: 'text' }
import terminals from '../../docs/reference/terminals.md' with { type: 'text' }
import { GATE_RULES } from '../../src/core/contrast.ts'

export type Made = 'commands' | 'settings'

interface Entry {
  slug: string
  label: string
  text: string
  made?: Made
  menu?: { blurb: string; icon: DocIcon }
}

interface Group {
  slug: GroupSlug
  title: string
  pages: Entry[]
}

export interface DocLink {
  title: string
  path: string
}

export interface DocPage extends Doc {
  slug: string
  label: string
  group: { slug: GroupSlug; title: string }
  path: string
  file: string
  source: string
  made?: Made
  prev?: DocLink
  next?: DocLink
}

interface DocGroup {
  slug: GroupSlug
  title: string
  pages: DocPage[]
}

export const DOCS_PATH = '/docs'

export const REPOSITORY = 'https://github.com/ttheme-project/ttheme'

const NAV: Group[] = [
  {
    slug: 'guide',
    title: 'Guide',
    pages: [
      { slug: 'quickstart', label: 'Get Started', text: quickstart },
      {
        slug: 'use',
        label: 'Use ttheme',
        text: use,
        menu: { blurb: 'Try palettes on, pin one to a folder, switch light and dark', icon: 'use' },
      },
      {
        slug: 'make',
        label: 'Make a Palette',
        text: make,
        menu: { blurb: 'Tune twenty colors and share them as a link', icon: 'make' },
      },
    ],
  },
  {
    slug: 'cli',
    title: 'CLI',
    pages: [
      {
        slug: 'commands',
        label: 'Commands',
        text: commands,
        made: 'commands',
        menu: { blurb: 'Every command, its arguments and its options', icon: 'commands' },
      },
      {
        slug: 'configuration',
        label: 'Configuration',
        text: configuration,
        made: 'settings',
        menu: { blurb: 'Your files, every setting in config.zsh and its default', icon: 'settings' },
      },
      {
        slug: 'environment',
        label: 'Environment Variables',
        text: environment,
        menu: { blurb: 'Folders, proxy, editor and colors', icon: 'environment' },
      },
    ],
  },
  {
    slug: 'reference',
    title: 'Reference',
    pages: [
      {
        slug: 'terminals',
        label: 'Terminal Support',
        text: terminals,
        menu: { blurb: 'What each terminal shows, and what it cannot', icon: 'terminals' },
      },
    ],
  },
]

const MADE_FROM: Record<Made, string> = {
  commands: 'src/cli/verbs.ts',
  settings: 'src/store/wiring.ts',
}

const INDEX_FILE = 'docs/index.md'

export const DOC_FILES = [
  INDEX_FILE,
  ...NAV.flatMap((group) => group.pages.map((page) => `docs/${group.slug}/${page.slug}.md`)),
]

const VERBS = COMMANDS.sections.flatMap((section) => section.commands.map((command) => command.name))

function pathOf(group: string, slug: string): string {
  return `${DOCS_PATH}/${group}/${slug}`
}

function resolver(from: string, here: string): (href: string) => string {
  return (href) => {
    if (href.startsWith('#')) return `${here}${href}`
    const [file = '', anchor] = href.split('#')
    const parts = `${from.slice(0, from.lastIndexOf('/'))}/${file}`.split('/')
    const joined: string[] = []

    for (const part of parts) {
      if (part === '..') joined.pop()
      else if (part !== '.') joined.push(part)
    }

    const target = joined.join('/')
    const hash = anchor ? `#${anchor}` : ''
    const page = /^docs\/([^/]+)\/([^/]+)\.md$/.exec(target)

    if (target === INDEX_FILE) return `${DOCS_PATH}${hash}`

    if (page && DOC_FILES.includes(target)) return `${pathOf(page[1] as string, page[2] as string)}${hash}`

    if (!target.startsWith('docs/') && /\.(md|toml|json|ts)$/.test(target))
      return `${REPOSITORY}/blob/main/${target}${hash}`

    throw new Error(`${from} links to ${href}, which is no docs page`)
  }
}

function madeToc(made: Made | undefined): Heading[] {
  if (made === 'commands') return commandsToc(COMMANDS)

  if (made === 'settings') {
    return SETTING_GROUPS.flatMap((group) => [
      { depth: 2 as const, id: group.id, text: group.title },
      ...group.settings.map((setting) => ({ depth: 3 as const, id: setting.id, text: setting.name })),
    ])
  }

  return []
}

type Icons = Readonly<Record<string, string>>

function placeOf(from: string, here: string, icons: Icons): Parameters<typeof renderDoc>[1] {
  return {
    resolve: resolver(from, here),
    verbs: VERBS,
    theme: (id) => themes.find((theme) => theme.id === id),
    terminal: (name) => {
      const terminal = TERMINALS.find((each) => each.name === name)

      return terminal
        ? { url: terminal.url, icon: Object.hasOwn(icons, terminal.id) ? icons[terminal.id] : undefined }
        : undefined
    },
    docIcon: (path) =>
      NAV.flatMap((group) => group.pages.map((entry) => ({ path: pathOf(group.slug, entry.slug), entry }))).find(
        (each) => each.path === path,
      )?.entry.menu?.icon,
  }
}

const FLAT = NAV.flatMap((group) =>
  group.pages.map((entry) => {
    const file = `docs/${group.slug}/${entry.slug}.md`
    const doc = renderDoc(entry.text, placeOf(file, pathOf(group.slug, entry.slug), {}))

    const extra = madeToc(entry.made)

    return {
      ...doc,
      toc: [...doc.toc, ...extra],
      ids: [...doc.ids, ...extra.map((heading) => heading.id)],
      slug: entry.slug,
      label: entry.label,
      group: { slug: group.slug, title: group.title },
      path: pathOf(group.slug, entry.slug),
      file,
      source: entry.made ? MADE_FROM[entry.made] : file,
      ...(entry.made ? { made: entry.made } : {}),
    }
  }),
)

export const DOC_PAGES: DocPage[] = FLAT.map((page, at) => {
  const before = FLAT[at - 1]
  const after = FLAT[at + 1]

  return {
    ...page,
    ...(before ? { prev: { title: before.title, path: before.path } } : {}),
    ...(after ? { next: { title: after.title, path: after.path } } : {}),
  }
})

export const DOCS: DocGroup[] = NAV.map((group) => ({
  slug: group.slug,
  title: group.title,
  pages: DOC_PAGES.filter((page) => page.group.slug === group.slug),
}))

export interface DocsHome extends Doc {
  path: string
  file: string
  next?: DocLink
}

const FIRST = DOC_PAGES[0]

export const DOCS_HOME: DocsHome = {
  ...renderDoc(indexText, placeOf(INDEX_FILE, DOCS_PATH, {})),
  path: DOCS_PATH,
  file: INDEX_FILE,
  ...(FIRST ? { next: { title: FIRST.title, path: FIRST.path } } : {}),
}

function broken(): string[] {
  return [DOCS_HOME, ...DOC_PAGES].flatMap((page) =>
    page.targets.flatMap((target) => {
      const to = [DOCS_HOME, ...DOC_PAGES].find((other) => other.path === target.path)

      if (!to) return [`${page.file} links to ${target.path}, which is no docs page`]

      if (target.anchor && !to.ids.includes(target.anchor)) {
        return [`${page.file} links to ${target.path}#${target.anchor}, which has no such heading`]
      }

      return []
    }),
  )
}

function ungated(): string[] {
  return GATE_RULES.flatMap((rule) =>
    make.includes(`| \`${rule.rule}\` |`) ? [] : [`docs/guide/make.md leaves out the ${rule.rule} rule`],
  )
}

const problems = [...broken(), ...ungated()]

if (problems.length > 0) throw new Error(problems.join('\n'))

export function bodyOf(page: DocPage, icons: Icons): string {
  const entry = NAV.find((group) => group.slug === page.group.slug)?.pages.find((one) => one.slug === page.slug)

  if (!entry) throw new Error(`${page.path} is missing from the nav table`)

  return renderDoc(entry.text, placeOf(page.file, page.path, icons)).safeBody
}

export function homeBody(icons: Icons): string {
  return renderDoc(indexText, placeOf(INDEX_FILE, DOCS_PATH, icons)).safeBody
}

export function docAt(group: string, slug: string): DocPage | undefined {
  return DOC_PAGES.find((page) => page.group.slug === group && page.slug === slug)
}

function mentionsOf(page: DocPage, verb: string): number {
  return page.mentions.filter((mention) => mention === verb).length
}

export function guideOf(verb: string): DocPage | undefined {
  return DOC_PAGES.filter((page) => page.group.slug === 'guide').reduce<DocPage | undefined>(
    (best, page) => (mentionsOf(page, verb) > (best ? mentionsOf(best, verb) : 0) ? page : best),
    undefined,
  )
}

function menuOf(group: Group): MenuDocGroup {
  return {
    slug: group.slug,
    title: group.title,
    docs: group.pages.flatMap((entry) =>
      entry.menu ? [{ label: entry.label, path: pathOf(group.slug, entry.slug), ...entry.menu }] : [],
    ),
  }
}

export function menuDocs(): MenuDocs {
  const quick = docAt('guide', 'quickstart')

  if (!quick) throw new Error('docs/guide/quickstart.md is missing from the nav table')

  return {
    quick: { label: quick.label, path: quick.path, lede: quick.description },
    groups: NAV.flatMap((group) => {
      const menu = menuOf(group)

      return menu.docs.length > 0 ? [menu] : []
    }),
  }
}
