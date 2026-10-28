import { createHash } from 'node:crypto'
import { basename } from 'node:path'
import { brotliCompressSync, brotliDecompressSync, deflateRawSync, inflateRawSync } from 'node:zlib'
import { readWork, WORKS_DIR, type Work } from './commons.ts'
import { boundOf, GATE_RULES, measure, missedRules, shownOf } from './contrast.ts'
import {
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
import { readSet, SETS_DIR, type SetPalette } from './sets.ts'
import { quoted } from './text.ts'
import { nameProblem, slugOf, slugProblem, themeOf } from './theme.ts'

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

export interface SetFile {
  path: string
  name: string
}

export interface WorkFile {
  path: string
  id: string
}

function byName(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function flatToml(paths: Iterable<string>, folder: string): { path: string; stem: string }[] {
  const found: { path: string; stem: string }[] = []

  for (const path of paths) {
    const [top, file, ...deeper] = path.split('/')

    if (top === folder && file && !file.startsWith('.') && file.endsWith('.toml') && deeper.length === 0) {
      found.push({ path, stem: basename(file, '.toml') })
    }
  }

  return found.sort((a, b) => byName(a.stem, b.stem))
}

export function marketplaceLayout(paths: Iterable<string>, at: (path: string) => string): SetFile[] {
  return flatToml(paths, SETS_DIR).map(({ path, stem }) => ({ path: at(path), name: stem }))
}

export function workLayout(paths: Iterable<string>, at: (path: string) => string): WorkFile[] {
  return flatToml(paths, WORKS_DIR).map(({ path, stem }) => ({ path: at(path), id: stem }))
}

export type Report = (where: string, message: string) => void

interface Shelf {
  entries: PaletteEntry[]
  problems: [string, string][]
}

function shelfOf(path: string, text: string, id: string, foreign: boolean): Shelf {
  let palettes: SetPalette[]

  try {
    palettes = readSet(basename(path), text)
  } catch (error) {
    return { entries: [], problems: [[path, (error as Error).message]] }
  }

  const place = foreign ? { foreign: true as const } : {}
  const shelf: Shelf = { entries: [], problems: [] }

  for (const { slug, doc } of palettes) {
    try {
      shelf.entries.push(paletteEntry(themeOf(slug, doc, { name: `${id}/${slug}`, ...place })))
    } catch (error) {
      shelf.problems.push([path, (error as Error).message])
    }
  }

  return shelf
}

export function readMarketplaceFiles(
  files: SetFile[],
  read: (file: SetFile) => string,
  id: string,
  report: Report,
  foreign = false,
): PaletteEntry[] {
  const seen = new Map<string, string>()

  return files.flatMap((file) => {
    const text = read(file)

    const shelf = memo('set', JSON.stringify([foreign, id, file.path, text]), () =>
      shelfOf(file.path, text, id, foreign),
    )

    for (const [where, message] of shelf.problems) {
      report(where, message)
    }

    return shelf.entries.filter((entry) => {
      const slug = slugOf(entry.name)
      const first = seen.get(slug)

      if (first !== undefined) {
        report(file.path, `${slug} is in ${basename(first)} too — a slug is used once in a marketplace`)

        return false
      }

      seen.set(slug, file.path)

      return true
    })
  })
}

export function readWorkFiles(
  files: WorkFile[],
  read: (file: WorkFile) => string,
  report: Report,
  foreign = false,
): Work[] {
  return files.flatMap((file) => {
    try {
      const text = read(file)

      return [memo('work', JSON.stringify([foreign, file.id, text]), () => readWork(file.path, text, file.id, foreign))]
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

export function readCodes(code: string): PaletteEntry[] {
  return fromCode(code).map((draft) => {
    const named = slugProblem(draft.name) && nameProblem(draft.name)

    if (named) {
      throw new Error(`the share code's palette ${quoted(draft.name)} ${named}`)
    }

    return paletteEntry(readOwnText(draft.name, paletteToml(draft), true))
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
