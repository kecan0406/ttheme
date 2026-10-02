import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import * as p from '@clack/prompts'
import { dropImage, imageKey, rackOf, showImage } from './backdrop.ts'
import { Cancelled } from './cancelled.ts'
import { available, find, gateFailures, readCatalog, readKept, untuned, writeKept } from './catalog.ts'
import { runEditor } from './editor-screen.ts'
import { writeAtomic } from './edits.ts'
import { findFor } from './find/find.ts'
import { fixGate, type Move } from './fix.ts'
import { liveOf } from './live.ts'
import { type Manifest, type PaletteEntry, paletteEntry, toTheme } from './manifest.ts'
import { ensureLocal } from './markets.ts'
import { colorless } from './osc.ts'
import {
  CODE,
  colorsOfTheme,
  type Draft,
  draftOf,
  fromCode,
  gateLines,
  localMarkets,
  marketFiles,
  ownPath,
  paletteToml,
  readOwnText,
  recolor,
  resign,
  shareCode,
  withPictures,
} from './own.ts'
import type { Choice, Edited, EditorOptions } from './palette-editor.ts'
import { commit, configHome, type Installed, readInstalled, refreshPictures, sync } from './palettes.ts'
import { bringPictures, heldPictures } from './pictures.ts'
import { grow, SEEDS } from './seeds.ts'
import { showsPictures } from './terminal.ts'
import { marketOf, nameProblem, type SharedPicture, type Theme } from './theme.ts'
import { readTone, tonedEntry } from './tone.ts'

function tty(): boolean {
  return process.stdin.isTTY === true && process.stdout.isTTY === true
}

function mine(name: string, home: string): string {
  if (name.includes('/')) {
    return name
  }
  const locals = localMarkets(home, false)
  const holding = locals.filter((m) => marketFiles(m.dir).some((f) => f.slug === name))
  const [hit] = holding.length === 1 ? holding : locals.length === 1 ? locals : []
  return hit ? `${hit.id}/${name}` : name
}

function install(home: string, catalog: Manifest, names: string[]): { state: Installed; fresh: string[] } {
  const state = readInstalled(home)
  const fresh = names.filter((n) => !state.palettes.includes(n))
  if (fresh.length > 0) {
    commit(home, catalog, state, { ...state, palettes: [...state.palettes, ...fresh] })
  } else if (names.some((n) => state.palettes.includes(n))) {
    sync(home, catalog, state)
  }
  return { state, fresh }
}

function movesText(moves: Move[]): string[] {
  const pad = Math.max(0, ...moves.map((m) => m.slot.length))
  return moves.map((m) => `  ${m.slot.padEnd(pad)}  ${m.from} → ${m.to}  ${m.rule}`)
}

export function adopt(home: string, code: string, catalog: Manifest): string {
  const draft = fromCode(code)
  const entry = paletteEntry(readOwnText(draft.name, paletteToml(draft), catalog.palettes))
  const known = available(home, catalog, false).palettes.find((e) => e.name === entry.name)
  if (known && JSON.stringify(known) !== JSON.stringify(entry)) {
    throw new Error(
      `${entry.name} is already in ${marketOf(entry.name) ?? 'the ttheme catalog'} and differs — \`ttheme add ${entry.name}\` wears that one`,
    )
  }
  if (!known) {
    writeKept(home, [...readKept(home), entry])
  }
  return entry.name
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

function choicesOf(home: string, catalog: Manifest, except: string): Choice[] {
  return available(home, catalog, false)
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
  const seen = new Map<string, SharedPicture>()
  for (const picture of lists.flatMap((list) => list ?? [])) {
    seen.set(imageKey(picture), picture)
  }
  return seen.size > 0 ? [...seen.values()] : undefined
}

function finder(
  home: string,
  name: string,
  catalog: Manifest,
  text: (edited: Edited) => string,
): EditorOptions['find'] {
  if (!showsPictures(process.env, readInstalled(home).terminals)) {
    return undefined
  }
  return async (edited, start) => {
    const entry = paletteEntry(readOwnText(name, text(edited), catalog.palettes))
    const { saved } = await findFor(home, entry, start)
    return { ...(saved ? { note: saved } : {}), count: rackOf(home, name).length }
  }
}

async function editColors(options: EditorOptions): Promise<Edited | undefined> {
  const tty = process.stdout.isTTY === true
  const live = liveOf(process.env, tty, configHome())
  const saved = live ? await live.saved() : new Map<string, string>()
  const screen = live?.look
    ? { look: (shown: readonly string[]) => live.look?.(options.name, shown) }
    : live
      ? { only: live.slots }
      : {}
  try {
    return await runEditor(options, { color: !colorless(), ...screen })
  } finally {
    if (live) {
      process.stdout.write(live.restore(saved))
    }
  }
}

export async function runNew(name: string, from: string | undefined, into: string | undefined): Promise<void> {
  const home = configHome()
  const catalog = readCatalog(home)
  const market = await ensureLocal(home, into)
  const full = name.includes('/') ? name : `${market.id}/${name}`
  const problem = nameProblem(full)
  if (problem) {
    throw new Error(`${full} ${problem}`)
  }
  if (marketOf(full) !== market.id) {
    throw new Error(`palettes in ${market.dir} are named ${market.id}/<palette> — ${full} belongs elsewhere`)
  }
  const path = ownPath(home, full)
  if (existsSync(path)) {
    throw new Error(`${full} already exists — \`ttheme edit ${full}\` changes it`)
  }
  const source = from ? find(available(home, catalog).palettes, from) : undefined
  if (!tty()) {
    throw new Error('new opens the palette editor — run it in a terminal')
  }
  const base = source && (marketOf(source.name) ? source.base : source.default ? undefined : source.name)
  const kept = source ? draftOf(source, full, `kept from ${source.name}`) : undefined
  const held = source ? (heldPictures(home, source.name) ?? source.pictures) : undefined
  const { base: _, ansiSource: __, group: ___, ...rest } = kept ?? { name: full, signature: SIGNATURE, ...grow(SEEDS) }
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
    palettes: choicesOf(home, catalog, full),
    pictures: shelf.count(),
    find: finder(home, full, catalog, toml),
    check: (e) => problemOf(() => readOwnText(full, toml(e), catalog.palettes)),
  })
  if (!edited) {
    shelf.discard()
    console.log('Nothing made')
    return
  }
  mkdirSync(dirname(path), { recursive: true })
  writeAtomic(path, toml(edited))
  const { state: now } = install(home, catalog, [full])
  console.log(`  + ${full}${source ? `  from ${source.name}` : ''}\n    ${path}`)
  await bringPictures(
    home,
    available(home, catalog).palettes.filter((e) => e.name === full),
    now.terminals,
  )
  console.log(`\n\`ttheme use ${full}\` wears it · \`ttheme edit ${full}\` opens it again`)
}

function failuresOf(name: string, source: string, catalog: Manifest): string[] {
  const entry = paletteEntry(readOwnText(name, source, catalog.palettes))
  return gateFailures(entry).length > 0 ? gateLines(entry).filter((l) => l.startsWith('  ✗')) : []
}

export async function runEdit(name: string): Promise<void> {
  const home = configHome()
  const catalog = readCatalog(home)
  const state = readInstalled(home)
  const view = available(home, catalog, false)
  const own = mine(name, home)
  const ownFile = mineAt(home, own)
  const full = ownFile && existsSync(ownFile) ? own : view.palettes.some((e) => e.name === name) ? name : own
  const path = mineAt(home, full)
  if (!path || !existsSync(path)) {
    const known = view.palettes.some((e) => e.name === full)
    throw new Error(
      known
        ? `${full} is not one of yours — \`ttheme new <name> --from ${full}\` makes your own copy`
        : `no palette of yours called ${full} — \`ttheme new\` makes one`,
    )
  }
  if (!tty()) {
    throw new Error('edit opens the palette editor — run it in a terminal')
  }
  const before = readFileSync(path, 'utf8')
  let theme: Theme
  try {
    theme = readOwnText(full, before, catalog.palettes)
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
    palettes: choicesOf(home, catalog, full),
    pictures: shelf.count(),
    find: finder(home, full, catalog, rewrite),
    check: (e) => problemOf(() => readOwnText(full, rewrite(e), catalog.palettes)),
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
    sync(home, catalog, state)
  }
  console.log(
    `Saved ${full}${state.palettes.includes(full) ? ' — new tabs and `ttheme use` wear it' : ` — \`ttheme add ${full}\` installs it`}`,
  )
  const failing = failuresOf(full, after, catalog)
  if (failing.length > 0) {
    console.log(
      `\nIt misses the contrast gate:\n${failing.join('\n')}\n\`ttheme check --fix ${full}\` suggests colors that pass`,
    )
  }
}

function named(view: Manifest, name: string, home: string): PaletteEntry {
  return find(view.palettes, view.palettes.some((e) => e.name === name) ? name : mine(name, home))
}

export function runCheck(name: string, fix = false): number {
  const home = configHome()
  const catalog = readCatalog(home)
  const state = readInstalled(home)
  const entry = named(available(home, catalog), name, home)
  console.log(`${entry.name} · ${entry.group}\n`)
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
  if (!path || !existsSync(path)) {
    console.log(`\n\`ttheme new <name> --from ${entry.name}\` makes a copy you can fix`)
    return 1
  }
  if (!fix) {
    console.log(`\n\`ttheme check --fix ${entry.name}\` writes them`)
    return 1
  }
  writeAtomic(path, recolor(readFileSync(path, 'utf8'), colorsOfTheme(theme)))
  if (state.palettes.includes(entry.name)) {
    sync(home, catalog, state)
  }
  console.log(`\nWrote ${path}`)
  return left.length === 0 ? 0 : 1
}

function mineAt(home: string, name: string): string | undefined {
  const market = marketOf(name)
  return market && localMarkets(home, false).some((m) => m.id === market) ? ownPath(home, name) : undefined
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
  const catalog = readCatalog(home)
  const original = named(untuned(home, catalog), name, home)
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
  console.log(shareCode(draft))
  if (process.stdout.isTTY) {
    console.error(
      `\nAnyone with ttheme wears it with: ttheme add ${CODE}…${renamed ? `\nIt carries your tone, named ${draft.name} so it does not clash with ${entry.name}` : ''}`,
    )
  }
}
