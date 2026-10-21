import { createHash } from 'node:crypto'
import { basename } from 'node:path'
import { brotliCompressSync, brotliDecompressSync, deflateRawSync, inflateRawSync } from 'node:zlib'
import { boundOf, GATE_RULES, measure, missedRules, shownOf } from './contrast.ts'
import {
  basesOf,
  checked,
  codeBody,
  colorsToml,
  type Draft,
  draftsOf,
  opened,
  paletteToml,
  readOwnText,
  SUM,
  sealed,
  smallest,
  UNPACKED,
} from './draft.ts'
import { type PaletteEntry, paletteEntry, toTheme } from './manifest.ts'
import { memo } from './memo.ts'
import type { Colors } from './seeds.ts'
import { escaped, quoted } from './text.ts'
import { type Catalog, catalogProblem, nameProblem, textProblem } from './theme.ts'

const PACKS: ((bytes: Uint8Array) => Uint8Array)[] = [
  (bytes) => bytes,
  (bytes) => deflateRawSync(bytes, { level: 9 }),
  (bytes) => brotliCompressSync(bytes),
]

const UNPACKS: ((bytes: Uint8Array) => Uint8Array)[] = [
  (bytes) => bytes,
  (bytes) => inflateRawSync(bytes, { maxOutputLength: UNPACKED }),
  (bytes) => brotliDecompressSync(bytes, { maxOutputLength: UNPACKED }),
]

export interface MarketplaceFile {
  path: string
  slug: string
  catalog?: string
}

function byName(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export function marketplaceLayout(
  paths: Iterable<string>,
  at: (path: string) => string,
  catalogs: readonly Catalog[] = [],
): MarketplaceFile[] {
  const shelved: { file: MarketplaceFile; name: string }[] = []
  const loose: { file: MarketplaceFile; name: string }[] = []

  for (const path of paths) {
    const [top, first, second, ...deeper] = path.split('/')

    if (top !== 'palettes' || !first || first.startsWith('.') || deeper.length > 0) {
      continue
    }

    if (second === undefined) {
      if (first.endsWith('.toml')) {
        loose.push({ file: { path: at(path), slug: basename(first, '.toml') }, name: first })
      }
    } else if (second.endsWith('.toml')) {
      shelved.push({ file: { path: at(path), slug: basename(second, '.toml'), catalog: first }, name: second })
    }
  }

  const listed = (catalog = '') => {
    const at = catalogs.findIndex((c) => c.name === catalog)

    return at < 0 ? catalogs.length : at
  }

  shelved.sort(
    (a, b) =>
      listed(a.file.catalog) - listed(b.file.catalog) ||
      byName(a.file.catalog ?? '', b.file.catalog ?? '') ||
      byName(a.name, b.name),
  )
  loose.sort((a, b) => byName(a.name, b.name))

  return [...shelved, ...loose].map(({ file }) => file)
}

function marketplaceFileProblem(file: MarketplaceFile, seen: ReadonlyMap<string, MarketplaceFile>): string | undefined {
  const twin = seen.get(file.slug)

  if (twin) {
    return `${escaped(file.slug)} is also ${twin.catalog ? `in ${escaped(twin.catalog)}` : 'outside a catalog'} — a palette name is used once in a marketplace`
  }

  if (file.catalog === undefined) {
    return undefined
  }

  const problem = textProblem(file.catalog)

  return problem ? `the catalog folder ${quoted(file.catalog)} ${problem}` : undefined
}

export type Report = (where: string, message: string) => void

export function readMarketplaceFiles(
  files: MarketplaceFile[],
  read: (file: MarketplaceFile) => string,
  id: string,
  entries: PaletteEntry[],
  report: Report,
  foreign = false,
  catalogs: readonly Catalog[] = [],
): PaletteEntry[] {
  const seen = new Map<string, MarketplaceFile>()
  const place = JSON.stringify([foreign, catalogs, [...basesOf(entries)]])

  return files.flatMap((file) => {
    try {
      const problem = marketplaceFileProblem(file, seen)

      if (problem) {
        throw new Error(problem)
      }

      seen.set(file.slug, file)
      const shelf = { ...(file.catalog === undefined ? {} : { catalog: file.catalog }), catalogs }
      const name = `${id}/${file.slug}`
      const text = read(file)

      return [
        memo('entry', `${place}${JSON.stringify([name, file.catalog ?? null, text])}`, () =>
          paletteEntry(readOwnText(name, text, entries, foreign, shelf)),
        ),
      ]
    } catch (error) {
      report(file.path, (error as Error).message)

      return []
    }
  })
}

const q = (value: string) => JSON.stringify(value)

function checksum(bytes: Uint8Array): Uint8Array {
  return createHash('sha256').update(bytes).digest().subarray(0, SUM)
}

export function readCodes(code: string, entries: PaletteEntry[]): PaletteEntry[] {
  return fromCode(code).map((draft) => {
    const named = nameProblem(draft.name)

    if (named) {
      throw new Error(`the share code's palette ${quoted(draft.name)} ${named}`)
    }

    const entry = paletteEntry(readOwnText(draft.name, paletteToml(draft), entries, true))

    if (!draft.catalog) {
      return entry
    }

    const problem = catalogProblem(draft.catalog)

    if (problem) {
      throw new Error(`the share code's catalog ${quoted(draft.catalog)} ${problem}`)
    }

    return { ...entry, catalog: draft.catalog }
  })
}

export function shareCode(drafts: readonly Draft[]): string {
  const body = codeBody(drafts)
  const packed = smallest(PACKS.map((pack) => pack(body)))

  return sealed(packed, checksum(packed))
}

export function fromCode(code: string): Draft[] {
  const sealedCode = opened(code)
  const packed = checked(sealedCode, checksum(sealedCode.packed))
  const unpack = UNPACKS[packed[0] as number]

  if (!unpack) {
    throw new Error('the share code is packed in a way this ttheme does not read')
  }

  let body: Uint8Array

  try {
    body = unpack(packed.subarray(1))
  } catch {
    throw new Error('the share code does not unpack — was it copied whole?')
  }

  return draftsOf(body)
}

function sectionOf(text: string, table: string): [number, number] | undefined {
  const head = new RegExp(`^\\[${table.replaceAll('.', '\\.')}\\][ \\t]*$`, 'm').exec(text)

  if (!head) {
    return undefined
  }

  const body = head.index + head[0].length
  const next = /^\[/m.exec(text.slice(body))

  return [head.index, next ? body + next.index : text.length]
}

const joined = (...parts: (string | undefined)[]) =>
  `${parts
    .map((part) => part?.trimEnd())
    .filter((part) => part)
    .join('\n\n')}\n`

export function withTable(text: string, table: string, block: string | undefined, after: string): string {
  const at = sectionOf(text, table)

  if (at) {
    return joined(text.slice(0, at[0]), block, text.slice(at[1]))
  }

  if (block === undefined) {
    return text
  }

  const anchor = sectionOf(text, after)

  if (!anchor) {
    throw new Error(`no [${after}] table to put [${table}] after`)
  }

  return joined(text.slice(0, anchor[1]), block, text.slice(anchor[1]))
}

export function recolor(text: string, colors: Colors, table = 'colors'): string {
  const at = sectionOf(text, table)

  if (!at) {
    throw new Error(`no [${table}] table to rewrite`)
  }

  const section = text.slice(at[0], at[1])
  const start = section.indexOf('ansi = [')
  const end = section.indexOf(']', start)

  if (start < 0 || end < 0) {
    throw new Error(`no ansi = [...] list in [${table}] to rewrite`)
  }

  let index = 0
  const block = section.slice(start, end).replace(/"#[0-9a-fA-F]{6}"/g, () => q(colors.ansi[index++] as string))

  const keys: [string, string][] = [
    ['background', colors.background],
    ['foreground', colors.foreground],
    ['cursor', colors.cursor],
    ['selection_background', colors.selection],
  ]

  const rewritten = keys.reduce(
    (out, [key, color]) =>
      out.replace(new RegExp(`^(${key}\\s*=\\s*)"#[0-9a-fA-F]{6}"`, 'm'), (_, head) => `${head}${q(color)}`),
    section.slice(0, start) + block + section.slice(end),
  )

  return text.slice(0, at[0]) + rewritten + text.slice(at[1])
}

export function withShade(text: string, colors: Colors, table: string): string {
  return sectionOf(text, table)
    ? recolor(text, colors, table)
    : withTable(text, table, colorsToml(colors, table).join('\n'), 'colors')
}

export function resign(text: string, signature: string[]): string {
  return text.replace(/^(signature\s*=\s*)\[[^\]]*\]/m, (_, head) => `${head}[${signature.map(q).join(', ')}]`)
}

export function gateLines(entry: PaletteEntry): string[] {
  const theme = toTheme(entry)
  const values = measure(theme)
  const missed = new Set(missedRules(theme).map((rule) => rule.rule))
  const waived = new Set(entry.waived ?? [])
  const pad = Math.max(...GATE_RULES.map((r) => r.label.length))

  return GATE_RULES.map((rule, i) => {
    const value = values[i] as number
    const ok = waived.has(rule.rule) || Number.isNaN(value) || !missed.has(rule.rule)

    return `  ${ok ? '✓' : '✗'} ${rule.label.padEnd(pad)}  ${shownOf(value).padStart(6)} ${boundOf(rule)}${waived.has(rule.rule) ? '  waived' : ''}`
  })
}
