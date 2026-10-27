import { existsSync, readFileSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Work } from '../core/commons.ts'
import { inMode, listed, type Manifest, type PaletteEntry, toTheme } from '../core/manifest.ts'
import { owned, publisherOf } from '../core/theme.ts'
import type { Wired } from '../core/wired.ts'
import { freshenConfs, paintFor, retint } from '../pictures/backdrop.ts'
import { forgetAppearance, knowAppearance } from '../store/appearance.ts'
import { available, nameOf, nearest, readAvailable, untuned, writeKept } from '../store/available.ts'
import { editUserFile, writeAtomic } from '../store/edits.ts'
import { type Host, systemHost } from '../store/host.ts'
import { type Installed, readInstalled, worn, writeInstalled } from '../store/installed.ts'
import { marketplacesOf } from '../store/sources.ts'
import { readTone, tuned, tunedNames } from '../store/tone.ts'
import { modeFor, modeSetting } from '../store/wiring.ts'
import { readText, themeFiles, tilde } from '../terminals/common.ts'
import { wirings } from '../terminals/index.ts'
import { settingsFor } from '../terminals/terminal.ts'
import type { Ctx, Moment, Now, Out, Pointed } from '../terminals/types.ts'
import { palettesZsh } from './emit-shell.ts'

export function resolve(manifest: Manifest, names: string[]): PaletteEntry[] {
  const known = new Map(manifest.palettes.map((p) => [p.name, p]))
  const missing = names.filter((n) => !known.has(n))

  if (missing.length > 0) {
    const present = new Set(manifest.palettes.map((p) => publisherOf(p.name)))
    const marketplaces = [...new Set(missing.flatMap((n) => publisherOf(n) || [])).difference(present)]

    const hint =
      marketplaces.length > 0
        ? `add ${marketplaces.join(', ')} first — the Browse tab of \`ttheme\` finds a marketplace's repository`
        : nearest(listed(manifest.palettes), missing)

    throw new Error(`not in any marketplace: ${missing.join(', ')} — ${hint}`)
  }

  const wanted = new Set(names)

  return manifest.palettes.filter((p) => wanted.has(p.name))
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
    write(path: string, content: string, aside?: string): boolean {
      written.push(path)

      if (existsSync(path) && readFileSync(path, 'utf8') === content) {
        return false
      }

      writeAtomic(path, content, aside)

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

function layer(ctx: Ctx, host: Host): Record<string, string> {
  return Object.assign({}, ...wirings(ctx.state.terminals).map((wiring) => wiring.layer?.(ctx, host) ?? {}))
}

export function sync(
  configHome: string,
  manifest: Manifest,
  state: Installed,
  home = homedir(),
  host: Host = systemHost(),
): string[] {
  const view = untuned(configHome, manifest)
  const kept = resolve(view, state.palettes)

  if (modeSetting(configHome) === 'auto') {
    knowAppearance(host, !settingsFor(state.terminals).includes('auto'))
  } else {
    forgetAppearance()
  }

  const mode = modeFor(configHome)

  const entries = tuned(
    kept.map((entry) => inMode(entry, mode)),
    readTone(configHome),
  )

  retint(configHome, new Map(entries.map((entry) => [entry.name, paintFor(entry)])))
  freshenConfs(configHome)
  writeKept(configHome, kept)
  const ctx = context(configHome, entries, state, home, host)
  const out = writer(ctx)

  for (const wiring of wirings(state.terminals)) {
    wiring.sync(ctx, out)
  }

  out.written.push(writeTable(ctx, view.works, host, out.repainted))

  return out.written
}

function writeTable(ctx: Ctx, works: readonly Work[], host: Host, repainted: boolean): string {
  const table = join(ctx.configHome, 'ttheme', 'palettes.zsh')

  const content = palettesZsh(ctx.entries, works, {
    startup: ctx.startup,
    terminals: ctx.state.terminals,
    layer: layer(ctx, host),
    tuned: tunedNames(readTone(ctx.configHome), ctx.entries),
    marketplaces: marketplacesOf(ctx.state.marketplaces).map((source) => nameOf(ctx.configHome, source) ?? source),
    mode: {
      worn: modeFor(ctx.configHome),
      auto: modeSetting(ctx.configHome) === 'auto',
      settings: settingsFor(ctx.state.terminals),
    },
  })

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

  const view = readAvailable(configHome)
  const ctx = context(configHome, resolve(view, state.palettes), state, home, host)
  const out = writer(ctx)

  for (const wiring of pictured) {
    wiring.pictures?.(ctx, out)
  }

  writeTable(ctx, view.works, host, false)
}

export function aligns(terminals: readonly Wired[]): boolean {
  return !wirings(terminals).some((wiring) => wiring.bakes)
}

export function wiringPlan(configHome: string, state: Installed, home = homedir()): string[] {
  const at = now(configHome, state, home)

  return wirings(state.terminals).flatMap((wiring) => [
    ...(wiring.shelf ? [`Write ${tilde(wiring.shelf.dir(at), home)}/${owned('*')} — the palettes' theme files`] : []),
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
  manifest: Manifest,
  terminals: Wired[],
  names: string[],
  home = homedir(),
): string[] {
  const removed: string[] = []
  const gone = available(configHome, manifest, false).palettes.filter((p) => names.includes(p.name))

  for (const wiring of wirings(terminals)) {
    const dir = wiring.shelf?.dir({ configHome, home })

    if (!dir) {
      continue
    }

    for (const entry of gone) {
      for (const { file } of themeFiles(wiring, toTheme(entry))) {
        const path = join(dir, file)

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
  manifest: Manifest,
  before: Installed,
  after: Installed,
  take = false,
  host: Host = systemHost(),
  home = homedir(),
): Map<Wired, Pointed> {
  const taking = take || (!worn(before) && worn(after) !== undefined)
  const next = taking ? withBases(configHome, after, host, home) : after
  sync(configHome, manifest, next, home, host)
  writeInstalled(configHome, next)

  return taking || worn(before) !== worn(after) ? pointDefaults(configHome, next, taking, host, home) : new Map()
}
