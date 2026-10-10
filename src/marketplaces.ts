import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { basename, join, relative } from 'node:path'
import * as p from '@clack/prompts'
import { parse } from 'smol-toml'
import {
  archiveId,
  officialPath,
  parseManifest,
  readArchive,
  readCachedArchive,
  readMarketplaces,
} from './available.ts'
import { writeAtomic } from './edits.ts'
import { listed, type PaletteEntry } from './manifest.ts'
import { type Listed, readIndex } from './marketplace-index.ts'
import { containsText } from './names.ts'
import {
  gateLines,
  type LocalMarketplace,
  localMarketplaces,
  marketplaceFiles,
  palettesDir,
  readMarketplaceDir,
  warning,
} from './own.ts'
import { configHome, type Installed, readInstalled, sync, writeInstalled } from './palettes.ts'
import { pending } from './pending.ts'
import {
  ago,
  cachedMarketplace,
  counted,
  type Fetched,
  fetchedAt,
  fetchMarketplace,
  readTries,
  storeMarketplace,
} from './refresh.ts'
import { renameProblems } from './renames.ts'
import {
  autoUpdates,
  CATALOG_KEYS,
  cachePath,
  defaultLocal,
  type Identity,
  isLocal,
  isRemote,
  localIdentity,
  MARKETPLACE_KEYS,
  marketplaceId,
  marketplacesOf,
  marketplaceToml,
  OFFICIAL,
  OWNER_KEYS,
  parseSource,
  refOf,
  repoOf,
  sameMarketplace,
  shownSource,
  TOPIC,
} from './sources.ts'
import { MARKETPLACE_FILE, marketplaceOf, nameProblem, slugOf, unknownKeys } from './theme.ts'

const HANDLE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const ACTIONS = ['add', 'remove', 'search', 'init', 'check']

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

export function idOf(home: string, source: string): string {
  if (source === OFFICIAL) {
    return OFFICIAL
  }
  return isLocal(source) ? marketplaceId(localIdentity(source)) : archiveId(source, readCachedArchive(home, source))
}

function nameOf(home: string, source: string): string | undefined {
  try {
    return idOf(home, source)
  } catch {
    return undefined
  }
}

function marketplaceOfPalette(name: string): string {
  return marketplaceOf(name) ?? OFFICIAL
}

function official(home: string): PaletteEntry[] {
  return readMarketplaces(home).palettes.filter((e) => marketplaceOf(e.name) === undefined)
}

function officialFor(home: string): PaletteEntry[] {
  const path = join(import.meta.dirname, '..', 'dist', 'manifest.json')
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
  if (!tty()) {
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

export async function addSource(home: string, arg: string): Promise<{ source: string; id: string; fresh: boolean }> {
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
      '\nThe Browse tab of `ttheme` picks them · once the folder is on GitHub, `ttheme marketplace add <owner>/<repo>` adds it anywhere',
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
  return `${counted(kept.length)} installed from it keep${kept.length === 1 ? 's' : ''} working: ${kept.join(', ')} — \`ttheme remove\` drops ${kept.length === 1 ? 'it' : 'them'}`
}

function removeMarketplace(name: string): void {
  const home = configHome()
  const state = readInstalled(home)
  const sources = marketplacesOf(state.marketplaces)
  const source = sources.find((s) => nameOf(home, s) === name) ?? sources.find((s) => s === parseSourceOrNot(name))
  if (!source) {
    throw new Error(`no marketplace named ${name} — \`ttheme marketplace\` lists them`)
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

function countOf(home: string, source: string): number | undefined {
  try {
    if (source === OFFICIAL) {
      return listed(parseManifest(readFileSync(officialPath(home), 'utf8')).palettes).length
    }
    if (isLocal(source)) {
      return readMarketplaceDir(source, idOf(home, source), official(home), warning(false)).length
    }
    return readArchive(source, readCachedArchive(home, source), official(home), warning(false)).entries.length
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

function listMarketplaces(): void {
  const home = configHome()
  const state = readInstalled(home)
  const sources = marketplacesOf(state.marketplaces)
  if (sources.length === 0) {
    console.log('No marketplaces — `ttheme marketplace add official` brings the official one back')
    return
  }
  const tries = readTries()
  const rows = sources.map((source) => {
    const name = nameOf(home, source) ?? '?'
    const count = countOf(home, source)
    const installed = state.palettes.filter((n) => marketplaceOfPalette(n) === name).length
    const auto = isLocal(source) ? [] : [`auto-update ${autoUpdates(source, state.updates) ? 'on' : 'off'}`]
    const about = source === OFFICIAL ? undefined : cachedMarketplace(home, source)?.info.description
    return {
      name,
      where: shownSource(source),
      about,
      note: [
        count === undefined ? 'Unreadable' : counted(count),
        ...(installed > 0 ? [`${installed} installed`] : []),
        ...auto,
        lastUpdate(home, source, tries),
      ].join(' · '),
    }
  })
  const nameWidth = Math.max(...rows.map((r) => r.name.length))
  const whereWidth = Math.max(...rows.map((r) => r.where.length))
  for (const r of rows) {
    console.log(`  ${r.name.padEnd(nameWidth)}  ${r.where.padEnd(whereWidth)}  ${r.note}`)
    if (r.about) {
      console.log(`  ${' '.repeat(nameWidth)}  ${r.about}`)
    }
  }
}

export function listedMatches(m: Listed, query: string): boolean {
  return containsText([m.id, m.source, m.about, ...m.palettes.flatMap((e) => [e.name, e.catalog ?? ''])], query)
}

async function searchMarketplaces(query: string | undefined): Promise<void> {
  const home = configHome()
  const { marketplaces, at, offline } = await readIndex()
  if (offline) {
    console.log(`Offline — the list from ${ago(at)} (${offline})\n`)
  }
  const found = marketplaces.filter((m) => !query || listedMatches(m, query))
  if (found.length === 0) {
    console.log(`No marketplace carries the ${TOPIC} topic${query ? ` and matches ${query}` : ''} yet`)
    return
  }
  const added = new Set(marketplacesOf(readInstalled(home).marketplaces).map(repoOf))
  const idWidth = Math.max(...found.map((m) => m.id.length))
  const sourceWidth = Math.max(...found.map((m) => m.source.length))
  for (const m of found) {
    const stars = `★${m.stars}`.padStart(5)
    console.log(
      `  ${added.has(m.source) ? '●' : '○'} ${m.id.padEnd(idWidth)}  ${m.source.padEnd(sourceWidth)}  ${stars}  ${counted(m.palettes.length)}  ${m.about}`,
    )
  }
  console.log('\n`ttheme marketplace add <owner/repo>` adds one')
}

function repoFor({ name }: Identity): string {
  return `ttheme-${name}`
}

function scaffold(dir: string, identity: Identity): void {
  mkdirSync(palettesDir(dir), { recursive: true })
  writeAtomic(join(dir, MARKETPLACE_FILE), marketplaceToml(identity))
  writeAtomic(
    join(dir, 'README.md'),
    `# ${marketplaceId(identity)}\n\nA [ttheme](https://github.com/kecan0406/ttheme) marketplace:\n\n\`\`\`sh\nttheme marketplace add ${identity.owner}/${repoFor(identity)}\nttheme\n\`\`\`\n`,
  )
}

function nameProblemOf(name: string): string | undefined {
  return nameProblem(`x@${name}/x`) ? 'takes lowercase letters, digits and single hyphens' : undefined
}

async function askName(): Promise<string> {
  if (!tty()) {
    throw new Error('name the marketplace: ttheme marketplace init <name>, or --in <name> on new')
  }
  const typed = await p.text({
    message: "Your marketplace's name — its palettes are <you>@<name>/<palette>",
    validate: (value) => nameProblemOf((value ?? '').toLowerCase()),
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
  const name = await askName()
  return initLocal(home, defaultLocal(home, name), name)
}

async function initLocal(home: string, dir: string, name: string): Promise<LocalMarketplace> {
  const fresh = !existsSync(join(dir, MARKETPLACE_FILE))
  let identity: Identity
  if (fresh) {
    const problem = nameProblemOf(name)
    if (problem) {
      throw new Error(`the marketplace name ${name} ${problem}`)
    }
    if (existsSync(dir) && readdirSync(dir).length > 0) {
      throw new Error(`${dir} is not empty — pick a new folder for the marketplace`)
    }
    identity = { owner: await handle(home, readInstalled(home)), name }
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

async function initMarketplace(arg: string | undefined): Promise<void> {
  const home = configHome()
  const name =
    arg && !pathLike(arg) ? arg.toLowerCase() : arg ? basename(parseSource(arg)).toLowerCase() : await askName()
  const dir = arg && pathLike(arg) ? parseSource(arg) : defaultLocal(home, name)
  const marketplace = await initLocal(home, dir, name)
  const repo = `${marketplace.owner}/${repoFor(marketplace)}`
  console.log(`
\`ttheme new <palette> --from <palette>\` puts palettes in it, and a folder under palettes/ shelves them in a catalog — others see them once it is on GitHub:

  cd ${shownSource(dir)}
  git init -b main && git add -A && git commit -m "${marketplace.id}"
  gh repo create ${repo} --public --source . --push
  gh repo edit ${repo} --add-topic ${TOPIC}

Every push is the marketplace: \`ttheme marketplace add ${repo}\` works anywhere`)
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
    console.error(`  ✗ ${(error as Error).message}`)
    return 1
  }
  const doc = parse(text) as Record<string, unknown>
  const owner = doc.owner as Record<string, unknown>
  for (const key of Object.keys(doc).filter((k) => !MARKETPLACE_KEYS.includes(k))) {
    warnings.push(`${MARKETPLACE_FILE}: unknown key ${key} — ttheme ignores it`)
  }
  for (const key of Object.keys(owner).filter((k) => !OWNER_KEYS.includes(k))) {
    warnings.push(`${MARKETPLACE_FILE}: unknown key owner.${key} — ttheme ignores it`)
  }
  for (const [i, table] of (Array.isArray(doc.catalog) ? (doc.catalog as Record<string, unknown>[]) : []).entries()) {
    for (const key of Object.keys(table).filter((k) => !CATALOG_KEYS.includes(k))) {
      warnings.push(`${MARKETPLACE_FILE}: unknown key catalog[${i}].${key} — ttheme ignores it`)
    }
  }
  if (!info.description) {
    warnings.push(`${MARKETPLACE_FILE}: no description — Browse and the marketplace page show one`)
  }
  const id = marketplaceId(info)
  const entries = readMarketplaceDir(dir, id, officialFor(configHome()), (where, message) =>
    errors.push(`${relative(dir, where)}: ${message.replace(`${basename(where)}: `, '')}`),
  )
  for (const file of marketplaceFiles(dir)) {
    let keys: string[]
    try {
      keys = unknownKeys(file.path, readFileSync(file.path, 'utf8'))
    } catch {
      keys = []
    }
    for (const key of keys) {
      warnings.push(`${relative(dir, file.path)}: unknown key ${key} — ttheme ignores it`)
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
    console.error(`  ✗ ${line}`)
  }
  for (const line of warnings) {
    console.log(`  ! ${line}`)
  }
  const tally = (n: number, what: string) => `${n} ${what}${n === 1 ? '' : 's'}`
  console.log(
    `\n${id} · ${counted(entries.length)} · ${tally(errors.length, 'error')} · ${tally(warnings.length, 'warning')}`,
  )
  return errors.length > 0 ? 1 : 0
}

export async function runMarketplace(action: string | undefined, arg: string | undefined): Promise<number | undefined> {
  switch (action) {
    case undefined:
      listMarketplaces()
      return
    case 'add':
      await addMarketplace(required(action, arg))
      return
    case 'remove':
      removeMarketplace(required(action, arg))
      return
    case 'search':
      await searchMarketplaces(arg)
      return
    case 'init':
      await initMarketplace(arg)
      return
    case 'check':
      return checkMarketplace(arg)
    default:
      throw new Error(`unknown marketplace action ${action} — ${ACTIONS.join(', ')}, or none to list them`)
  }
}

function required(action: string, arg: string | undefined): string {
  if (!arg) {
    throw new Error(
      action === 'add'
        ? 'marketplace add takes a repository or a folder: ttheme marketplace add alice/ttheme-dust'
        : 'marketplace remove takes a marketplace name — `ttheme marketplace` lists them',
    )
  }
  return arg
}

export function localLine(home: string, source: string): string {
  const id = idOf(home, source)
  return `${id} — ${counted(readMarketplaceDir(source, id, official(home), warning(false)).length)}, read in place`
}
