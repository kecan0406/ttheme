import { quoted } from './text.ts'
import { fail, oddKeys, paletteOddKeys, slugProblem, toml } from './theme.ts'

export const SETS_DIR = 'sets'
export const SET_SCHEMA_URL = 'https://www.schemastore.org/ttheme-set.json'
export const SET_KEYS = ['$schema', 'palette']

const ORIGINAL = 'original'
const HEAD = /^[ \t]*\[\[[ \t]*palette[ \t]*\]\][ \t]*(?:#.*)?$/gm
const SLUG_LINE = /^[ \t]*(?:slug|"slug"|'slug')[ \t]*=.*(?:\n|$)/m
const NESTED = /^([ \t]*\[\[?)[ \t]*palette[ \t]*\./gm
const TABLE = /^([ \t]*\[\[?)/gm

export interface SetPalette {
  slug: string
  doc: Record<string, unknown>
}

export interface Block {
  slug: string
  text: string
}

export interface Blocks {
  head: string
  blocks: Block[]
}

export function setNameOf(subject: string | undefined): string {
  return subject ? (subject.split('/')[0] as string) : ORIGINAL
}

export function setNameFor(text: string): string {
  const { subject } = toml('palette', text)

  return setNameOf(typeof subject === 'string' ? subject : undefined)
}

function tableOf(file: string, raw: unknown, at: number): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    fail(file, `palette[${at}] must be a [[palette]] table`)
  }

  return raw as Record<string, unknown>
}

export function readSet(file: string, source: string): SetPalette[] {
  const { palette } = toml(file, source)

  if (!Array.isArray(palette) || palette.length === 0) {
    fail(file, 'holds no palette — each one is a [[palette]] table')
  }

  const seen = new Set<string>()

  return palette.map((raw, at) => {
    const doc = tableOf(file, raw, at)
    const { slug } = doc

    if (typeof slug !== 'string') {
      fail(file, `palette[${at}] needs a slug, its name in the marketplace`)
    }

    const problem = slugProblem(slug)

    if (problem) {
      fail(file, `the slug ${quoted(slug)} ${problem}`)
    }

    if (seen.has(slug)) {
      fail(file, `holds ${slug} twice — a slug is used once in a marketplace`)
    }

    seen.add(slug)

    return { slug, doc }
  })
}

export function unknownKeys(file: string, source: string): string[] {
  return [
    ...oddKeys('', toml(file, source), SET_KEYS),
    ...readSet(file, source).flatMap(({ slug, doc }) => paletteOddKeys(doc).map((key) => `${slug}.${key}`)),
  ]
}

function unblocked(block: string): string {
  const newline = block.indexOf('\n')
  const body = newline < 0 ? '' : block.slice(newline + 1)

  return `${body.replace(SLUG_LINE, '').replace(NESTED, '$1').trim()}\n`
}

function blocked({ slug, text }: Block): string {
  return `[[palette]]\nslug = ${JSON.stringify(slug)}\n${text.trim().replace(TABLE, '$1palette.')}`
}

export function setBlocks(file: string, source: string): Blocks {
  const slugs = readSet(file, source).map((p) => p.slug)
  const starts = [...source.matchAll(HEAD)].map((m) => m.index)

  if (starts.length !== slugs.length) {
    fail(file, 'writes a palette in a way ttheme cannot change in place — write each one as its own [[palette]] table')
  }

  return {
    head: source.slice(0, starts[0]),
    blocks: starts.map((start, i) => ({
      slug: slugs[i] as string,
      text: unblocked(source.slice(start, starts[i + 1] ?? source.length)),
    })),
  }
}

export function setText(blocks: readonly Block[], head = `"$schema" = ${JSON.stringify(SET_SCHEMA_URL)}`): string {
  return `${[head.trim(), ...blocks.map(blocked)].filter((part) => part !== '').join('\n\n')}\n`
}

export function withPalette(
  file: string,
  source: string | undefined,
  slug: string,
  text: string | undefined,
): string | undefined {
  const { head, blocks } = source === undefined ? { head: undefined, blocks: [] } : setBlocks(file, source)
  const others = blocks.filter((b) => b.slug !== slug)

  const next =
    text === undefined
      ? others
      : blocks.some((b) => b.slug === slug)
        ? blocks.map((b) => (b.slug === slug ? { slug, text } : b))
        : [...blocks, { slug, text }]

  return next.length === 0 ? undefined : setText(next, head)
}
