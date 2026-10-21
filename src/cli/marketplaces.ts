import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { basename, join, relative } from 'node:path'
import * as p from '@clack/prompts'
import { parse } from 'smol-toml'
import { listed, type PaletteEntry, parseManifest } from '../core/manifest.ts'
import { gateLines } from '../core/own.ts'
import { marketplaceNameProblem, marketplaceToml, readmeOf } from '../core/scaffold.ts'
import { ago, counted, escaped, inertLines } from '../core/text.ts'
import { type Identity, MARKETPLACE_FILE, marketplaceId, marketplaceOf, slugOf, unknownKeys } from '../core/theme.ts'
import { ROOT } from '../root.ts'
import { idOf, nameOf, readMarketplaces } from '../store/available.ts'
import { writeAtomic } from '../store/edits.ts'
import { type Installed, readInstalled, writeInstalled } from '../store/installed.ts'
import {
  type LocalMarketplace,
  localMarketplaces,
  marketplaceFiles,
  palettesDir,
  readMarketplaceDir,
  warning,
} from '../store/local.ts'
import { configHome } from '../store/paths.ts'
import {
  autoUpdates,
  CATALOG_KEYS,
  cachePath,
  defaultLocal,
  isLocal,
  isRemote,
  localIdentity,
  MARKETPLACE_KEYS,
  marketplacesOf,
  OFFICIAL,
  OWNER_KEYS,
  parseSource,
  refOf,
  sameMarketplace,
  shownSource,
} from '../store/sources.ts'
import { pending } from '../tui/pending.ts'
import { interactive } from '../tui/terminal.ts'
import { type Fetched, fetchedAt, fetchMarketplace, readTries, storeMarketplace } from './refresh.ts'
import { renameProblems } from './renames.ts'
import { sync } from './sync.ts'

const HANDLE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const ACTIONS = ['add', 'remove', 'init', 'check']

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

async function handle(home: string, state: Installed, owner?: string): Promise<string> {
  if (state.author) {
    return state.author
  }

  if (owner !== undefined && !(HANDLE.test(owner.toLowerCase()) && owner.length <= 39)) {
    throw new Error(`--owner ${owner} is not a GitHub handle`)
  }

  let author = owner?.toLowerCase() ?? fromGh()

  if (!author) {
    if (!interactive()) {
      throw new Error(
        'your palettes are named after your GitHub handle — log in with `gh auth login`, pass --owner <handle>, or run this in a terminal',
      )
    }

    const typed = await p.text({
      message: 'Your GitHub handle — your palettes are named <handle>@<marketplace>/<palette>',
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
  console.log(`Your palettes are named ${author}@<marketplace>/<palette>`)

  return author
}

function marketplaceOfPalette(name: string): string {
  return marketplaceOf(name) ?? OFFICIAL
}

function official(home: string): PaletteEntry[] {
  return readMarketplaces(home).palettes.filter((e) => marketplaceOf(e.name) === undefined)
}

function officialFor(home: string): PaletteEntry[] {
  const path = join(ROOT, 'dist', 'manifest.json')

  return existsSync(path) ? parseManifest(readFileSync(path, 'utf8')).palettes : official(home)
}

export function withMarketplaces(
  state: Installed,
  marketplaces: string[],
  updates: Record<string, boolean>,
): Installed {
  const { updates: _, ...rest } = state

  const kept = Object.entries(updates).filter(
    ([source, on]) => isRemote(source) && marketplaces.includes(source) && on !== autoUpdates(source, {}),
  )

  return { ...rest, marketplaces, ...(kept.length > 0 ? { updates: Object.fromEntries(kept) } : {}) }
}

function nameTaken(home: string, sources: string[], source: string, name: string): string | undefined {
  return sources.find((s) => s !== source && !sameMarketplace(s, source) && nameOf(home, s) === name)
}

function register(home: string, source: string, name: string, auto?: boolean): void {
  const state = readInstalled(home)
  const sources = marketplacesOf(state.marketplaces)
  const taken = nameTaken(home, sources, source, name)

  if (taken) {
    throw new Error(
      `${name} already names the marketplace at ${shownSource(taken)} — \`ttheme marketplace remove ${name}\` first`,
    )
  }

  const updates = auto === undefined ? { ...state.updates } : { ...state.updates, [source]: auto }
  writeInstalled(home, withMarketplaces(state, sources.includes(source) ? sources : [...sources, source], updates))
}

async function askAuto(id: string): Promise<boolean> {
  if (!interactive()) {
    return false
  }

  const yes = await p.confirm({
    message: `Update ${id} on its own when its author changes it? ttheme checks once a day, when you run it`,
    initialValue: false,
  })

  if (p.isCancel(yes)) {
    throw new Error('no answer given — nothing was added')
  }

  return yes
}

async function fetching(home: string, source: string): Promise<Fetched> {
  const line = pending(`Fetching ${shownSource(source)}`)

  try {
    return await fetchMarketplace(home, source)
  } finally {
    line.done()
  }
}

async function repin(home: string, was: string, source: string): Promise<Fetched> {
  const fetched = await fetching(home, source)
  const state = readInstalled(home)
  const sources = marketplacesOf(state.marketplaces)
  const taken = nameTaken(home, sources, source, fetched.id)

  if (taken) {
    throw new Error(
      `${fetched.id} already names the marketplace at ${shownSource(taken)} — \`ttheme marketplace remove ${fetched.id}\` first`,
    )
  }

  const { [was]: auto, ...others } = state.updates ?? {}
  const updates = auto === undefined ? others : { ...others, [source]: auto }
  writeInstalled(
    home,
    withMarketplaces(
      state,
      sources.map((s) => (s === was ? source : s)),
      updates,
    ),
  )
  storeMarketplace(home, fetched)

  return fetched
}

async function addSource(home: string, arg: string): Promise<{ source: string; id: string; fresh: boolean }> {
  const source = parseSource(arg)
  const sources = marketplacesOf(readInstalled(home).marketplaces)

  if (sources.includes(source)) {
    console.log(`${shownSource(source)} is already added`)

    return { source, id: idOf(home, source), fresh: false }
  }

  const was = isRemote(source) ? sources.find((s) => isRemote(s) && sameMarketplace(s, source)) : undefined

  if (was) {
    const fetched = await repin(home, was, source)
    console.log(
      `Moved ${fetched.id} to ${refOf(source) ?? 'its default branch'} · ${shownSource(source)} — ${counted(listed(fetched.entries).length)}`,
    )

    return { source, id: fetched.id, fresh: false }
  }

  if (isLocal(source)) {
    const id = marketplaceId(localIdentity(source))
    register(home, source, id)
    const count = readMarketplaceDir(source, id, official(home)).length
    console.log(`Added ${id} · ${shownSource(source)} — ${counted(count)}, read in place`)

    return { source, id, fresh: true }
  }

  const fetched = await fetching(home, source)
  const auto = source === OFFICIAL ? undefined : await askAuto(fetched.id)
  register(home, source, fetched.id, auto)
  storeMarketplace(home, fetched)
  const count = counted(listed(fetched.entries).length)
  console.log(
    source === OFFICIAL
      ? `Added the official marketplace — ${count}`
      : `Added ${fetched.id} · ${shownSource(source)} — ${count}${auto ? ', updating on its own' : ''}`,
  )

  return { source, id: fetched.id, fresh: true }
}

async function addMarketplace(arg: string): Promise<void> {
  const home = configHome()
  const { source, id, fresh } = await addSource(home, arg)

  if (!fresh) {
    return
  }

  if (isLocal(source)) {
    console.log(
      '\nThe Browse tab of `ttheme` picks them · `ttheme share` puts the folder on GitHub, where `ttheme marketplace add <owner>/<repo>` adds it anywhere',
    )
  } else if (source === OFFICIAL) {
    console.log('\nThe Browse tab of `ttheme` picks them')
  } else {
    console.log(`\nThe Browse tab of \`ttheme\` picks them, or \`ttheme add ${id}/<palette>\``)
  }
}

export function dropCache(home: string, source: string): void {
  if (isRemote(source)) {
    rmSync(cachePath(home, source), { force: true })
  }
}

export function keptNote(kept: string[]): string {
  return `${counted(kept.length)} installed from it keep${kept.length === 1 ? 's' : ''} working: ${kept.join(', ')} — the Browse tab of \`ttheme\` drops ${kept.length === 1 ? 'it' : 'them'}`
}

function removeMarketplace(name: string): void {
  const home = configHome()
  const state = readInstalled(home)
  const sources = marketplacesOf(state.marketplaces)
  const source = sources.find((s) => nameOf(home, s) === name) ?? sources.find((s) => s === parseSourceOrNot(name))

  if (!source) {
    throw new Error(`no marketplace named ${name} — the Browse tab of \`ttheme\` lists them`)
  }

  const id = nameOf(home, source)
  const kept = state.palettes.filter((n) => marketplaceOfPalette(n) === id)
  const remaining = sources.filter((s) => s !== source)
  const next = withMarketplaces(state, remaining, state.updates ?? {})
  writeInstalled(home, next)
  dropCache(home, source)
  sync(home, readMarketplaces(home), next)
  console.log(`Removed ${id ?? name} · ${shownSource(source)}`)

  if (kept.length > 0) {
    console.log(keptNote(kept))
  }
}

function parseSourceOrNot(arg: string): string | undefined {
  try {
    return parseSource(arg)
  } catch {
    return undefined
  }
}

export function lastUpdate(home: string, source: string, tries = readTries(), now = Date.now()): string {
  if (isLocal(source)) {
    return 'read in place'
  }

  if (source === OFFICIAL) {
    return 'comes with ttheme'
  }

  const failed = tries[source]
  const at = fetchedAt(home, source)

  if (failed && (at === undefined || failed.at > at)) {
    return `update failed ${ago(failed.at, now)}`
  }

  return at === undefined ? 'never updated' : `updated ${ago(at, now)}`
}

function scaffold(dir: string, identity: Identity): void {
  mkdirSync(palettesDir(dir), { recursive: true })
  writeAtomic(join(dir, MARKETPLACE_FILE), marketplaceToml(identity))
  writeAtomic(join(dir, 'README.md'), readmeOf(identity))
}

async function askName(): Promise<string> {
  if (!interactive()) {
    throw new Error('you have no marketplace of your own yet — `ttheme marketplace init <name>` makes one')
  }

  const typed = await p.text({
    message: "Your marketplace's name — its palettes are <you>@<name>/<palette>",
    validate: (value) => marketplaceNameProblem((value ?? '').toLowerCase()),
  })

  if (p.isCancel(typed)) {
    throw new Error('no marketplace name given')
  }

  return typed.toLowerCase()
}

export async function ensureLocal(home: string, into?: string): Promise<LocalMarketplace> {
  const locals = localMarketplaces(home)

  if (into) {
    const hit = locals.find((m) => m.name === into || m.id === into || m.dir === parseSourceOrNot(into))

    if (!hit) {
      throw new Error(
        `${into} is not one of your local marketplaces — \`ttheme marketplace init ${into}\` makes it one`,
      )
    }

    return hit
  }

  const [only, ...more] = locals

  if (only && more.length === 0) {
    return only
  }

  if (only) {
    throw new Error(
      `you have ${locals.length} local marketplaces — --in names one: ${locals.map((m) => m.name).join(', ')}`,
    )
  }

  return newLocal(home)
}

export async function newLocal(home: string): Promise<LocalMarketplace> {
  const name = await askName()

  return initLocal(home, defaultLocal(home, name), name)
}

async function initLocal(home: string, dir: string, name: string, owner?: string): Promise<LocalMarketplace> {
  const fresh = !existsSync(join(dir, MARKETPLACE_FILE))
  let identity: Identity

  if (fresh) {
    const problem = marketplaceNameProblem(name)

    if (problem) {
      throw new Error(`the marketplace name ${name} ${problem}`)
    }

    if (existsSync(dir) && readdirSync(dir).length > 0) {
      throw new Error(`${dir} is not empty — pick a new folder for the marketplace`)
    }

    identity = { owner: await handle(home, readInstalled(home), owner), name }
    scaffold(dir, identity)
  } else {
    identity = localIdentity(dir)
  }

  const id = marketplaceId(identity)
  register(home, dir, id)
  console.log(`${fresh ? 'Made' : 'Added'} your marketplace ${id} · ${shownSource(dir)}`)

  return { dir, ...identity, id }
}

function pathLike(arg: string): boolean {
  return arg.startsWith('.') || arg.startsWith('/') || arg.startsWith('~')
}

async function initMarketplace(arg: string | undefined, owner?: string): Promise<void> {
  const home = configHome()

  const name =
    arg && !pathLike(arg) ? arg.toLowerCase() : arg ? basename(parseSource(arg)).toLowerCase() : await askName()

  const dir = arg && pathLike(arg) ? parseSource(arg) : defaultLocal(home, name)
  await initLocal(home, dir, name, owner)
  console.log(
    '\n`ttheme new <palette> --from <palette>` puts palettes in it, and a folder under palettes/ shelves them in a catalog — `ttheme share` puts it on GitHub, where others add it',
  )
}

function checkMarketplace(arg: string | undefined): number {
  const dir = arg ? parseSource(arg) : process.cwd()
  const path = join(dir, MARKETPLACE_FILE)

  if (!existsSync(path)) {
    throw new Error(
      `${shownSource(dir)} has no ${MARKETPLACE_FILE} — \`ttheme marketplace init ${shownSource(dir)}\` makes one`,
    )
  }

  const errors: string[] = []
  const warnings: string[] = []
  const text = readFileSync(path, 'utf8')
  let info: ReturnType<typeof localIdentity>

  try {
    info = localIdentity(dir)
  } catch (error) {
    console.error(`  ✗ ${inertLines((error as Error).message)}`)

    return 1
  }

  const doc = parse(text) as Record<string, unknown>
  const owner = doc.owner as Record<string, unknown>

  for (const key of Object.keys(doc).filter((k) => !MARKETPLACE_KEYS.includes(k))) {
    warnings.push(`${MARKETPLACE_FILE}: unknown key ${escaped(key)} — ttheme ignores it`)
  }

  for (const key of Object.keys(owner).filter((k) => !OWNER_KEYS.includes(k))) {
    warnings.push(`${MARKETPLACE_FILE}: unknown key owner.${escaped(key)} — ttheme ignores it`)
  }

  for (const [i, table] of (Array.isArray(doc.catalog) ? (doc.catalog as Record<string, unknown>[]) : []).entries()) {
    for (const key of Object.keys(table).filter((k) => !CATALOG_KEYS.includes(k))) {
      warnings.push(`${MARKETPLACE_FILE}: unknown key catalog[${i}].${escaped(key)} — ttheme ignores it`)
    }
  }

  if (!info.description) {
    warnings.push(`${MARKETPLACE_FILE}: no description — Browse and the marketplace page show one`)
  }

  const id = marketplaceId(info)

  const entries = readMarketplaceDir(dir, id, officialFor(configHome()), (where, message) =>
    errors.push(`${escaped(relative(dir, where))}: ${message.replace(`${escaped(basename(where))}: `, '')}`),
  )

  for (const file of marketplaceFiles(dir)) {
    let keys: string[]

    try {
      keys = unknownKeys(file.path, readFileSync(file.path, 'utf8'))
    } catch {
      keys = []
    }

    for (const key of keys) {
      warnings.push(`${escaped(relative(dir, file.path))}: unknown key ${escaped(key)} — ttheme ignores it`)
    }
  }

  for (const catalog of info.catalogs) {
    const inside = entries.filter((e) => e.catalog === catalog.name)

    if (inside.length === 0) {
      warnings.push(`${MARKETPLACE_FILE}: catalog ${catalog.name} has no folder under palettes/ — ttheme ignores it`)
    } else if (catalog.lead && !inside.some((e) => slugOf(e.name) === catalog.lead)) {
      warnings.push(
        `${MARKETPLACE_FILE}: catalog ${catalog.name} leads with ${catalog.lead}, which is not in it — its first palette leads instead`,
      )
    }
  }

  const renames = renameProblems(info.renames, new Set(entries.map((e) => slugOf(e.name))))
  errors.push(...renames.errors.map((e) => `${MARKETPLACE_FILE}: ${e}`))
  warnings.push(...renames.warnings.map((w) => `${MARKETPLACE_FILE}: ${w}`))

  for (const entry of entries) {
    const failing = gateLines(entry).filter((l) => l.startsWith('  ✗'))
    const shown = entry.catalog ? `${entry.catalog}/${slugOf(entry.name)}` : slugOf(entry.name)
    console.log(`  ${shown}${failing.length > 0 ? `\n${failing.join('\n')}` : '  passes the gate'}`)
  }

  for (const line of errors) {
    console.error(`  ✗ ${inertLines(line)}`)
  }

  for (const line of warnings) {
    console.log(`  ! ${inertLines(line)}`)
  }

  const tally = (n: number, what: string) => `${n} ${what}${n === 1 ? '' : 's'}`
  console.log(
    `\n${id} · ${counted(entries.length)} · ${tally(errors.length, 'error')} · ${tally(warnings.length, 'warning')}`,
  )

  return errors.length > 0 ? 1 : 0
}

export async function runMarketplace(
  action: string,
  arg: string | undefined,
  owner?: string,
): Promise<number | undefined> {
  switch (action) {
    case 'add':
      await addMarketplace(required(action, arg))

      return
    case 'remove':
      removeMarketplace(required(action, arg))

      return
    case 'init':
      await initMarketplace(arg, owner)

      return
    case 'check':
      return checkMarketplace(arg)
    default:
      throw new Error(`unknown marketplace action ${action} — ${ACTIONS.join(', ')}`)
  }
}

function required(action: string, arg: string | undefined): string {
  if (!arg) {
    throw new Error(
      action === 'add'
        ? 'marketplace add takes a repository or a folder: ttheme marketplace add alice/ttheme-dust'
        : 'marketplace remove takes a marketplace name: ttheme marketplace remove alice@pastel',
    )
  }

  return arg
}

export function localLine(home: string, source: string): string {
  const id = idOf(home, source)

  return `${id} — ${counted(readMarketplaceDir(source, id, official(home), warning(false)).length)}, read in place`
}
