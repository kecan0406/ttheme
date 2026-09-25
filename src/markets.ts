import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { basename, join } from 'node:path'
import * as p from '@clack/prompts'
import {
  catalogPath,
  fetchParsed,
  Limited,
  type MarketIndex,
  Missing,
  parseCatalog,
  parseIndex,
  REGISTRY_URL,
  readCatalog,
  writeCatalog,
} from './catalog.ts'
import { writeAtomic } from './edits.ts'
import { emptyManifest, listed, type PaletteEntry, paletteEntry } from './emit/manifest.ts'
import { gateLines, type LocalMarket, localMarkets, palettesDir, readMarketDir, readOwnText } from './own.ts'
import { configHome, type Installed, readInstalled, sync, writeInstalled } from './palettes.ts'
import {
  cachePath,
  defaultLocal,
  INDEX,
  isLocal,
  isRemote,
  localOwner,
  marketName,
  marketsOf,
  OFFICIAL,
  parseSource,
  REPO,
  rawUrl,
  remoteOwner,
  shownSource,
  TOPIC,
} from './sources.ts'
import { ownerOf, type Theme } from './theme.ts'

const HANDLE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const ACTIONS = ['add', 'remove', 'search', 'init']

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
      message: 'your GitHub handle — your palettes are named <palette>@<handle>',
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
  console.log(`your palettes are named <palette>@${author}`)
  return author
}

function counted(n: number): string {
  return `${n} palette${n === 1 ? '' : 's'}`
}

function nameOf(source: string): string | undefined {
  try {
    return marketName(source)
  } catch {
    return undefined
  }
}

function official(home: string): PaletteEntry[] {
  return readCatalog(home).palettes.filter((e) => ownerOf(e.name) === undefined)
}

function officialFor(home: string): PaletteEntry[] {
  const path = join(import.meta.dirname, '..', 'dist', 'manifest.json')
  return existsSync(path) ? parseCatalog(readFileSync(path, 'utf8')).palettes : official(home)
}

async function fetchIndex(source: string): Promise<MarketIndex> {
  try {
    return await fetchParsed(rawUrl(source), parseIndex)
  } catch (error) {
    if (error instanceof Missing) {
      throw new Error(`github.com/${source} has no ${INDEX} — is the repository public, and has its action run?`)
    }
    throw error
  }
}

function register(home: string, source: string, name: string): string[] {
  const state = readInstalled(home)
  const sources = marketsOf(state.markets)
  const taken = sources.find((s) => s !== source && nameOf(s) === name)
  if (taken) {
    throw new Error(
      `${name} already names the market at ${shownSource(taken)} — \`ttheme market remove ${name}\` first`,
    )
  }
  if (!sources.includes(source)) {
    writeInstalled(home, { ...state, markets: [...sources, source] })
  }
  return sources
}

async function addMarket(arg: string): Promise<void> {
  const home = configHome()
  const source = parseSource(arg)
  if (marketsOf(readInstalled(home).markets).includes(source)) {
    console.log(`${shownSource(source)} is already added`)
    return
  }
  if (source === OFFICIAL) {
    const catalog = await fetchParsed(REGISTRY_URL, parseCatalog)
    register(home, source, OFFICIAL)
    writeCatalog(home, catalog)
    console.log(`added the ttheme catalog — ${counted(listed(catalog.palettes).length)} · \`ttheme browse\` picks them`)
    return
  }
  if (isLocal(source)) {
    const owner = localOwner(source)
    register(home, source, owner)
    const count = readMarketDir(source, owner, official(home)).length
    console.log(`added ${owner} · ${source} — ${counted(count)}, read in place`)
    console.log('\n`ttheme browse` picks them · `ttheme market build` there writes the index others fetch')
    return
  }
  const index = await fetchIndex(source)
  const owner = remoteOwner(source)
  register(home, source, owner)
  mkdirSync(join(home, 'ttheme', 'markets'), { recursive: true })
  writeAtomic(cachePath(home, source), `${JSON.stringify(index, null, 2)}\n`)
  console.log(`added ${owner} · ${shownSource(source)} — ${counted(index.palettes.length)}`)
  console.log(`\n\`ttheme browse\` picks them, or \`ttheme add <palette>@${owner}\``)
}

function removeMarket(name: string): void {
  const home = configHome()
  const state = readInstalled(home)
  const sources = marketsOf(state.markets)
  const source = sources.find((s) => nameOf(s) === name) ?? sources.find((s) => s === parseSourceOrNot(name))
  if (!source) {
    throw new Error(`no market named ${name} — \`ttheme market\` lists them`)
  }
  const kept = state.palettes.filter((n) => (ownerOf(n) ?? OFFICIAL) === nameOf(source))
  const next = { ...state, markets: sources.filter((s) => s !== source) }
  writeInstalled(home, next)
  if (source === OFFICIAL) {
    rmSync(catalogPath(home), { force: true })
  } else if (isRemote(source)) {
    rmSync(cachePath(home, source), { force: true })
  }
  sync(home, readCatalog(home), next)
  console.log(`removed ${name} · ${shownSource(source)}`)
  if (kept.length > 0) {
    console.log(`${counted(kept.length)} installed from it keep working — \`ttheme remove\` drops them`)
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
      return listed(parseCatalog(readFileSync(catalogPath(home), 'utf8')).palettes).length
    }
    if (isLocal(source)) {
      return readMarketDir(source, localOwner(source), official(home), false).length
    }
    return parseIndex(readFileSync(cachePath(home, source), 'utf8')).palettes.length
  } catch {
    return undefined
  }
}

function listMarkets(): void {
  const home = configHome()
  const state = readInstalled(home)
  const sources = marketsOf(state.markets)
  if (sources.length === 0) {
    console.log('no markets — `ttheme market add official` brings the ttheme catalog back')
    return
  }
  const rows = sources.map((source) => {
    const name = nameOf(source) ?? '?'
    const count = countOf(home, source)
    const installed = state.palettes.filter((n) => (ownerOf(n) ?? OFFICIAL) === name).length
    return {
      name,
      where: shownSource(source),
      note: count === undefined ? 'unreadable' : `${counted(count)}${installed > 0 ? ` · ${installed} installed` : ''}`,
    }
  })
  const nameWidth = Math.max(...rows.map((r) => r.name.length))
  const whereWidth = Math.max(...rows.map((r) => r.where.length))
  for (const r of rows) {
    console.log(`  ${r.name.padEnd(nameWidth)}  ${r.where.padEnd(whereWidth)}  ${r.note}`)
  }
}

interface Repository {
  full_name: string
  name: string
  description: string | null
  stargazers_count: number
  owner: { login: string }
}

async function searchRepositories(q: string): Promise<Repository[]> {
  try {
    const { items } = await fetchParsed(
      `https://api.github.com/search/repositories?q=${q}&sort=stars&per_page=50`,
      (text) => JSON.parse(text) as { items: Repository[] },
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
  const q = encodeURIComponent(`topic:${TOPIC}${query ? ` ${query}` : ''}`)
  const items = await searchRepositories(q)
  if (items.length === 0) {
    console.log(`no repository carries the ${TOPIC} topic${query ? ` and matches ${query}` : ''} yet`)
    return
  }
  const added = new Set(marketsOf(readInstalled(home).markets))
  const rows = items.map((r) => {
    const owner = r.owner.login.toLowerCase()
    return {
      arg: r.name === REPO ? owner : `${owner}/${r.name}`,
      added: added.has(`${owner}/${r.name}`),
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

const WORKFLOW = `name: ttheme market

on:
  push:
    paths: ["palettes/**"]
  workflow_dispatch:

permissions:
  contents: write

jobs:
  index:
    runs-on: ubuntu-latest
    steps:
      - uses: kecan0406/ttheme/market@v1
`

function scaffold(dir: string, owner: string): void {
  mkdirSync(palettesDir(dir), { recursive: true })
  mkdirSync(join(dir, '.github', 'workflows'), { recursive: true })
  writeIndex(dir, owner, [])
  writeAtomic(join(dir, '.github', 'workflows', 'ttheme.yml'), WORKFLOW)
  writeAtomic(
    join(dir, 'README.md'),
    `# ${owner}'s ttheme palettes\n\nPalettes for [ttheme](https://github.com/kecan0406/ttheme):\n\n\`\`\`sh\nttheme market add ${owner}\nttheme browse\n\`\`\`\n`,
  )
}

function writeIndex(dir: string, owner: string, palettes: PaletteEntry[]): void {
  const { version, gate, placement } = emptyManifest()
  const index: MarketIndex = { version, gate, placement, owner, palettes }
  writeAtomic(join(dir, INDEX), `${JSON.stringify(index, null, 2)}\n`)
}

export async function ensureLocal(home: string, into?: string): Promise<LocalMarket> {
  const locals = localMarkets(home)
  if (into) {
    const dir = parseSource(into)
    const hit = locals.find((m) => m.dir === dir || m.owner === into)
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
    throw new Error(`you have ${locals.length} local markets — --in names one: ${locals.map((m) => m.dir).join(', ')}`)
  }
  return initLocal(home, defaultLocal(home))
}

async function initLocal(home: string, dir: string): Promise<LocalMarket> {
  const fresh = !existsSync(join(dir, INDEX))
  const owner = fresh ? await handle(home, readInstalled(home)) : localOwner(dir)
  if (fresh) {
    if (existsSync(dir) && readdirSync(dir).length > 0) {
      throw new Error(`${dir} is not empty — pick a new folder for the market`)
    }
    scaffold(dir, owner)
  }
  register(home, dir, owner)
  console.log(`${fresh ? 'made' : 'added'} your market ${owner} · ${dir}`)
  return { dir, owner }
}

async function initMarket(arg: string | undefined): Promise<void> {
  const home = configHome()
  const dir = arg ? parseSource(arg) : defaultLocal(home)
  if (!isLocal(dir)) {
    throw new Error('market init takes a folder: ttheme market init ./my-palettes')
  }
  const { owner } = await initLocal(home, dir)
  console.log(`
\`ttheme new <name> --from <palette>\` puts palettes in it — others see them once it is on GitHub:

  gh repo create ${owner}/${REPO} --public --source ${dir} --push
  gh repo edit ${owner}/${REPO} --add-topic ${TOPIC}

its action rebuilds ${INDEX} on every push; then \`ttheme market add ${owner}\` works anywhere`)
}

function buildMarket(arg: string | undefined): number {
  const dir = arg ? parseSource(arg) : process.cwd()
  const owner = localOwner(dir)
  const entries = officialFor(configHome())
  const folder = palettesDir(dir)
  const files = (existsSync(folder) ? readdirSync(folder).sort() : []).filter((f) => f.endsWith('.toml'))
  const themes: Theme[] = []
  const broken: string[] = []
  for (const file of files) {
    const slug = basename(file, '.toml')
    try {
      themes.push({ ...readOwnText(`${slug}@${owner}`, readFileSync(join(folder, file), 'utf8'), entries), name: slug })
    } catch (error) {
      broken.push(`  ${join('palettes', file)}: ${(error as Error).message}`)
    }
  }
  if (broken.length > 0) {
    console.error(`${broken.length} palettes cannot be read — the index was left as it was:\n${broken.join('\n')}`)
    return 1
  }
  const palettes = themes.map(paletteEntry)
  for (const entry of palettes) {
    const lines = gateLines(entry)
    const failing = lines.filter((l) => l.startsWith('  ✗'))
    console.log(`  ${entry.name}${failing.length > 0 ? `\n${failing.join('\n')}` : '  passes the gate'}`)
  }
  writeIndex(dir, owner, palettes)
  console.log(`\n${owner} · ${counted(palettes.length)} → ${join(dir, INDEX)}`)
  return 0
}

export async function runMarket(action: string | undefined, arg: string | undefined): Promise<number | undefined> {
  switch (action) {
    case undefined:
      listMarkets()
      return undefined
    case 'add':
      await addMarket(required(action, arg))
      return undefined
    case 'remove':
      removeMarket(required(action, arg))
      return undefined
    case 'search':
      await searchMarkets(arg)
      return undefined
    case 'init':
      await initMarket(arg)
      return undefined
    case 'build':
      return buildMarket(arg)
    default:
      throw new Error(`unknown market action ${action} — ${ACTIONS.join(', ')}, or none to list them`)
  }
}

function required(action: string, arg: string | undefined): string {
  if (!arg) {
    throw new Error(
      action === 'add'
        ? 'market add takes a GitHub handle, a repository or a folder: ttheme market add alice'
        : 'market remove takes a market name — `ttheme market` lists them',
    )
  }
  return arg
}

export async function refresh(home: string, source: string): Promise<string> {
  if (source === OFFICIAL) {
    const before = existsSync(catalogPath(home))
      ? listed(parseCatalog(readFileSync(catalogPath(home), 'utf8')).palettes).length
      : 0
    const catalog = await fetchParsed(REGISTRY_URL, parseCatalog)
    writeCatalog(home, catalog)
    const count = listed(catalog.palettes).length
    return `${OFFICIAL} ${catalog.version} — ${counted(count)}${count > before ? ` (+${count - before})` : ''}`
  }
  if (isLocal(source)) {
    const owner = localOwner(source)
    return `${owner} — ${counted(readMarketDir(source, owner, official(home), false).length)}, read in place`
  }
  const index = await fetchIndex(source)
  mkdirSync(join(home, 'ttheme', 'markets'), { recursive: true })
  writeAtomic(cachePath(home, source), `${JSON.stringify(index, null, 2)}\n`)
  return `${remoteOwner(source)} — ${counted(index.palettes.length)}`
}
