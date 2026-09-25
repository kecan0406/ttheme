import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import * as p from '@clack/prompts'
import { rackOf } from './backdrop.ts'
import { available, find, gateFailures, readCatalog, readKept, writeKept } from './catalog.ts'
import { writeAtomic } from './edits.ts'
import { type Manifest, type PaletteEntry, paletteEntry, toTheme } from './emit/manifest.ts'
import { fixGate, type Move } from './fix.ts'
import { ensureLocal } from './markets.ts'
import {
  CODE,
  type Draft,
  draftOf,
  fromCode,
  gateLines,
  localMarkets,
  ownPath,
  paletteToml,
  readOwnText,
  recolor,
  shareCode,
} from './own.ts'
import { commit, configHome, type Installed, readInstalled, startupPalette, sync } from './palettes.ts'
import { bringPictures, heldPictures, since } from './pictures.ts'
import { nameProblem, ownerOf } from './theme.ts'

function tty(): boolean {
  return process.stdin.isTTY === true && process.stdout.isTTY === true
}

function mine(name: string, home: string): string {
  if (name.includes('@')) {
    return name
  }
  const [only, ...more] = localMarkets(home, false)
  return only && more.length === 0 ? `${name}@${only.owner}` : name
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
      `${entry.name} is already in ${ownerOf(entry.name) ?? 'the ttheme catalog'} and differs — \`ttheme add ${entry.name}\` wears that one`,
    )
  }
  if (!known) {
    writeKept(home, [...readKept(home), entry])
  }
  return entry.name
}

export async function runNew(name: string, from: string | undefined, into: string | undefined): Promise<void> {
  const home = configHome()
  const catalog = readCatalog(home)
  const state = readInstalled(home)
  const market = await ensureLocal(home, into)
  const full = name.includes('@') ? name : `${name}@${market.owner}`
  const problem = nameProblem(full)
  if (problem) {
    throw new Error(`${full} ${problem}`)
  }
  if (ownerOf(full) !== market.owner) {
    throw new Error(`palettes in ${market.dir} are named <palette>@${market.owner} — ${full} is someone else's`)
  }
  const path = ownPath(home, full)
  if (existsSync(path)) {
    throw new Error(`${full} already exists — \`ttheme edit ${full}\` changes it`)
  }
  const view = available(home, catalog)
  const origin = from ?? startupPalette(state)
  if (!origin) {
    throw new Error('--from names the palette to start from')
  }
  const source = find(view.palettes, origin)
  const base = ownerOf(source.name) ? source.base : source.default ? undefined : source.name
  const { base: _, ansiSource: __, ...rest } = draftOf(source, full, `kept from ${source.name}`)
  const held = heldPictures(home, source.name) ?? source.pictures
  const content = paletteToml({ ...rest, ...(base ? { base } : {}), ...(held ? { pictures: held } : {}) })
  readOwnText(full, content, catalog.palettes)
  mkdirSync(dirname(path), { recursive: true })
  writeAtomic(path, content)
  const { state: now } = install(home, catalog, [full])
  console.log(`  + ${full}  from ${source.name}\n    ${path}`)
  await bringPictures(
    home,
    available(home, catalog).palettes.filter((e) => e.name === full),
    now.terminals,
  )
  console.log(`\n\`ttheme edit ${full}\` changes its colors · \`ttheme use ${full}\` wears it`)
}

function editor(path: string): void {
  const command = process.env.VISUAL || process.env.EDITOR || 'vi'
  const run = spawnSync('sh', ['-c', `${command} "$1"`, 'sh', path], { stdio: 'inherit' })
  if (run.status !== 0) {
    throw new Error(`${command} exited ${run.status ?? run.signal}`)
  }
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
  const full = view.palettes.some((e) => e.name === name) ? name : mine(name, home)
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
    throw new Error('edit opens your editor — run it in a terminal')
  }
  const before = readFileSync(path, 'utf8')
  const draft = join(mkdtempSync(join(tmpdir(), 'ttheme-edit-')), basename(path))
  writeFileSync(draft, before)
  let failing: string[] = []
  try {
    for (;;) {
      editor(draft)
      const after = readFileSync(draft, 'utf8')
      if (after === before) {
        console.log('nothing changed')
        return
      }
      try {
        failing = failuresOf(full, after, catalog)
      } catch (error) {
        console.log(`\n${(error as Error).message}\n`)
        const again = await p.confirm({ message: `${full} cannot be read like this — edit it again?` })
        if (p.isCancel(again) || !again) {
          console.log('kept the old one')
          return
        }
        continue
      }
      writeAtomic(path, after)
      break
    }
  } finally {
    rmSync(dirname(draft), { recursive: true, force: true })
  }
  if (state.palettes.includes(full)) {
    sync(home, catalog, state)
  }
  console.log(
    `saved ${full}${state.palettes.includes(full) ? ' — new tabs and `ttheme use` wear it' : ` — \`ttheme add ${full}\` installs it`}`,
  )
  if (failing.length > 0) {
    console.log(
      `\nit misses the contrast gate:\n${failing.join('\n')}\n\`ttheme check --fix ${full}\` suggests colors that pass`,
    )
  }
  const entry = available(home, catalog).palettes.find((e) => e.name === full)
  const old = paletteEntry(readOwnText(full, before, catalog.palettes))
  if (
    entry &&
    rackOf(home, full).length > 0 &&
    (entry.background !== old.background || entry.backdrop.color !== old.backdrop.color)
  ) {
    console.log('its pictures keep the old tint — reinstall one from `ttheme preview` → tab to retint it')
  }
  if (entry && state.palettes.includes(full)) {
    await bringPictures(home, [since(entry, old.pictures)], state.terminals)
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
    console.log('\npasses the gate')
    return 0
  }
  const { theme, moves, left } = fixGate(toTheme(entry))
  if (moves.length === 0) {
    console.log('\nno color change fixes it — waive the rule in [contrast] with a reason, or pick other colors')
    return 1
  }
  console.log(
    `\n${left.length === 0 ? 'these colors pass' : 'these colors come closer'}:\n${movesText(moves).join('\n')}`,
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
  writeAtomic(path, recolor(readFileSync(path, 'utf8'), theme))
  if (state.palettes.includes(entry.name)) {
    sync(home, catalog, state)
  }
  console.log(`\nwrote ${path}`)
  return left.length === 0 ? 0 : 1
}

function mineAt(home: string, name: string): string | undefined {
  const owner = ownerOf(name)
  return owner && localMarkets(home, false).some((m) => m.owner === owner) ? ownPath(home, name) : undefined
}

function draftFor(home: string, entry: PaletteEntry): Draft {
  const path = mineAt(home, entry.name)
  const reason =
    path && existsSync(path) ? readOwnText(entry.name, readFileSync(path, 'utf8'), [entry]).waiveReason : undefined
  const held = heldPictures(home, entry.name) ?? entry.pictures
  const { pictures: _, ...draft } = draftOf(entry, entry.name, reason)
  return { ...draft, ...(held ? { pictures: held } : {}) }
}

export function runShare(name: string): void {
  const home = configHome()
  const code = shareCode(draftFor(home, named(available(home, readCatalog(home)), name, home)))
  console.log(code)
  if (process.stdout.isTTY) {
    console.error(`\nanyone with ttheme wears it with: ttheme add ${CODE}…`)
  }
}
