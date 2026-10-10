import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import * as p from '@clack/prompts'
import { available, find, gateFailures, readKept, readMarketplaces, untuned, writeKept } from './available.ts'
import { dropImage, imageKey, rackOf, showImage } from './backdrop.ts'
import { Cancelled } from './cancelled.ts'
import { Backdrop } from './editor-backdrop.ts'
import { runEditor } from './editor-screen.ts'
import { writeAtomic } from './edits.ts'
import { findFor } from './find/find.ts'
import { fixGate, type Move } from './fix.ts'
import { type Manifest, type PaletteEntry, paletteEntry, toTheme } from './manifest.ts'
import { ensureLocal } from './marketplaces.ts'
import { colorless } from './osc.ts'
import {
  codeOf,
  colorsOfTheme,
  type Draft,
  draftOf,
  fromCode,
  gateLines,
  localMarketplaces,
  marketplaceFiles,
  ownPath,
  paletteToml,
  readCode,
  readOwnText,
  recolor,
  resign,
  shareCode,
  shareLink,
  withPictures,
} from './own.ts'
import { type Choice, type Edited, type EditorOptions, listOf } from './palette-editor.ts'
import { commit, configHome, type Installed, readInstalled, refreshPictures, sync } from './palettes.ts'
import { PickerLayer } from './picker-art.ts'
import { bringPictures, heldPictures } from './pictures.ts'
import { qrLines } from './qr.ts'
import { type Colors, grow, SEEDS } from './seeds.ts'
import { showsPictures } from './terminal.ts'
import { marketplaceOf, nameProblem, type SharedPicture, shelfOf, type Theme } from './theme.ts'
import { overrideOf, readTone, tonedEntry, withTone, writeTone } from './tone.ts'
import { toneRows } from './tone-view.ts'

function tty(): boolean {
  return process.stdin.isTTY === true && process.stdout.isTTY === true
}

export async function thisTab(): Promise<string | undefined> {
  const worn = process.env.TTHEME_WORN
  if (!worn || !tty()) {
    return undefined
  }
  const yes = await p.confirm({ message: `Use ${worn}, the palette this tab wears?` })
  if (p.isCancel(yes) || !yes) {
    throw new Cancelled()
  }
  return worn
}

export async function shareThisTab(
  tone: 'tuned' | 'original' | undefined,
): Promise<{ name: string; tone?: 'tuned' | 'original' } | undefined> {
  const worn = process.env.TTHEME_WORN
  if (!worn) {
    return undefined
  }
  if (!tty()) {
    console.error(`Sharing ${worn}, the palette this tab wears`)
    return { name: worn, ...(tone ? { tone } : {}) }
  }
  if (tone !== undefined || readTone(configHome())[worn] === undefined) {
    await thisTab()
    return { name: worn, ...(tone ? { tone } : {}) }
  }
  const answer = await p.select({
    message: `Share ${worn}, the palette this tab wears?`,
    options: [
      { value: 'tuned', label: 'Your tone', hint: `named ${tunedName(worn)}` },
      { value: 'original', label: 'The original' },
      { value: 'no', label: 'No' },
    ],
  })
  if (p.isCancel(answer) || answer === 'no') {
    throw new Cancelled()
  }
  return { name: worn, tone: answer as 'tuned' | 'original' }
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

function install(home: string, manifest: Manifest, names: string[]): { state: Installed; fresh: string[] } {
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
  return JSON.stringify([p.background, p.foreground, p.cursor, p.selection, p.ansi])
}

export function adopt(home: string, code: string, manifest: Manifest): PaletteEntry {
  const entry = readCode(code, manifest.palettes)
  const known = untuned(home, manifest, false).palettes.find((e) => e.name === entry.name)
  if (known && wears(known) !== wears(entry)) {
    throw new Error(
      `${entry.name} is already in ${marketplaceOf(entry.name) ?? 'the official marketplace'} and differs — \`ttheme add ${entry.name}\` wears that one`,
    )
  }
  if (!known) {
    writeKept(home, [...readKept(home), entry])
  }
  return entry
}

const SIGNATURE = ['background', 'foreground', 'cursor']

function problemOf(read: () => unknown): string | undefined {
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
  if (!tty()) {
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
  console.log(`\n\`ttheme use ${full}\` wears it · \`ttheme edit ${full}\` opens it again`)
}

function failuresOf(name: string, source: string, manifest: Manifest): string[] {
  const entry = paletteEntry(readOwnText(name, source, manifest.palettes))
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
  if (!tty()) {
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
  const rewrite = ({ colors, signature }: Edited) =>
    withPictures(
      resign(recolor(before, colors), signature),
      shelf.fresh().filter((picture) => !listed.has(imageKey(picture))),
    )
  const edited = await editColors({
    title: 'Edit palette',
    name: full,
    colors: colorsOfTheme(theme),
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
    `Saved ${full}${state.palettes.includes(full) ? ' — new tabs and `ttheme use` wear it' : ` — \`ttheme add ${full}\` installs it`}`,
  )
  const failing = failuresOf(full, after, manifest)
  if (failing.length > 0) {
    console.log(
      `\nIt misses the contrast gate:\n${failing.join('\n')}\n\`ttheme check --fix ${full}\` suggests colors that pass`,
    )
  }
}

const UNCHANGED = 2

export async function runTone(name: string, action: string, width?: string): Promise<number> {
  const home = configHome()
  if (action === 'show') {
    const base = find(untuned(home, readMarketplaces(home), false).palettes, name)
    const worn = tonedEntry(base, readTone(home)[name])
    console.log(toneRows(base, worn, !colorless(), width === undefined ? undefined : Number(width)).join('\n'))
    return 0
  }
  if (action === 'reset') {
    const tone = readTone(home)
    if (tone[name] === undefined) {
      return UNCHANGED
    }
    writeTone(home, withTone(tone, name, {}))
    sync(home, readMarketplaces(home), readInstalled(home))
    process.stderr.write('Back to the original colors')
    return 0
  }
  if (action !== 'edit') {
    throw new Error(`tone takes show, edit or reset, not ${action}`)
  }
  if (!tty()) {
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
  const base = find(untuned(home, readMarketplaces(home), false).palettes, name)
  const worn = tonedEntry(base, readTone(home)[name])
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
  if (JSON.stringify(over) === JSON.stringify(tone[name] ?? {})) {
    return undefined
  }
  writeTone(home, withTone(tone, name, over))
  sync(home, readMarketplaces(home), readInstalled(home))
  return Object.keys(over).length
}

function named(view: Manifest, name: string, home: string): PaletteEntry {
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
    console.log('\nPasses the gate')
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
    const base = find(untuned(home, manifest, false).palettes, entry.name)
    writeTone(home, withTone(readTone(home), entry.name, overrideOf(base, listOf(colorsOfTheme(theme)))))
    sync(home, manifest, state)
    console.log(
      `\nSaved as your tone of ${entry.name} — R then s in \`ttheme edit ${entry.name}\` puts its own colors back`,
    )
    return left.length === 0 ? 0 : 1
  }
  writeAtomic(path, recolor(readFileSync(path, 'utf8'), colorsOfTheme(theme)))
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
    const { background, foreground, cursor, selection, ansi } = fromCode(code)
    return { background, foreground, cursor, selection, ansi }
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
    code: (edited) => shareCode(draftFor(home, paletteEntry(readOwnText(full, text(edited), manifest.palettes)))),
    toml: text,
    command: 'ttheme add',
  }
}

function draftFor(home: string, entry: PaletteEntry): Draft {
  const path = mineAt(home, entry.name)
  const reason =
    path && existsSync(path) ? readOwnText(entry.name, readFileSync(path, 'utf8'), [entry]).waiveReason : undefined
  const held = heldPictures(home, entry.name) ?? entry.pictures
  const { pictures: _, ...draft } = draftOf(entry, entry.name, reason)
  return { ...draft, ...(held ? { pictures: held } : {}) }
}

async function sharing(tuned: PaletteEntry, original: PaletteEntry, asked: 'tuned' | 'original' | undefined) {
  if (tuned === original) {
    return original
  }
  let which = asked
  if (which === undefined) {
    if (!tty()) {
      which = 'tuned'
    } else {
      const answer = await p.select({
        message: `Share ${original.name} as…`,
        options: [
          { value: 'tuned', label: 'Your tone', hint: `named ${tunedName(original.name)}` },
          { value: 'original', label: 'The original' },
        ],
      })
      if (p.isCancel(answer)) {
        throw new Cancelled()
      }
      which = answer as 'tuned' | 'original'
    }
  }
  return which === 'original' ? original : tuned
}

function tunedName(name: string): string {
  return `${name}-tuned`
}

export async function runShare(name: string, tone?: 'tuned' | 'original'): Promise<void> {
  const home = configHome()
  const manifest = readMarketplaces(home)
  const original = named(untuned(home, manifest), name, home)
  const tuned = tonedEntry(original, readTone(home)[original.name])
  const entry = await sharing(tuned, original, tone)
  const draft = draftFor(home, entry)
  const renamed = entry === tuned && tuned !== original
  if (renamed) {
    const problem = nameProblem(tunedName(entry.name))
    if (problem) {
      throw new Error(`${tunedName(entry.name)} ${problem} — share the original, or tune a palette with a shorter name`)
    }
    draft.name = tunedName(entry.name)
  }
  const link = shareLink(shareCode(draft))
  console.log(link)
  if (process.stdout.isTTY) {
    const qr = qrLines(link)
    if (qr) {
      console.log(`\n${qr.join('\n')}`)
    }
    console.error(
      `\nAnyone can open the link${qr ? ' or scan the code' : ''} to see ${draft.name}, and ttheme add <link> installs it${renamed ? `\nIt carries your tone, named ${draft.name} so it does not clash with ${entry.name}` : ''}`,
    )
  }
}
