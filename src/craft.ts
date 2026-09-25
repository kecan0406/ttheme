import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import * as p from '@clack/prompts'
import pkg from '../package.json' with { type: 'json' }
import { rackOf } from './backdrop.ts'
import { available, find, gateFailures, readCatalog } from './catalog.ts'
import { writeAtomic } from './edits.ts'
import { type Manifest, type PaletteEntry, paletteEntry, toTheme } from './emit/manifest.ts'
import { fixGate, type Move } from './fix.ts'
import {
  CODE,
  type Draft,
  draftOf,
  fromCode,
  gateLines,
  ownPath,
  paletteToml,
  readOwnText,
  recolor,
  shareCode,
} from './own.ts'
import { commit, configHome, type Installed, readInstalled, startupPalette, sync, writeInstalled } from './palettes.ts'
import { bringPictures, heldPictures, since } from './pictures.ts'
import { authorOf, nameProblem, type Theme } from './theme.ts'

const HANDLE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function tty(): boolean {
  return process.stdin.isTTY === true && process.stdout.isTTY === true
}

function fromGh(): string | undefined {
  try {
    const login = execFileSync('gh', ['api', 'user', '--jq', '.login'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 10_000,
    })
      .trim()
      .toLowerCase()
    return HANDLE.test(login) ? login : undefined
  } catch {
    return undefined
  }
}

async function handle(home: string, state: Installed): Promise<string> {
  if (state.author) {
    return state.author
  }
  let author = fromGh()
  if (!author) {
    if (!tty()) {
      throw new Error(
        'your palettes are named after your GitHub handle — log in with `gh auth login`, or run this in a terminal',
      )
    }
    const typed = await p.text({
      message: 'your GitHub handle — your palettes are named <handle>/<palette>',
      validate: (value) =>
        HANDLE.test((value ?? '').toLowerCase()) && (value ?? '').length <= 39
          ? undefined
          : 'that is not a GitHub handle',
    })
    if (p.isCancel(typed)) {
      throw new Error('no handle given')
    }
    author = typed.toLowerCase()
  }
  writeInstalled(home, { ...state, author })
  console.log(`your palettes are named ${author}/<palette>`)
  return author
}

function mine(name: string, state: Installed): string {
  return name.includes('/') || !state.author ? name : `${state.author}/${name}`
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
  const source = paletteToml(draft)
  const theme = readOwnText(draft.name, source, catalog.palettes)
  const failures = gateFailures(paletteEntry(theme))
  if (failures.length > 0) {
    throw new Error(`${draft.name} fails the contrast gate: ${failures.join(', ')}`)
  }
  const path = ownPath(home, draft.name)
  if (existsSync(path) && readFileSync(path, 'utf8') !== source) {
    throw new Error(`${draft.name} is already at ${path} and differs — move it away to take this one`)
  }
  mkdirSync(dirname(path), { recursive: true })
  writeAtomic(path, source)
  if (catalog.palettes.some((e) => e.name === draft.name)) {
    console.log(`  ${draft.name} from the code stands in for the catalog's`)
  }
  return draft.name
}

export async function runNew(name: string, from: string | undefined): Promise<void> {
  const home = configHome()
  const catalog = readCatalog(home)
  const state = readInstalled(home)
  const author = await handle(home, state)
  const full = name.includes('/') ? name : `${author}/${name}`
  const problem = nameProblem(full)
  if (problem) {
    throw new Error(`${full} ${problem}`)
  }
  if (authorOf(full) !== author) {
    throw new Error(`your palettes are named ${author}/<palette> — ${full} is someone else's`)
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
  const base = authorOf(source.name) ? source.base : source.default ? undefined : source.name
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

function problemOf(name: string, source: string, catalog: Manifest): { problem?: string; fixed?: string } {
  let theme: Theme
  try {
    theme = readOwnText(name, source, catalog.palettes)
  } catch (error) {
    return { problem: (error as Error).message }
  }
  const failures = gateFailures(paletteEntry(theme))
  if (failures.length === 0) {
    return {}
  }
  const { theme: fixed, moves, left } = fixGate(theme)
  return {
    problem: [`it fails the contrast gate: ${failures.join(', ')}`, ...movesText(moves)].join('\n'),
    ...(left.length === 0 && moves.length > 0 ? { fixed: recolor(source, fixed) } : {}),
  }
}

export async function runEdit(name: string): Promise<void> {
  const home = configHome()
  const catalog = readCatalog(home)
  const state = readInstalled(home)
  const full = mine(name, state)
  const path = ownPath(home, full)
  if (!existsSync(path)) {
    const known = available(home, catalog, false).palettes.some((e) => e.name === full)
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
  try {
    for (;;) {
      editor(draft)
      const after = readFileSync(draft, 'utf8')
      if (after === before) {
        console.log('nothing changed')
        return
      }
      const { problem, fixed } = problemOf(full, after, catalog)
      if (!problem) {
        writeAtomic(path, after)
        break
      }
      console.log(`\n${problem}\n`)
      const choice = await p.select({
        message: `${full} cannot be worn like this`,
        options: [
          ...(fixed ? [{ value: 'fix', label: 'take the colors above' }] : []),
          { value: 'again', label: 'edit it again' },
          { value: 'back', label: 'keep the old one' },
        ],
      })
      if (p.isCancel(choice) || choice === 'back') {
        console.log('kept the old one')
        return
      }
      if (choice === 'fix' && fixed) {
        writeAtomic(path, fixed)
        break
      }
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

function named(view: Manifest, name: string, state: Installed): PaletteEntry {
  return find(view.palettes, view.palettes.some((e) => e.name === name) ? name : mine(name, state))
}

export function runCheck(name: string, fix = false): number {
  const home = configHome()
  const catalog = readCatalog(home)
  const state = readInstalled(home)
  const entry = named(available(home, catalog), name, state)
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
  const path = authorOf(entry.name) ? ownPath(home, entry.name) : undefined
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

function draftFor(home: string, entry: PaletteEntry): Draft {
  const path = authorOf(entry.name) ? ownPath(home, entry.name) : undefined
  const reason =
    path && existsSync(path) ? readOwnText(entry.name, readFileSync(path, 'utf8'), [entry]).waiveReason : undefined
  const held = heldPictures(home, entry.name) ?? entry.pictures
  const { pictures: _, ...draft } = draftOf(entry, entry.name, reason)
  return { ...draft, ...(held ? { pictures: held } : {}) }
}

export function runShare(name: string): void {
  const home = configHome()
  const state = readInstalled(home)
  const code = shareCode(draftFor(home, named(available(home, readCatalog(home)), name, state)))
  console.log(code)
  if (process.stdout.isTTY) {
    console.error(`\nanyone with ttheme wears it with: ttheme add ${CODE}…`)
  }
}

function openUrl(url: string): void {
  const opener = process.platform === 'darwin' ? 'open' : process.env.WSL_DISTRO_NAME ? 'wslview' : 'xdg-open'
  try {
    spawn(opener, [url], { stdio: 'ignore', detached: true })
      .on('error', () => {})
      .unref()
  } catch {}
}

export async function runSubmit(name: string): Promise<void> {
  const home = configHome()
  const catalog = readCatalog(home)
  const state = readInstalled(home)
  const author = await handle(home, state)
  const full = mine(name, { ...state, author })
  const path = ownPath(home, full)
  if (!existsSync(path)) {
    throw new Error(`no palette of yours called ${full} — \`ttheme new\` makes one`)
  }
  if (authorOf(full) !== author) {
    throw new Error(`${full} is ${authorOf(full)}'s — only its author submits it`)
  }
  const theme = readOwnText(full, readFileSync(path, 'utf8'), catalog.palettes)
  const failures = gateFailures(paletteEntry(theme))
  if (failures.length > 0) {
    throw new Error(`${full} fails the contrast gate — \`ttheme check --fix ${full}\` first`)
  }
  const content = paletteToml(draftFor(home, paletteEntry(theme)))
  const updating = catalog.palettes.some((e) => e.name === full)
  const url = `${pkg.bugs}/new?${new URLSearchParams({
    template: 'palette.yml',
    title: `palette: ${full}`,
    palette: content,
  })}`
  console.log(
    `${updating ? 'updates' : 'adds'} ${full} in the catalog — a GitHub issue carries it, and a bot turns it into a pull request`,
  )
  console.log(`\n${url}\n`)
  if (tty()) {
    openUrl(url)
  }
}
