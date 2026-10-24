import { escapeHtml } from '@kitajs/html'
import { Check, Copy } from 'lucide'
import { Marked, Renderer, type Token, type Tokens } from 'marked'
import { buttonVariants } from '@/components/ui/button'
import { Icon } from '@/lib/icons'
import { html } from '@/lib/render'

export interface Heading {
  depth: 2 | 3
  id: string
  text: string
}

export interface Target {
  path: string
  anchor?: string
}

export interface Doc {
  title: string
  description: string
  safeLede: string
  safeBody: string
  toc: Heading[]
  ids: string[]
  targets: Target[]
  verbs: string[]
  mentions: string[]
}

export interface Place {
  resolve: (href: string) => string
  verbs: readonly string[]
}

type Alert = Tokens.Blockquote & { alert?: 'note' | 'warning' }

const ALERT = /^\[!(NOTE|TIP|WARNING|CAUTION|IMPORTANT)\]\s*\n?/

const SITE_ORIGIN = 'https://ttheme.dev'

export function slugOf(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
}

export function plainOf(tokens: readonly Token[] | undefined): string {
  return (tokens ?? [])
    .map((token) =>
      'tokens' in token && token.tokens ? plainOf(token.tokens) : 'text' in token ? String(token.text) : '',
    )
    .join('')
}

function copyButton(text: string, label: string): string {
  return html(
    <button
      type="button"
      class={buttonVariants({ variant: 'outline', size: 'icon-sm', class: 'group/copy' })}
      aria-label={label}
      data-copy={text}
      data-copy-hold="1400"
      data-copy-status="copied (・ω・)"
    >
      <Icon node={Copy} class="group-data-copied/copy:hidden" />
      <Icon node={Check} class="hidden group-data-copied/copy:block" />
    </button>,
  )
}

function shell(text: string): string {
  const lines = text.split('\n').map((line) => {
    const at = line.search(/\s#\s/)

    return line.startsWith('#')
      ? { command: '', comment: line }
      : at === -1
        ? { command: line, comment: '' }
        : { command: line.slice(0, at).trimEnd(), comment: line.slice(at).trim() }
  })

  const commands = lines.flatMap((line) => (line.command ? [line.command] : []))

  const rows = lines
    .map((line) => {
      const prompt = line.command ? '<span data-prompt aria-hidden="true">❯ </span>' : ''

      const note = line.comment
        ? `${line.command ? '  ' : ''}<span data-comment>${escapeHtml(line.comment)}</span>`
        : ''

      return `${prompt}${escapeHtml(line.command)}${note}`
    })
    .join('\n')

  const label = commands.length === 1 ? `copy ${commands[0]}` : `copy ${commands.length} commands`

  return `<div data-slot="shell"><pre translate="no"><code>${rows}</code></pre>${copyButton(commands.join('\n'), label)}</div>\n`
}

function file(text: string, title: string): string {
  return `<figure data-slot="file"><figcaption><span translate="no">${escapeHtml(title)}</span>${copyButton(text, `copy ${title}`)}</figcaption><pre translate="no"><code>${escapeHtml(text)}</code></pre></figure>\n`
}

function verbsIn(text: string, known: readonly string[]): string[] {
  return [...text.matchAll(/\bttheme(?:@[\w.]+)? ([a-z]+)\b/g)].flatMap((match) => {
    const verb = match[1] as string

    return known.includes(verb) ? [verb] : []
  })
}

function markdown(doc: Doc, place: Place): Marked {
  const taken = new Map<string, number>()

  return new Marked({
    gfm: true,
    async: false,
    renderer: {
      html({ text }) {
        return escapeHtml(text)
      },
      heading({ tokens, depth }) {
        if (depth === 1) throw new Error(`${doc.title}: a page holds one # heading, its first line`)
        const text = plainOf(tokens)
        const base = slugOf(text) || 'section'
        const seen = taken.get(base) ?? 0
        const id = seen === 0 ? base : `${base}-${seen + 1}`
        taken.set(base, seen + 1)
        doc.ids.push(id)

        if (depth === 2 || depth === 3) doc.toc.push({ depth, id, text })

        return `<h${depth} id="${id}">${this.parser.parseInline(tokens)}</h${depth}>\n`
      },
      code({ text, lang }) {
        const info = lang ?? ''
        const title = /title="([^"]*)"/.exec(info)?.[1]

        if (info.split(/\s+/)[0] === 'sh') return shell(text)

        if (title) return file(text, title)

        return `<pre data-slot="output" translate="no"><code>${escapeHtml(text)}</code></pre>\n`
      },
      blockquote(token) {
        const quote = token as Alert
        const body = this.parser.parse(quote.tokens)

        return quote.alert
          ? `<aside data-slot="callout" data-tone="${quote.alert}"><p data-label>${quote.alert}</p>${body}</aside>\n`
          : `<blockquote>${body}</blockquote>\n`
      },
      table(token) {
        return `<div data-slot="table">${Renderer.prototype.table.call(this, token)}</div>\n`
      },
      link({ href, title, tokens }) {
        const named = title ? ` title="${escapeHtml(title)}"` : ''
        const text = this.parser.parseInline(tokens)
        const local = href.startsWith(`${SITE_ORIGIN}/`) ? href.slice(SITE_ORIGIN.length) : href

        if (/^https?:\/\//.test(local)) {
          return `<a href="${escapeHtml(local)}"${named} target="_blank" rel="noopener">${text}</a>`
        }

        const resolved = local.startsWith('/') ? local : place.resolve(local)
        const [path = '', anchor] = resolved.split('#')

        if (path.startsWith('/docs')) doc.targets.push(anchor ? { path, anchor } : { path })

        return `<a href="${escapeHtml(resolved)}"${named}>${text}</a>`
      },
      image({ text }) {
        throw new Error(`${doc.title}: a docs page holds no image (${text})`)
      },
    },
  })
}

export function renderDoc(source: string, place: Place): Doc {
  const doc: Doc = {
    title: '',
    description: '',
    safeLede: '',
    safeBody: '',
    toc: [],
    ids: [],
    targets: [],
    verbs: [],
    mentions: [],
  }

  const marked = markdown(doc, place)
  const tokens = marked.lexer(source)
  const [first, ...rest] = tokens.filter((token) => token.type !== 'space')

  if (first?.type !== 'heading' || first.depth !== 1) throw new Error('a docs page starts with its # title')
  const [lede, ...body] = rest

  if (lede?.type !== 'paragraph') throw new Error(`${plainOf(first.tokens)}: the title is followed by one paragraph`)
  doc.title = plainOf(first.tokens)
  doc.description = plainOf(lede.tokens).replace(/\s+/g, ' ').trim()
  marked.walkTokens([lede, ...body], (token) => {
    if (token.type === 'codespan' || token.type === 'code') doc.mentions.push(...verbsIn(token.text, place.verbs))

    if (token.type === 'blockquote') {
      const quote = token as Alert
      const found = ALERT.exec(quote.text)

      if (found) {
        quote.alert = found[1] === 'WARNING' || found[1] === 'CAUTION' ? 'warning' : 'note'
        quote.tokens = marked.lexer(quote.text.replace(ALERT, ''))
      }
    }
  })
  doc.safeLede = marked.parseInline(lede.text) as string
  doc.safeBody = marked.parser(body)
  doc.verbs = [...new Set(doc.mentions)]

  return doc
}

const INLINE = new Marked({
  gfm: true,
  async: false,
  renderer: {
    html({ text }) {
      return escapeHtml(text)
    },
  },
})

export function renderInline(text: string): string {
  return INLINE.parseInline(text) as string
}
