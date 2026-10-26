import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import * as p from '@clack/prompts'
import { Cancelled } from '../core/cancelled.ts'
import { codeOf, type Draft, draftOf, paletteSlug, paletteToml, readOwnText, withPictures } from '../core/draft.ts'
import { fixGate, type Move } from '../core/fix.ts'
import {
  colorsOfTheme,
  inMode,
  type Manifest,
  otherColors,
  type PaletteEntry,
  paletteEntry,
  toTheme,
} from '../core/manifest.ts'
import { mirror } from '../core/mirror.ts'
import { type Mode, modeOf } from '../core/mode.ts'
import { fromCode, gateLines, readCodes, resign, shareCode, withShade } from '../core/own.ts'
import { type Colors, grow, SEEDS } from '../core/seeds.ts'
import { listOf } from '../core/slots.ts'
import { marketplaceOf, nameProblem, type SharedPicture, shelfOf, type Theme } from '../core/theme.ts'
import { dropImage, imageKey, rackOf, showImage } from '../pictures/backdrop.ts'
import {
  available,
  find,
  gateFailures,
  readKept,
  readMarketplaces,
  shown,
  untuned,
  writeKept,
} from '../store/available.ts'
import { writeAtomic } from '../store/edits.ts'
import { readInstalled } from '../store/installed.ts'
import { localMarketplaces, marketplaceFiles, ownPath } from '../store/local.ts'
import { configHome } from '../store/paths.ts'
import { overrideOf, readTone, tonedEntry, toneOf, withTone, writeTone } from '../store/tone.ts'
import { modeFor } from '../store/wiring.ts'
import { colorless } from '../terminals/osc.ts'
import { showsPictures } from '../terminals/terminal.ts'
import { Backdrop } from '../tui/editor-backdrop.ts'
import { runEditor } from '../tui/editor-screen.ts'
import type { Choice, Edited, EditorOptions } from '../tui/palette-editor.ts'
import { PickerLayer } from '../tui/picker-art.ts'
import { interactive } from '../tui/terminal.ts'
import { toneRows } from '../tui/tone-view.ts'
import { findFor } from './find/find.ts'
import { ensureLocal } from './marketplaces.ts'
import { bringPictures, heldPictures } from './pictures.ts'
import { commit, refreshPictures, sync } from './sync.ts'

export async function thisTab(): Promise<string | undefined> {
  const worn = process.env.TTHEME_WORN

  if (!worn || !interactive()) {
    return undefined
  }

  const yes = await p.confirm({ message: `Use ${worn}, the palette this tab shows?` })

  if (p.isCancel(yes) || !yes) {
    throw new Cancelled()
  }

  return worn
}

function mine(name: string, home: string): string {
  if (name.includes('/')) {
    return name
  }

  const locals = localMarketplaces(home, false)
  const holding = locals.filter((m) => marketplaceFiles(m.dir).some((f) => f.slug === name))
  const [hit] = holding.length === 1 ? holding : locals.length === 1 ? locals : []

  return hit ? `${hit.id}/${name}` : name
}

export function install(home: string, manifest: Manifest, names: string[]) {
  const state = readInstalled(home)
  const fresh = names.filter((n) => !state.palettes.includes(n))

  if (fresh.length > 0) {
    commit(home, manifest, state, { ...state, palettes: [...state.palettes, ...fresh] })
  } else if (names.some((n) => state.palettes.includes(n))) {
    sync(home, manifest, state)
  }

  return { state, fresh }
}

function movesText(moves: Move[]): string[] {
  const pad = Math.max(0, ...moves.map((m) => m.slot.length))

  return moves.map((m) => `  ${m.slot.padEnd(pad)}  ${m.from} → ${m.to}  ${m.rule}`)
}

function wears(p: PaletteEntry): string {
  return JSON.stringify([p.background, p.foreground, p.cursor, p.selection, p.ansi, otherColors(p)])
}

export interface Refused {
  name: string
  why: string
}

interface Adopted {
  entries: PaletteEntry[]
  refused: Refused[]
}

export function adopt(home: string, code: string, manifest: Manifest): Adopted {
  const known = new Map(untuned(home, manifest, false).palettes.map((e) => [e.name, e]))
  const entries: PaletteEntry[] = []
  const refused: Refused[] = []

  for (const entry of readCodes(code, manifest.palettes)) {
    const twin = known.get(entry.name)

    if (twin && wears(twin) !== wears(entry)) {
      refused.push({
        name: entry.name,
        why: `is already in ${marketplaceOf(entry.name) ?? 'the official marketplace'} and differs — \`ttheme add ${entry.name}\` installs that one`,
      })
    } else {
      entries.push(entry)
    }
  }

  const fresh = entries.filter((e) => !known.has(e.name))

  if (fresh.length > 0) {
    writeKept(home, [...readKept(home), ...fresh])
  }

  return { entries, refused }
}

export function isPaletteFile(arg: string): boolean {
  return /\.toml$/i.test(arg.trim())
}

export async function takeFile(
  home: string,
  file: string,
  manifest: Manifest,
  into: string | undefined,
): Promise<string> {
  const path = file.startsWith('~/') ? join(homedir(), file.slice(2)) : resolve(file)
  let text: string

  try {
    text = readFileSync(path, 'utf8')
  } catch {
    throw new Error(`${file} cannot be read`)
  }

  const slug = paletteSlug(file, text)
  const marketplace = await ensureLocal(home, into)
  const full = `${marketplace.id}/${slug}`
  const problem = nameProblem(full)

  if (problem) {
    throw new Error(`${full} ${problem}`)
  }

  try {
    readOwnText(full, text, manifest.palettes)
  } catch (error) {
    throw new Error(`${file} cannot be added — ${(error as Error).message}`)
  }

  const target = ownPath(home, full)

  if (existsSync(target) && readFileSync(target, 'utf8') !== text) {
    if (!interactive()) {
      throw new Error(
        `${full} already exists — run this in a terminal to replace it, or \`ttheme edit ${full}\` changes it`,
      )
    }

    const replace = await p.confirm({
      message: `${full} already exists — replace it with ${basename(path)}?`,
      initialValue: false,
    })

    if (p.isCancel(replace) || !replace) {
      throw new Cancelled()
    }
  }

  writeAtomic(target, text)

  return full
}

const SIGNATURE = ['background', 'foreground', 'cursor']

function problemOf(read: () => void): string | undefined {
  try {
    read()

    return undefined
  } catch (error) {
    return (error as Error).message
  }
}

function choicesOf(home: string, manifest: Manifest, except: string): Choice[] {
  return available(home, manifest, false)
    .palettes.filter((e) => e.name !== except)
    .map((e) => ({
      name: e.name,
      colors: {
        background: e.background,
        foreground: e.foreground,
        cursor: e.cursor,
        selection: e.selection,
        ansi: e.ansi,
      },
    }))
}

interface Shelf {
  count: () => number
  added: () => number
  fresh: () => SharedPicture[]
  discard: () => void
}

function shelfFor(home: string, name: string): Shelf {
  const before = new Set(rackOf(home, name).map((picture) => picture.key))

  return {
    count: () => rackOf(home, name).length,
    added: () => rackOf(home, name).filter((picture) => !before.has(picture.key)).length,
    fresh: () => (heldPictures(home, name) ?? []).filter((picture) => !before.has(imageKey(picture))),
    discard: () => {
      const gone = rackOf(home, name).filter((picture) => !before.has(picture.key))

      for (const picture of gone) {
        showImage(home, name, picture.key)
        dropImage(home, name)
      }

      if (gone.length > 0) {
        refreshPictures(home)
      }
    },
  }
}

function merged(...lists: (readonly SharedPicture[] | undefined)[]): SharedPicture[] | undefined {
  const seen = new Map(lists.flatMap((list) => list ?? []).map((picture) => [imageKey(picture), picture]))

  return seen.size > 0 ? [...seen.values()] : undefined
}

function finder(
  home: string,
  name: string,
  manifest: Manifest,
  text: (edited: Edited) => string,
): EditorOptions['find'] {
  if (!showsPictures(process.env, readInstalled(home).terminals)) {
    return undefined
  }

  return async (edited, start) => {
    const entry = paletteEntry(readOwnText(name, text(edited), manifest.palettes))
    const { saved } = await findFor(home, entry, start)

    return { ...(saved ? { note: saved } : {}), count: rackOf(home, name).length }
  }
}

async function editColors(options: EditorOptions, hosted = false): Promise<Edited | undefined> {
  const tty = process.stdout.isTTY === true
  const home = configHome()
  const terminals = readInstalled(home).terminals
  const backdrop = tty ? Backdrop.of(process.env, home, options.name, terminals) : undefined
  const layer = tty ? PickerLayer.of(process.env, terminals) : undefined

  return runEditor(options, {
    color: !colorless(),
    ...(backdrop ? { backdrop } : {}),
    ...(layer ? { layer } : {}),
    ...(hosted ? { hosted: true as const } : {}),
  })
}

export async function runNew(name: string, from: string | undefined, into: string | undefined): Promise<void> {
  const home = configHome()
  const manifest = readMarketplaces(home)
  const marketplace = await ensureLocal(home, into)
  const full = name.includes('/') ? name : `${marketplace.id}/${name}`
  const problem = nameProblem(full)

  if (problem) {
    throw new Error(`${full} ${problem}`)
  }

  if (marketplaceOf(full) !== marketplace.id) {
    throw new Error(`palettes in ${marketplace.dir} are named ${marketplace.id}/<palette> — ${full} belongs elsewhere`)
  }

  const path = ownPath(home, full)

  if (existsSync(path)) {
    throw new Error(`${full} already exists — \`ttheme edit ${full}\` changes it`)
  }

  const source = from ? find(available(home, manifest).palettes, from) : undefined

  if (!interactive()) {
    throw new Error('new opens the palette editor — run it in a terminal')
  }

  const base = source && (marketplaceOf(source.name) ? source.base : source.default ? undefined : source.name)
  const kept = source ? draftOf(source, full, `kept from ${source.name}`) : undefined
  const held = source ? (heldPictures(home, source.name) ?? source.pictures) : undefined
  const { base: _, ansiSource: __, ...rest } = kept ?? { name: full, signature: SIGNATURE, ...grow(SEEDS) }
  const shelf = shelfFor(home, full)

  const toml = ({ colors, signature }: Edited) => {
    const pictures = merged(held, shelf.fresh())

    return paletteToml({ ...rest, ...colors, signature, ...(base ? { base } : {}), ...(pictures ? { pictures } : {}) })
  }

  const edited = await editColors({
    title: 'New palette',
    name: full,
    ...(kept ? { colors: kept } : {}),
    signature: rest.signature,
    ...(rest.waive ? { waive: rest.waive } : {}),
    palettes: choicesOf(home, manifest, full),
    pictures: shelf.count(),
    find: finder(home, full, manifest, toml),
    exports: exportsFor(home, full, manifest, toml),
    decode: decoded,
    check: (e) => problemOf(() => readOwnText(full, toml(e), manifest.palettes)),
  })

  if (!edited) {
    shelf.discard()
    console.log('Nothing made')

    return
  }

  mkdirSync(dirname(path), { recursive: true })
  writeAtomic(path, toml(edited))
  const { state: now } = install(home, manifest, [full])
  console.log(`  + ${full}${source ? `  from ${source.name}` : ''}\n    ${path}`)
  await bringPictures(
    home,
    available(home, manifest).palettes.filter((e) => e.name === full),
    now.terminals,
  )
  console.log(`\n\`ttheme use ${full}\` uses it   \`ttheme edit ${full}\` opens it again`)
}

function failuresOf(name: string, source: string, manifest: Manifest, mode: Mode): string[] {
  const entry = inMode(paletteEntry(readOwnText(name, source, manifest.palettes)), mode)

  return gateFailures(entry).length > 0 ? gateLines(entry).filter((l) => l.startsWith('  ✗')) : []
}

export async function runEdit(name: string): Promise<void> {
  const home = configHome()
  const manifest = readMarketplaces(home)
  const state = readInstalled(home)
  const view = available(home, manifest, false)
  const own = mine(name, home)
  const ownFile = mineAt(home, own)
  const full = ownFile && existsSync(ownFile) ? own : view.palettes.some((e) => e.name === name) ? name : own
  const path = mineAt(home, full)
  const theirs = !path || !existsSync(path)

  if (theirs && !view.palettes.some((e) => e.name === full)) {
    throw new Error(`no palette called ${full} — \`ttheme new\` makes one`)
  }

  if (!interactive()) {
    throw new Error('edit opens the palette editor — run it in a terminal')
  }

  if (theirs) {
    const count = await editTone(home, full, false)
    console.log(
      count === undefined
        ? 'Nothing changed'
        : count === 0
          ? `${full} is back to its own colors`
          : `Saved ${full} · ${tunedText(count)} — R then s in \`ttheme edit ${full}\` puts its own colors back`,
    )

    return
  }

  const before = readFileSync(path, 'utf8')
  let theme: Theme

  try {
    theme = readOwnText(full, before, manifest.palettes)
  } catch (error) {
    throw new Error(`${path} cannot be read — ${(error as Error).message}`)
  }

  const shelf = shelfFor(home, full)
  const listed = new Set((theme.pictures ?? []).map((picture) => imageKey(picture)))
  const mode = modeFor(home)
  const table = mode === modeOf(theme) ? 'colors' : `colors.${mode}`
  const shade = table === 'colors' ? theme : (theme.other ?? mirror(theme))

  const rewrite = ({ colors, signature }: Edited) =>
    withPictures(
      resign(withShade(before, colors, table), signature),
      shelf.fresh().filter((picture) => !listed.has(imageKey(picture))),
    )

  const edited = await editColors({
    title: 'Edit palette',
    name: full,
    colors: colorsOfTheme(shade),
    signature: theme.signatureSlots,
    waive: theme.waive,
    palettes: choicesOf(home, manifest, full),
    pictures: shelf.count(),
    find: finder(home, full, manifest, rewrite),
    exports: exportsFor(home, full, manifest, rewrite),
    decode: decoded,
    check: (e) => problemOf(() => readOwnText(full, rewrite(e), manifest.palettes)),
  })

  if (!edited) {
    shelf.discard()
    console.log('Nothing changed')

    return
  }

  const after = rewrite(edited)

  if (after === before) {
    console.log(shelf.added() > 0 ? `Kept the pictures you added to ${full}` : 'Nothing changed')

    return
  }

  writeAtomic(path, after)

  if (state.palettes.includes(full)) {
    sync(home, manifest, state)
  }

  console.log(
    `Saved ${full}${state.palettes.includes(full) ? ' — new tabs and `ttheme use` use it' : ` — \`ttheme add ${full}\` installs it`}`,
  )
  const failing = failuresOf(full, after, manifest, mode)

  if (failing.length > 0) {
    console.log(
      `\nIt fails these contrast checks:\n${failing.join('\n')}\n\`ttheme check --fix ${full}\` suggests colors that pass`,
    )
  }
}

const UNCHANGED = 2

export async function runTone(name: string, action: string, width?: string): Promise<number> {
  const home = configHome()

  if (action === 'show') {
    const base = find(shown(home, readMarketplaces(home), false).palettes, name)
    const worn = tonedEntry(base, toneOf(readTone(home), base))
    console.log(toneRows(base, worn, !colorless(), width === undefined ? undefined : Number(width)).join('\n'))

    return 0
  }

  if (action === 'reset') {
    const tone = readTone(home)
    const base = find(shown(home, readMarketplaces(home), false).palettes, name)

    if (toneOf(tone, base) === undefined) {
      return UNCHANGED
    }

    writeTone(home, withTone(tone, name, modeOf(base), {}))
    sync(home, readMarketplaces(home), readInstalled(home))
    process.stderr.write('Back to the original colors')

    return 0
  }

  if (action !== 'edit') {
    throw new Error(`tone takes show, edit or reset, not ${action}`)
  }

  if (!interactive()) {
    throw new Error('needs a terminal')
  }

  const count = await editTone(home, name, true)

  if (count === undefined) {
    return UNCHANGED
  }

  process.stderr.write(count === 0 ? 'Back to the original colors' : `Saved · ${tunedText(count)}`)

  return 0
}

function tunedText(count: number): string {
  return `${count} ${count === 1 ? 'color' : 'colors'} tuned`
}

async function editTone(home: string, name: string, hosted: boolean): Promise<number | undefined> {
  const base = find(shown(home, readMarketplaces(home), false).palettes, name)
  const worn = tonedEntry(base, toneOf(readTone(home), base))

  const edited = await editColors(
    {
      title: 'Edit palette',
      name,
      colors: colorsOfTheme(toTheme(worn)),
      original: colorsOfTheme(toTheme(base)),
      tone: true,
      signature: worn.signatureSlots,
      ...(worn.waived ? { waive: worn.waived } : {}),
      decode: decoded,
      check: () => undefined,
    },
    hosted,
  )

  if (!edited) {
    return undefined
  }

  const tone = readTone(home)
  const over = overrideOf(base, listOf(edited.colors))

  if (JSON.stringify(over) === JSON.stringify(toneOf(tone, base) ?? {})) {
    return undefined
  }

  writeTone(home, withTone(tone, name, modeOf(base), over))
  sync(home, readMarketplaces(home), readInstalled(home))

  return Object.keys(over).length
}

export function named(view: Manifest, name: string, home: string): PaletteEntry {
  return find(view.palettes, view.palettes.some((e) => e.name === name) ? name : mine(name, home))
}

export function runCheck(name: string, fix = false): number {
  const home = configHome()
  const manifest = readMarketplaces(home)
  const state = readInstalled(home)
  const entry = named(available(home, manifest), name, home)
  console.log(`${entry.name} · ${shelfOf(entry)}\n`)
  console.log(gateLines(entry).join('\n'))
  const failures = gateFailures(entry)

  if (failures.length === 0) {
    console.log('\nPasses every contrast check')

    return 0
  }

  const { theme, moves, left } = fixGate(toTheme(entry))

  if (moves.length === 0) {
    console.log('\nNo color change fixes it — waive the rule in [contrast] with a reason, or pick other colors')

    return 1
  }

  console.log(
    `\n${left.length === 0 ? 'These colors pass' : 'These colors come closer'}:\n${movesText(moves).join('\n')}`,
  )
  const path = mineAt(home, entry.name)
  const theirs = !path || !existsSync(path)

  if (!fix) {
    console.log(`\n\`ttheme check --fix ${entry.name}\` writes them${theirs ? ' as your tone of it' : ''}`)

    return 1
  }

  if (theirs) {
    const base = find(shown(home, manifest, false).palettes, entry.name)
    writeTone(home, withTone(readTone(home), entry.name, modeOf(base), overrideOf(base, listOf(colorsOfTheme(theme)))))
    sync(home, manifest, state)
    console.log(
      `\nSaved as your tuning of ${entry.name} — R then s in \`ttheme edit ${entry.name}\` puts its own colors back`,
    )

    return left.length === 0 ? 0 : 1
  }

  const made = modeOf(find(untuned(home, manifest, false).palettes, entry.name))
  const table = modeOf(entry) === made ? 'colors' : `colors.${modeOf(entry)}`
  writeAtomic(path, withShade(readFileSync(path, 'utf8'), colorsOfTheme(theme), table))

  if (state.palettes.includes(entry.name)) {
    sync(home, manifest, state)
  }

  console.log(`\nWrote ${path}`)

  return left.length === 0 ? 0 : 1
}

function mineAt(home: string, name: string): string | undefined {
  const marketplace = marketplaceOf(name)

  return marketplace && localMarketplaces(home, false).some((m) => m.id === marketplace)
    ? ownPath(home, name)
    : undefined
}

function decoded(text: string): Colors | undefined {
  const code = codeOf(text)

  if (!code) {
    return undefined
  }

  try {
    const [first] = fromCode(code)

    return (
      first && {
        background: first.background,
        foreground: first.foreground,
        cursor: first.cursor,
        selection: first.selection,
        ansi: first.ansi,
      }
    )
  } catch {
    return undefined
  }
}

function exportsFor(
  home: string,
  full: string,
  manifest: Manifest,
  text: (edited: Edited) => string,
): EditorOptions['exports'] {
  return {
    code: (edited) => shareCode([draftFor(home, paletteEntry(readOwnText(full, text(edited), manifest.palettes)))]),
    toml: text,
    command: 'ttheme add',
  }
}

export function draftFor(home: string, entry: PaletteEntry): Draft {
  const path = mineAt(home, entry.name)

  const reason =
    path && existsSync(path) ? readOwnText(entry.name, readFileSync(path, 'utf8'), [entry]).waiveReason : undefined

  const held = heldPictures(home, entry.name) ?? entry.pictures
  const { pictures: _, ...draft } = draftOf(entry, entry.name, reason)

  return { ...draft, ...(held ? { pictures: held } : {}) }
}
