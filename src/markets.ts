import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { basename, join, relative } from 'node:path'
import * as p from '@clack/prompts'
import { parse } from 'smol-toml'
import {
  archiveId,
  catalogPath,
  fetchParsed,
  Limited,
  parseCatalog,
  readArchive,
  readCachedArchive,
  readCatalog,
} from './catalog.ts'
import { writeAtomic } from './edits.ts'
import { listed, type PaletteEntry } from './manifest.ts'
import { gateLines, type LocalMarket, localMarkets, marketFiles, palettesDir, readMarketDir, warning } from './own.ts'
import { configHome, type Installed, readInstalled, sync, writeInstalled } from './palettes.ts'
import { pending } from './pending.ts'
import { ago, cachedMarket, counted, type Fetched, fetchedAt, fetchMarket, readTries, storeMarket } from './refresh.ts'
import { renameProblems } from './renames.ts'
import {
  autoUpdates,
  cachePath,
  defaultLocal,
  type Identity,
  isLocal,
  isRemote,
  localIdentity,
  MARKET_FILE,
  MARKET_KEYS,
  marketId,
  marketsOf,
  marketToml,
  OFFICIAL,
  OWNER_KEYS,
  parseSource,
  refOf,
  repoOf,
  sameMarket,
  shownSource,
  TOPIC,
} from './sources.ts'
import { marketOf, nameProblem, slugOf, unknownKeys } from './theme.ts'

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

export async function handle(home: string, state: Installed): Promise<string> {
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
      message: 'Your GitHub handle — your palettes are named <handle>@<market>/<palette>',
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
  console.log(`Your palettes are named ${author}@<market>/<palette>`)
  return author
}

export function idOf(home: string, source: string): string {
  if (source === OFFICIAL) {
    return OFFICIAL
  }
  return isLocal(source) ? marketId(localIdentity(source)) : archiveId(source, readCachedArchive(home, source))
}

function nameOf(home: string, source: string): string | undefined {
  try {
    return idOf(home, source)
  } catch {
    return undefined
  }
}

function marketOfPalette(name: string): string {
  return marketOf(name) ?? OFFICIAL
}

function official(home: string): PaletteEntry[] {
  return readCatalog(home).palettes.filter((e) => marketOf(e.name) === undefined)
}

function officialFor(home: string): PaletteEntry[] {
  const path = join(import.meta.dirname, '..', 'dist', 'manifest.json')
  return existsSync(path) ? parseCatalog(readFileSync(path, 'utf8')).palettes : official(home)
}

export function withMarkets(state: Installed, markets: string[], updates: Record<string, boolean>): Installed {
  const { updates: _, ...rest } = state
  const kept = Object.entries(updates).filter(
    ([source, on]) => markets.includes(source) && on !== autoUpdates(source, {}),
  )
  return { ...rest, markets, ...(kept.length > 0 ? { updates: Object.fromEntries(kept) } : {}) }
}

export function nameTaken(home: string, sources: string[], source: string, name: string): string | undefined {
  return sources.find((s) => s !== source && !sameMarket(s, source) && nameOf(home, s) === name)
}

function register(home: string, source: string, name: string, auto?: boolean): void {
  const state = readInstalled(home)
  const sources = marketsOf(state.markets)
  const taken = nameTaken(home, sources, source, name)
  if (taken) {
    throw new Error(
      `${name} already names the market at ${shownSource(taken)} — \`ttheme market remove ${name}\` first`,
    )
  }
  const updates = auto === undefined ? { ...state.updates } : { ...state.updates, [source]: auto }
  writeInstalled(home, withMarkets(state, sources.includes(source) ? sources : [...sources, source], updates))
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
    return await fetchMarket(home, source)
  } finally {
    line.done()
  }
}

async function repin(home: string, was: string, source: string): Promise<Fetched> {
  const fetched = await fetching(home, source)
  const state = readInstalled(home)
  const sources = marketsOf(state.markets)
  const taken = nameTaken(home, sources, source, fetched.id)
  if (taken) {
    throw new Error(
      `${fetched.id} already names the market at ${shownSource(taken)} — \`ttheme market remove ${fetched.id}\` first`,
    )
  }
  const { [was]: auto, ...others } = state.updates ?? {}
  const updates = auto === undefined ? others : { ...others, [source]: auto }
  writeInstalled(
    home,
    withMarkets(
      state,
      sources.map((s) => (s === was ? source : s)),
      updates,
    ),
  )
  storeMarket(home, fetched)
  return fetched
}

export async function addSource(home: string, arg: string): Promise<{ source: string; id: string; fresh: boolean }> {
  const source = parseSource(arg)
  const sources = marketsOf(readInstalled(home).markets)
  if (sources.includes(source)) {
    console.log(`${shownSource(source)} is already added`)
    return { source, id: idOf(home, source), fresh: false }
  }
  const was = isRemote(source) ? sources.find((s) => isRemote(s) && sameMarket(s, source)) : undefined
  if (was) {
    const fetched = await repin(home, was, source)
    console.log(
      `Moved ${fetched.id} to ${refOf(source) ?? 'its default branch'} · ${shownSource(source)} — ${counted(listed(fetched.entries).length)}`,
    )
    return { source, id: fetched.id, fresh: false }
  }
  if (isLocal(source)) {
    const id = marketId(localIdentity(source))
    register(home, source, id)
    const count = readMarketDir(source, id, official(home)).length
    console.log(`Added ${id} · ${shownSource(source)} — ${counted(count)}, read in place`)
    return { source, id, fresh: true }
  }
  const fetched = await fetching(home, source)
  const auto = source === OFFICIAL ? undefined : await askAuto(fetched.id)
  register(home, source, fetched.id, auto)
  storeMarket(home, fetched)
  const count = counted(listed(fetched.entries).length)
  console.log(
    source === OFFICIAL
      ? `Added the ttheme catalog — ${count}`
      : `Added ${fetched.id} · ${shownSource(source)} — ${count}${auto ? ', updating on its own' : ''}`,
  )
  return { source, id: fetched.id, fresh: true }
}

async function addMarket(arg: string): Promise<void> {
  const home = configHome()
  const { source, id, fresh } = await addSource(home, arg)
  if (!fresh) {
    return
  }
  if (isLocal(source)) {
    console.log(
      '\n`ttheme browse` picks them · once the folder is on GitHub, `ttheme market add <owner>/<repo>` adds it anywhere',
    )
  } else if (source === OFFICIAL) {
    console.log('\n`ttheme browse` picks them')
  } else {
    console.log(`\n\`ttheme browse\` picks them, or \`ttheme add ${id}/<palette>\``)
  }
}

export function dropCache(home: string, source: string): void {
  if (source === OFFICIAL) {
    rmSync(catalogPath(home), { force: true })
  } else if (isRemote(source)) {
    rmSync(cachePath(home, source), { force: true })
  }
}

export function keptNote(kept: string[]): string {
  return `${counted(kept.length)} installed from it keep${kept.length === 1 ? 's' : ''} working: ${kept.join(', ')} — \`ttheme remove\` drops ${kept.length === 1 ? 'it' : 'them'}`
}

function removeMarket(name: string): void {
  const home = configHome()
  const state = readInstalled(home)
  const sources = marketsOf(state.markets)
  const source = sources.find((s) => nameOf(home, s) === name) ?? sources.find((s) => s === parseSourceOrNot(name))
  if (!source) {
    throw new Error(`no market named ${name} — \`ttheme market\` lists them`)
  }
  const id = nameOf(home, source)
  const kept = state.palettes.filter((n) => marketOfPalette(n) === id)
  const remaining = sources.filter((s) => s !== source)
  const next = withMarkets(state, remaining, state.updates ?? {})
  writeInstalled(home, next)
  dropCache(home, source)
  sync(home, readCatalog(home), next)
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

export function countOf(home: string, source: string): number | undefined {
  try {
    if (source === OFFICIAL) {
      return listed(parseCatalog(readFileSync(catalogPath(home), 'utf8')).palettes).length
    }
    if (isLocal(source)) {
      return readMarketDir(source, idOf(home, source), official(home), warning(false)).length
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
  const failed = tries[source]
  const at = fetchedAt(home, source)
  if (failed && (at === undefined || failed.at > at)) {
    return `update failed ${ago(failed.at, now)}`
  }
  return at === undefined ? 'never updated' : `updated ${ago(at, now)}`
}

function listMarkets(): void {
  const home = configHome()
  const state = readInstalled(home)
  const sources = marketsOf(state.markets)
  if (sources.length === 0) {
    console.log('No markets — `ttheme market add official` brings the ttheme catalog back')
    return
  }
  const tries = readTries()
  const rows = sources.map((source) => {
    const name = nameOf(home, source) ?? '?'
    const count = countOf(home, source)
    const installed = state.palettes.filter((n) => marketOfPalette(n) === name).length
    const auto = isLocal(source) ? [] : [`auto-update ${autoUpdates(source, state.updates) ? 'on' : 'off'}`]
    const about = source === OFFICIAL ? undefined : cachedMarket(home, source)?.info.description
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

export interface Repository {
  full_name: string
  name: string
  description: string | null
  stargazers_count: number
  owner: { login: string }
}

export function repositorySource(r: Repository): string {
  return `${r.owner.login.toLowerCase()}/${r.name}`
}

export async function findMarkets(query: string | undefined, signal?: AbortSignal): Promise<Repository[]> {
  const q = encodeURIComponent(`topic:${TOPIC}${query ? ` ${query}` : ''}`)
  try {
    const { items } = await fetchParsed(
      `https://api.github.com/search/repositories?q=${q}&sort=stars&per_page=50`,
      (text) => JSON.parse(text) as { items: Repository[] },
      undefined,
      signal,
    )
    return items
  } catch (error) {
    if (error instanceof Limited) {
      throw new Error(
        'GitHub lets a search through about ten times a minute without signing in — try again in a minute',
      )
    }
    throw error
  }
}

async function searchMarkets(query: string | undefined): Promise<void> {
  const home = configHome()
  const items = await findMarkets(query)
  if (items.length === 0) {
    console.log(`No repository carries the ${TOPIC} topic${query ? ` and matches ${query}` : ''} yet`)
    return
  }
  const added = new Set(marketsOf(readInstalled(home).markets).map(repoOf))
  const rows = items.map((r) => {
    const arg = repositorySource(r)
    return {
      arg,
      added: added.has(arg),
      stars: `★${r.stargazers_count}`,
      about: r.description ?? '',
    }
  })
  const width = Math.max(...rows.map((r) => r.arg.length))
  for (const r of rows) {
    console.log(`  ${r.added ? '●' : '○'} ${r.arg.padEnd(width)}  ${r.stars.padStart(5)}  ${r.about}`)
  }
  console.log('\n`ttheme market add <name>` adds one')
}

function repoFor({ name }: Identity): string {
  return `ttheme-${name}`
}

function scaffold(dir: string, identity: Identity): void {
  mkdirSync(palettesDir(dir), { recursive: true })
  writeAtomic(join(dir, MARKET_FILE), marketToml(identity))
  writeAtomic(
    join(dir, 'README.md'),
    `# ${marketId(identity)}\n\nA [ttheme](https://github.com/kecan0406/ttheme) market:\n\n\`\`\`sh\nttheme market add ${identity.owner}/${repoFor(identity)}\nttheme browse\n\`\`\`\n`,
  )
}

function nameProblemOf(name: string): string | undefined {
  return nameProblem(`x@${name}/x`) ? 'takes lowercase letters, digits and single hyphens' : undefined
}

async function askName(): Promise<string> {
  if (!tty()) {
    throw new Error('name the market: ttheme market init <name>, or --in <name> on new')
  }
  const typed = await p.text({
    message: "Your market's name — its palettes are <you>@<name>/<palette>",
    validate: (value) => nameProblemOf((value ?? '').toLowerCase()),
  })
  if (p.isCancel(typed)) {
    throw new Error('no market name given')
  }
  return typed.toLowerCase()
}

export async function ensureLocal(home: string, into?: string): Promise<LocalMarket> {
  const locals = localMarkets(home)
  if (into) {
    const hit = locals.find((m) => m.name === into || m.id === into || m.dir === parseSourceOrNot(into))
    if (!hit) {
      throw new Error(`${into} is not one of your local markets — \`ttheme market init ${into}\` makes it one`)
    }
    return hit
  }
  const [only, ...more] = locals
  if (only && more.length === 0) {
    return only
  }
  if (only) {
    throw new Error(`you have ${locals.length} local markets — --in names one: ${locals.map((m) => m.name).join(', ')}`)
  }
  const name = await askName()
  return initLocal(home, defaultLocal(home, name), name)
}

async function initLocal(home: string, dir: string, name: string): Promise<LocalMarket> {
  const fresh = !existsSync(join(dir, MARKET_FILE))
  let identity: Identity
  if (fresh) {
    const problem = nameProblemOf(name)
    if (problem) {
      throw new Error(`the market name ${name} ${problem}`)
    }
    if (existsSync(dir) && readdirSync(dir).length > 0) {
      throw new Error(`${dir} is not empty — pick a new folder for the market`)
    }
    identity = { owner: await handle(home, readInstalled(home)), name }
    scaffold(dir, identity)
  } else {
    identity = localIdentity(dir)
  }
  const id = marketId(identity)
  register(home, dir, id)
  console.log(`${fresh ? 'Made' : 'Added'} your market ${id} · ${shownSource(dir)}`)
  return { dir, ...identity, id }
}

function pathLike(arg: string): boolean {
  return arg.startsWith('.') || arg.startsWith('/') || arg.startsWith('~')
}

async function initMarket(arg: string | undefined): Promise<void> {
  const home = configHome()
  const name =
    arg && !pathLike(arg) ? arg.toLowerCase() : arg ? basename(parseSource(arg)).toLowerCase() : await askName()
  const dir = arg && pathLike(arg) ? parseSource(arg) : defaultLocal(home, name)
  const market = await initLocal(home, dir, name)
  const repo = `${market.owner}/${repoFor(market)}`
  console.log(`
\`ttheme new <palette> --from <palette>\` puts palettes in it, and a folder under palettes/ shelves them in a catalog — others see them once it is on GitHub:

  cd ${shownSource(dir)}
  git init -b main && git add -A && git commit -m "${market.id}"
  gh repo create ${repo} --public --source . --push
  gh repo edit ${repo} --add-topic ${TOPIC}

Every push is the market: \`ttheme market add ${repo}\` works anywhere`)
}

function checkMarket(arg: string | undefined): number {
  const dir = arg ? parseSource(arg) : process.cwd()
  const path = join(dir, MARKET_FILE)
  if (!existsSync(path)) {
    throw new Error(`${shownSource(dir)} has no ${MARKET_FILE} — \`ttheme market init ${shownSource(dir)}\` makes one`)
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
  for (const key of Object.keys(doc).filter((k) => !MARKET_KEYS.includes(k))) {
    warnings.push(`${MARKET_FILE}: unknown key ${key} — ttheme ignores it`)
  }
  for (const key of Object.keys(owner).filter((k) => !OWNER_KEYS.includes(k))) {
    warnings.push(`${MARKET_FILE}: unknown key owner.${key} — ttheme ignores it`)
  }
  if (!info.description) {
    warnings.push(`${MARKET_FILE}: no description — browse and the market page show one`)
  }
  const id = marketId(info)
  const entries = readMarketDir(dir, id, officialFor(configHome()), (where, message) =>
    errors.push(`${relative(dir, where)}: ${message.replace(`${basename(where)}: `, '')}`),
  )
  for (const file of marketFiles(dir)) {
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
  const renames = renameProblems(info.renames, new Set(entries.map((e) => slugOf(e.name))))
  errors.push(...renames.errors.map((e) => `${MARKET_FILE}: ${e}`))
  warnings.push(...renames.warnings.map((w) => `${MARKET_FILE}: ${w}`))
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

export async function runMarket(action: string | undefined, arg: string | undefined): Promise<number | undefined> {
  switch (action) {
    case undefined:
      listMarkets()
      return
    case 'add':
      await addMarket(required(action, arg))
      return
    case 'remove':
      removeMarket(required(action, arg))
      return
    case 'search':
      await searchMarkets(arg)
      return
    case 'init':
      await initMarket(arg)
      return
    case 'check':
      return checkMarket(arg)
    default:
      throw new Error(`unknown market action ${action} — ${ACTIONS.join(', ')}, or none to list them`)
  }
}

function required(action: string, arg: string | undefined): string {
  if (!arg) {
    throw new Error(
      action === 'add'
        ? 'market add takes a repository or a folder: ttheme market add alice/ttheme-dust'
        : 'market remove takes a market name — `ttheme market` lists them',
    )
  }
  return arg
}

export function localLine(home: string, source: string): string {
  const id = idOf(home, source)
  return `${id} — ${counted(readMarketDir(source, id, official(home), warning(false)).length)}, read in place`
}
