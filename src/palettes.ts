import { existsSync, readFileSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { backgroundsDir, freshenConfs, paintFor, readStore, retint } from './backdrop.ts'
import { available, nearest, readAvailable, untuned, writeKept } from './catalog.ts'
import { editUserFile, writeAtomic } from './edits.ts'
import { aliasesZsh, palettesZsh } from './emit/shell.ts'
import { listed, type Manifest, type PaletteEntry, toTheme } from './manifest.ts'
import { paletteAliases } from './names.ts'
import { installedPath } from './sources.ts'
import { readText, systemHost, themeFiles, tilde } from './terminals/common.ts'
import { WIRED, type Wired, wirings } from './terminals/index.ts'
import type { Ctx, Host, Moment, Now, Out, Pointed } from './terminals/types.ts'
import { marketplaceOf, owned } from './theme.ts'
import { readTone, tuned } from './tone.ts'

export interface Installed {
  terminals: Wired[]
  author?: string
  startup?: string
  off?: true
  itermBase?: string
  konsoleBase?: string
  terminalBase?: string
  wtHome?: string
  wtProfile?: string
  marketplaces?: string[]
  updates?: Record<string, boolean>
  palettes: string[]
}

export function startupPalette(state: Installed): string | undefined {
  return state.startup && state.palettes.includes(state.startup) ? state.startup : state.palettes[0]
}

export function worn(state: Installed): string | undefined {
  return state.off ? undefined : startupPalette(state)
}

export function configHome(): string {
  return process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config')
}

type Optional = Exclude<keyof Installed, 'terminals' | 'palettes'>

const text = (value: unknown) => (typeof value === 'string' && value !== '' ? value : undefined)

const OPTIONAL: { [K in Optional]-?: (value: unknown) => Installed[K] } = {
  author: text,
  startup: text,
  off: (value) => (value ? true : undefined),
  itermBase: text,
  konsoleBase: text,
  terminalBase: text,
  wtHome: text,
  wtProfile: text,
  marketplaces: (value) => (Array.isArray(value) ? value.filter((m): m is string => typeof m === 'string') : undefined),
  updates: (value) =>
    value && typeof value === 'object'
      ? Object.fromEntries(
          Object.entries(value).filter((pair): pair is [string, boolean] => typeof pair[1] === 'boolean'),
        )
      : undefined,
}

export function readInstalled(configHome: string): Installed {
  const path = installedPath(configHome)
  if (!existsSync(path)) {
    throw new Error(`nothing installed yet at ${path} — run \`ttheme init\` first`)
  }
  const doc = JSON.parse(readFileSync(path, 'utf8'))
  if (!Array.isArray(doc?.palettes) || !Array.isArray(doc.terminals)) {
    throw new Error(`${path} has no palettes or terminals`)
  }
  return {
    terminals: doc.terminals.filter((t: Wired) => WIRED.includes(t)),
    ...Object.fromEntries(
      Object.entries(OPTIONAL).flatMap(([key, read]) => {
        const value = read(doc[key])
        return value === undefined ? [] : [[key, value]]
      }),
    ),
    palettes: doc.palettes,
  }
}

export function writeInstalled(configHome: string, state: Installed): void {
  writeAtomic(installedPath(configHome), `${JSON.stringify(state, null, 2)}\n`)
}

export function resolve(catalog: Manifest, names: string[]): PaletteEntry[] {
  const known = new Map(catalog.palettes.map((p) => [p.name, p]))
  const missing = names.filter((n) => !known.has(n))
  if (missing.length > 0) {
    const marketplaces = [...new Set(missing.flatMap((n) => marketplaceOf(n) ?? []))].filter(
      (marketplace) => !catalog.palettes.some((p) => marketplaceOf(p.name) === marketplace),
    )
    const hint =
      marketplaces.length > 0
        ? `add ${marketplaces.join(', ')} first — \`ttheme marketplace search\` finds a marketplace's repository`
        : nearest(listed(catalog.palettes), missing)
    throw new Error(`not in any marketplace: ${missing.join(', ')} — ${hint}`)
  }
  return catalog.palettes.filter((p) => names.includes(p.name))
}

function now(configHome: string, state: Installed, home: string): Now {
  return { configHome, home, state, startup: worn(state) }
}

function context(configHome: string, entries: PaletteEntry[], state: Installed, home: string, host: Host): Ctx {
  return { ...now(configHome, state, home), entries, themes: entries.map(toTheme), host }
}

function writer(ctx: Ctx): Out & { written: string[]; repainted: boolean } {
  const written: string[] = []
  const out = {
    written,
    repainted: false,
    write(path: string, content: string): boolean {
      written.push(path)
      if (existsSync(path) && readFileSync(path, 'utf8') === content) {
        return false
      }
      writeAtomic(path, content)
      return true
    },
    wire(path: string, content: string): void {
      written.push(path)
      editUserFile(path, content)
    },
    note(path: string): void {
      written.push(path)
    },
    remove(path: string): void {
      rmSync(path, { force: true })
    },
    themes(wiring: Parameters<Out['themes']>[0]): void {
      const dir = wiring.shelf?.dir(ctx)
      if (!dir) {
        return
      }
      for (const theme of ctx.themes) {
        for (const { file, content } of themeFiles(wiring, theme)) {
          out.write(join(dir, file), content)
        }
      }
    },
    repaint(): void {
      out.repainted = true
    },
  }
  return out
}

function layer(at: Now, host: Host): Record<string, string> {
  return Object.assign({}, ...wirings(at.state.terminals).map((wiring) => wiring.layer?.(at, host) ?? {}))
}

export function sync(
  configHome: string,
  catalog: Manifest,
  state: Installed,
  home = homedir(),
  host: Host = systemHost(),
): string[] {
  readStore(backgroundsDir(configHome))
  const kept = resolve(untuned(configHome, catalog), state.palettes)
  const entries = tuned(kept, readTone(configHome))
  retint(configHome, new Map(entries.map((entry) => [entry.name, paintFor(entry)])))
  freshenConfs(configHome)
  writeKept(configHome, kept)
  const ctx = context(configHome, entries, state, home, host)
  const out = writer(ctx)
  for (const wiring of wirings(state.terminals)) {
    wiring.sync(ctx, out)
  }
  out.written.push(writeTable(ctx, host, out.repainted))
  writeAliases(configHome, entries, home)
  return out.written
}

export function refreshAliases(configHome: string, home = homedir()): void {
  if (!existsSync(join(configHome, 'ttheme', 'palettes.zsh'))) return
  const names = new Set(readInstalled(configHome).palettes)
  writeAliases(
    configHome,
    readAvailable(configHome).palettes.filter((entry) => names.has(entry.name)),
    home,
  )
}

function writeAliases(configHome: string, entries: PaletteEntry[], home: string): void {
  const file = join(configHome, 'ttheme', 'aliases.zsh')
  const content = aliasesZsh(aliasesFor(entries, home))
  if (readText(file) !== content) {
    writeAtomic(file, content)
  }
}

function aliasesFor(entries: PaletteEntry[], home: string): Record<string, string[]> {
  const tags = entries.flatMap((entry) => (entry.booru ? [entry.booru] : []))
  const known = paletteAliases(tags, home)
  const out: Record<string, string[]> = {}
  for (const entry of entries) {
    const own = new Set(entry.nativeNames ?? [])
    const names = (entry.booru ? (known.get(entry.booru) ?? []) : []).filter((name) => !own.has(name))
    if (names.length > 0) out[entry.name] = names
  }
  return out
}

function writeTable(ctx: Ctx, host: Host, repainted: boolean): string {
  const table = join(ctx.configHome, 'ttheme', 'palettes.zsh')
  const content = palettesZsh(
    ctx.entries,
    ctx.startup,
    ctx.state.terminals,
    layer(ctx, host),
    Object.keys(readTone(ctx.configHome)),
  )
  if (repainted || readText(table) !== content) {
    writeAtomic(table, content)
    rmSync(`${table}.zwc`, { force: true })
  }
  return table
}

export function refreshPictures(configHome: string, home = homedir(), host: Host = systemHost()): void {
  const state = readInstalled(configHome)
  const pictured = wirings(state.terminals).filter((wiring) => wiring.pictures)
  if (pictured.length === 0) {
    return
  }
  const ctx = context(configHome, resolve(readAvailable(configHome), state.palettes), state, home, host)
  const out = writer(ctx)
  for (const wiring of pictured) {
    wiring.pictures?.(ctx, out)
  }
  writeTable(ctx, host, false)
}

export function aligns(terminals: readonly Wired[]): boolean {
  return !wirings(terminals).some((wiring) => wiring.bakes)
}

export function wiringPlan(configHome: string, state: Installed, home = homedir()): string[] {
  const at = now(configHome, state, home)
  return wirings(state.terminals).flatMap((wiring) => [
    ...(wiring.shelf ? [`Write ${tilde(wiring.shelf.dir(at), home)}/${owned('*')} — a theme file per palette`] : []),
    ...wiring.plan(at),
  ])
}

export function wiringNotes(configHome: string, state: Installed, home = homedir()): string[] {
  const at = now(configHome, state, home)
  return wirings(state.terminals).flatMap((wiring) => wiring.notes(at))
}

export function wiringNext(
  configHome: string,
  state: Installed,
  pointed: ReadonlyMap<Wired, Pointed>,
  home = homedir(),
): string[] {
  const at = now(configHome, state, home)
  return wirings(state.terminals).flatMap((wiring) => wiring.next(at, pointed.get(wiring.id)))
}

export function forget(
  configHome: string,
  catalog: Manifest,
  terminals: Wired[],
  names: string[],
  home = homedir(),
): string[] {
  const removed: string[] = []
  const known = available(configHome, catalog, false).palettes
  for (const wiring of wirings(terminals)) {
    const dir = wiring.shelf?.dir({ configHome, home })
    for (const entry of dir ? known.filter((p) => names.includes(p.name)) : []) {
      for (const { file } of themeFiles(wiring, toTheme(entry))) {
        const path = join(dir as string, file)
        if (existsSync(path)) {
          rmSync(path, { force: true })
          removed.push(path)
        }
      }
    }
  }
  return removed
}

function moment(configHome: string, state: Installed, host: Host, home: string): Moment {
  return { ...now(configHome, state, home), host }
}

export function withBases(configHome: string, state: Installed, host: Host, home = homedir()): Installed {
  return wirings(state.terminals).reduce(
    (next, wiring) => wiring.defaults?.base(moment(configHome, next, host, home)) ?? next,
    state,
  )
}

export function pointDefaults(
  configHome: string,
  state: Installed,
  take: boolean,
  host: Host,
  home = homedir(),
): Map<Wired, Pointed> {
  const pointed = new Map<Wired, Pointed>()
  for (const wiring of wirings(state.terminals)) {
    const moved = wiring.defaults?.point(moment(configHome, state, host, home), take)
    if (moved) {
      pointed.set(wiring.id, moved)
    }
  }
  return pointed
}

export function commit(
  configHome: string,
  catalog: Manifest,
  before: Installed,
  after: Installed,
  take = false,
  host: Host = systemHost(),
  home = homedir(),
): Map<Wired, Pointed> {
  const taking = take || (!worn(before) && worn(after) !== undefined)
  const next = taking ? withBases(configHome, after, host, home) : after
  sync(configHome, catalog, next, home, host)
  writeInstalled(configHome, next)
  return taking || worn(before) !== worn(after) ? pointDefaults(configHome, next, taking, host, home) : new Map()
}
