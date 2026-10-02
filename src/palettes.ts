import { existsSync, readFileSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { backgroundsDir, freshenConfs, paintFor, readStore, retint } from './backdrop.ts'
import { available, nearest, readAvailable, untuned, writeKept } from './catalog.ts'
import { editUserFile, writeAtomic } from './edits.ts'
import { palettesZsh } from './emit/shell.ts'
import { listed, type Manifest, type PaletteEntry, toTheme } from './manifest.ts'
import { installedPath } from './sources.ts'
import { readText, systemHost, themeFiles, tilde } from './terminals/common.ts'
import { WIRED, type Wired, wirings } from './terminals/index.ts'
import type { Ctx, Host, Moment, Now, Out, Pointed } from './terminals/types.ts'
import { marketOf, owned } from './theme.ts'
import { readTone, tuned } from './tone.ts'

export interface Installed {
  terminals: Wired[]
  author?: string
  startup?: string
  off?: true
  itermBase?: string
  konsoleBase?: string
  wtHome?: string
  wtProfile?: string
  markets?: string[]
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
  wtHome: text,
  wtProfile: text,
  markets: (value) => (Array.isArray(value) ? value.filter((m): m is string => typeof m === 'string') : undefined),
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
    const markets = [...new Set(missing.flatMap((n) => marketOf(n) ?? []))].filter(
      (market) => !catalog.palettes.some((p) => marketOf(p.name) === market),
    )
    const hint =
      markets.length > 0
        ? `add ${markets.join(', ')} first — \`ttheme market search\` finds a market's repository`
        : nearest(listed(catalog.palettes), missing)
    throw new Error(`not in any market: ${missing.join(', ')} — ${hint}`)
  }
  return catalog.palettes.filter((p) => names.includes(p.name))
}

function now(configHome: string, state: Installed, home: string): Now {
  return { configHome, home, state, startup: worn(state) }
}

function context(configHome: string, entries: PaletteEntry[], state: Installed, home: string): Ctx {
  return { ...now(configHome, state, home), entries, themes: entries.map(toTheme) }
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
  const ctx = context(configHome, entries, state, home)
  const out = writer(ctx)
  for (const wiring of wirings(state.terminals)) {
    wiring.sync(ctx, out)
  }
  const table = join(configHome, 'ttheme', 'palettes.zsh')
  const content = palettesZsh(entries, ctx.startup, state.terminals, layer(ctx, host))
  if (out.repainted || readText(table) !== content) {
    writeAtomic(table, content)
    rmSync(`${table}.zwc`, { force: true })
  }
  out.written.push(table)
  return out.written
}

export function refreshPictures(configHome: string, home = homedir()): void {
  const state = readInstalled(configHome)
  const pictured = wirings(state.terminals).filter((wiring) => wiring.pictures)
  if (pictured.length === 0) {
    return
  }
  const ctx = context(configHome, resolve(readAvailable(configHome), state.palettes), state, home)
  const out = writer(ctx)
  for (const wiring of pictured) {
    wiring.pictures?.(ctx, out)
  }
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
