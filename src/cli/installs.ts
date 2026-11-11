import { existsSync } from 'node:fs'
import { type Sort, worldOrder } from '../core/commons.ts'
import { CODE, codeOf, SHARE_URL } from '../core/draft.ts'
import type { Manifest, PaletteEntry } from '../core/manifest.ts'
import { counted } from '../core/text.ts'
import { BUILTIN, nameProblem } from '../core/theme.ts'
import type { Wired } from '../core/wired.ts'
import {
  available,
  find,
  nameOf,
  readKept,
  readMarketplaces,
  refreshCommons,
  untuned,
  updatesOf,
  viewOf,
  writeKept,
} from '../store/available.ts'
import { type Host, systemHost } from '../store/host.ts'
import { type Installed, readInstalled, standingOf } from '../store/installed.ts'
import { configHome } from '../store/paths.ts'
import { fetchCorpus, hasCorpus } from '../store/schemes.ts'
import { installedPath, isLocal, marketplaceSources, shownSource } from '../store/sources.ts'
import { wirings } from '../terminals/index.ts'
import { liveOf } from '../terminals/live.ts'
import { colorless } from '../terminals/osc.ts'
import type { Pointed } from '../terminals/types.ts'
import { PalettePrompt, type PickerScope, promptFx } from '../tui/palette-prompt.ts'
import { pending, say } from '../tui/pending.ts'
import { EXIT, failureOf, InputError } from './answer.ts'
import { adopt, isPaletteFile, type Refused, takeFile } from './craft.ts'
import { bringPictures, followPictures, owedPictures } from './pictures.ts'
import { redrawPictures } from './redraw.ts'
import { attempt, failureLine, updatesLine } from './refresh.ts'
import { initCommand, newerRelease, Replaced, upgradeTo } from './release.ts'
import { commit, pointDefaults, settle, sync } from './sync.ts'
import { behindOf, conflictLine, takes, takeUpstream } from './upstreams.ts'

export function reload(count: number): void {
  say(`\n${counted(count)} installed — open a new tab, or reload your terminal config`)
}

export async function runAdd(asked: string[], into?: string): Promise<void> {
  const link = asked.find((n) => /^https?:\/\//i.test(n.trim()) && !codeOf(n))

  if (link) {
    throw new InputError(`${link} is not a share link — one reads ${SHARE_URL}${CODE}…`)
  }

  const home = configHome()
  let manifest = readMarketplaces(home)
  const shared = new Map<string, PaletteEntry>()
  const refused: Refused[] = []
  const listed: string[] = []

  for (const n of asked) {
    const code = codeOf(n)

    if (isPaletteFile(n)) {
      listed.push(...(await takeFile(home, n, into)))
      manifest = readMarketplaces(home)
    } else if (code) {
      const adopted = await adopt(home, code, manifest, into)
      refused.push(...adopted.refused)

      for (const entry of adopted.entries) {
        shared.set(entry.name, entry)
        listed.push(entry.name)
      }
    } else {
      listed.push(
        nameProblem(n) ? find(untuned(home, manifest, false).palettes, n, readInstalled(home).palettes).name : n,
      )
    }
  }

  const names = [...new Set(listed)]

  if (names.length === 0 && refused.length > 0) {
    throw new Error(refused.map((r) => `${r.name} ${r.why}`).join('\n'))
  }

  for (const r of refused) {
    console.error(`ttheme: left ${r.name} out, since it ${r.why}`)
  }

  const state = readInstalled(home)
  const already = names.filter((n) => state.palettes.includes(n))
  const fresh = names.filter((n) => !state.palettes.includes(n))

  if (fresh.length === 0) {
    sync(home, manifest, state)
    console.log(`Already installed: ${already.join(', ')}`)
    await bringPictures(
      home,
      available(home, manifest, false)
        .palettes.filter((e) => already.includes(e.name))
        .map((e) => owedPictures(home, e)),
      state.terminals,
    )

    return
  }

  const next = { ...state, palettes: [...state.palettes, ...fresh] }
  commit(home, manifest, state, next)

  for (const name of fresh) {
    console.log(`  + ${name}`)
  }

  await bringPictures(
    home,
    available(home, manifest, false)
      .palettes.filter((e) => fresh.includes(e.name))
      .map((e) => {
        const code = shared.get(e.name)

        return code ? { ...e, pictures: code.pictures } : e
      }),
    next.terminals,
  )
  reload(next.palettes.length)
}

export function runDefault(asked: string): void {
  const home = configHome()
  const manifest = readMarketplaces(home)
  const state = readInstalled(home)

  const name = state.palettes.includes(asked)
    ? asked
    : find(untuned(home, manifest, false).palettes, asked, state.palettes).name

  if (!state.palettes.includes(name)) {
    throw new Error(`${name} is not installed — \`ttheme add ${name}\` first`)
  }

  const { off: _, ...rest } = state
  const pointed = commit(home, manifest, state, { ...rest, startup: name }, true)
  console.log(defaultNote(name, state.terminals, pointed).join('\n'))
}

export async function runSync(): Promise<void> {
  const home = configHome()
  const state = readInstalled(home)
  const host = systemHost()
  settle(home, state, host)
  const view = viewOf(home)
  const wait = pending('Drawing the background pictures')
  let failed: unknown

  try {
    await redrawPictures(home, wait.say, undefined, {
      emit: false,
      view,
      step: (done, of) => wait.set(`Drawing the background pictures  ${done}/${of}`),
    })
  } catch (error) {
    failed = error
  } finally {
    wait.done()
  }

  sync(home, view.manifest, state, undefined, host, view)

  if (failed !== undefined) {
    throw failed
  }
}

export function runOn(host: Host = systemHost()): void {
  const home = configHome()
  const state = readInstalled(home)
  const standing = standingOf(state)

  switch (standing.is) {
    case 'empty':
      throw new Error('no palettes installed — `ttheme` picks some')
    case 'on':
      pointDefaults(home, state, false, host)
      console.log(`Already on  ${standing.startup}`)

      return
    case 'off': {
      const { off: _, ...next } = state
      const pointed = commit(home, readMarketplaces(home), state, next, false, host)
      console.log(defaultNote(standing.startup, next.terminals, pointed).join('\n'))
    }
  }
}

function restarts(state: Installed, pointed: ReadonlyMap<Wired, Pointed>): string[] {
  return wirings(state.terminals).flatMap((wiring) =>
    pointed.get(wiring.id)?.restart
      ? [`${wiring.name} new tabs open on your own profile once ${wiring.name} restarts`]
      : [],
  )
}

export function runOff(host: Host = systemHost()): void {
  const home = configHome()
  const state = readInstalled(home)
  const standing = standingOf(state)

  if (state.off) {
    console.log(['Already off', ...restarts(state, pointDefaults(home, state, false, host))].join('\n'))

    return
  }

  const pointed = commit(home, readMarketplaces(home), state, { ...state, off: true }, false, host)

  console.log(
    [
      `Off  new tabs open in the terminal's own colors${standing.is === 'empty' ? '' : ` — \`ttheme on\` uses ${standing.startup} again`}`,
      ...restarts(state, pointed),
    ].join('\n'),
  )
}

function defaultNote(name: string, terminals: Wired[], pointed: ReadonlyMap<Wired, Pointed>): string[] {
  const wearing = wirings(terminals).filter((wiring) => !wiring.defaults)

  const lines =
    wearing.length > 0
      ? [
          `Default ${name}  ${wearing.map((wiring) => wiring.name).join(', ')} open new tabs with it once their config reloads`,
        ]
      : []

  for (const wiring of wirings(terminals)) {
    const profile = wiring.defaults?.profile(name)

    if (profile) {
      lines.push(
        pointed.get(wiring.id)?.restart
          ? `${wiring.name} new tabs open with it once ${wiring.name} restarts — "${profile}" is now its default profile`
          : `${wiring.name} new tabs open with it — "${profile}" is its default profile`,
      )
    }
  }

  return lines.length > 0
    ? lines
    : [`Default ${name}  no terminal is wired to open with it — \`${initCommand()}\` wires one`]
}

function marketplaceNamed(home: string, sources: string[], name: string): string {
  const hit = sources.find((s) => s === name || shownSource(s) === name || nameOf(home, s) === name)

  if (!hit) {
    throw new Error(`no marketplace named ${name} — the Browse tab of \`ttheme\` lists them`)
  }

  return hit
}

export async function runUpdate(asked: string[] = []): Promise<number> {
  const home = configHome()
  const all = marketplaceSources(home)
  const named = asked.map((name) => marketplaceNamed(home, all, name))
  const release = await newerRelease()
  const failures: number[] = release.failed ? [EXIT.failed] : []

  if (release.latest) {
    try {
      return upgradeTo(release.latest, asked)
    } catch (error) {
      failures.push(EXIT.failed)
      console.log(`  ttheme could not update to ${release.latest}: ${(error as Error).message}`)

      if (error instanceof Replaced) {
        return EXIT.failed
      }
    }
  } else {
    console.log(release.note)
  }

  const marketplaces = (named.length > 0 ? named : all).filter((source) => source !== BUILTIN)

  if (named.length === 0 && marketplaces.length === 0) {
    console.log('No marketplaces to update — `ttheme marketplace add <owner>/<repo>` adds one')
  }

  const kept = (source: string, failure: Error): string =>
    `${failureLine(source, failure)} — kept the copy from the last update`

  const works = await refreshCommons(home).catch((failure: Error) => {
    console.log(`  the list of works: ${failure.message} — kept the copy from the last update`)

    return false
  })

  if (hasCorpus(home)) {
    await fetchCorpus(home).catch((failure: Error) => {
      console.log(`  the base schemes: ${failure.message} — kept the copy from the last update`)
    })
  }

  const remote = marketplaces.filter((source) => !isLocal(source))
  const waiting = new Set(remote)
  const line = pending()

  const show = (): void =>
    line.set(
      `Updating ${[...waiting].map(shownSource).join(', ')}${remote.length > 1 ? `  ${remote.length - waiting.size}/${remote.length}` : ''}`,
    )

  show()
  await Promise.all(
    remote.map(async (source) => {
      const failure = await attempt(home, source)
      waiting.delete(source)

      if (waiting.size > 0) {
        show()
      } else {
        line.done()
      }

      if (failure) {
        failures.push(failureOf(failure, false).code)
        line.say(`  ${kept(source, failure)}`)
      }
    }),
  )
  line.done()

  const code = failures.includes(EXIT.network) ? EXIT.network : (failures[0] ?? EXIT.done)

  if (!existsSync(installedPath(home))) {
    return code
  }

  if (works) {
    sync(home, readMarketplaces(home, false), readInstalled(home))
  }

  const updates = updatesLine(home)

  if (updates) {
    console.log(updates)
  }

  return code
}

export async function takeUpdates(home: string, names: string[]): Promise<string[]> {
  const manifest = readMarketplaces(home, false)

  const fresh = new Map(
    updatesOf(home, manifest)
      .filter((e) => names.includes(e.name))
      .map((e) => [e.name, e]),
  )

  const behind = behindOf(home, manifest).filter((b) => names.includes(b.entry.name) && takes(b))

  if (fresh.size === 0 && behind.length === 0) {
    return []
  }

  for (const b of behind) {
    takeUpstream(home, b)
  }

  const was = readKept(home)

  if (fresh.size > 0) {
    writeKept(
      home,
      was.map((e) => fresh.get(e.name) ?? e),
    )
  }

  const state = readInstalled(home)
  sync(home, manifest, state)
  await followPictures(
    home,
    available(home, manifest, false).palettes.filter((e) => fresh.has(e.name)),
    new Map(was.map((e) => [e.name, e.pictures])),
    state.terminals,
  )

  return behind.flatMap((b) => conflictLine(b) ?? [])
}

export async function pickPalettes(
  manifest: Manifest,
  installed: string[],
  scope: PickerScope,
  required = false,
  go?: string,
): Promise<string[] | undefined> {
  const sort: Sort = process.env.TTHEME_SORT === 'cast' ? 'cast' : 'abc'
  const entries = worldOrder(manifest.palettes, manifest.works, sort)
  const tty = process.stdout.isTTY === true
  const live = liveOf(process.env, tty, configHome())
  const saved = live ? await live.saved() : new Map<string, string>()

  const prompt = new PalettePrompt({
    entries,
    works: manifest.works,
    scope,
    installed,
    required,
    ...(go ? { go } : {}),
    color: !colorless(),
    fx: promptFx(process.env.TTHEME_FX),
    onFocus: live ? (entry) => process.stdout.write(live.paint(entry)) : undefined,
  })

  let done: Awaited<ReturnType<PalettePrompt['prompt']>>

  try {
    done = await prompt.prompt()
  } finally {
    if (live) {
      process.stdout.write(live.restore(saved))
    }
  }

  if (done === 'cancel') {
    return undefined
  }

  return manifest.palettes.filter((e) => prompt.picked.has(e.name)).map((e) => e.name)
}
