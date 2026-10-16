import { existsSync } from 'node:fs'
import { available, nameOf, readKept, readMarketplaces, updatesOf, writeKept } from './available.ts'
import { adopt, type Refused } from './craft.ts'
import { liveOf } from './live.ts'
import { inMode, type Manifest, type PaletteEntry } from './manifest.ts'
import { localLine } from './marketplaces.ts'
import { knowAliases } from './names.ts'
import { colorless } from './osc.ts'
import { codeOf, SHARE_URL } from './own.ts'
import { PalettePrompt, type PickerScope, promptFx } from './palette-prompt.ts'
import { commit, configHome, readInstalled, startupPalette, sync } from './palettes.ts'
import { pending, say } from './pending.ts'
import { bringPictures, since } from './pictures.ts'
import { applyRefreshed, attempt, failureLine, type Refreshed, refreshLine, updatesLine } from './refresh.ts'
import { newerRelease, upgradeTo } from './release.ts'
import { installedPath, isLocal, marketplaceSources, OFFICIAL, shownSource } from './sources.ts'
import { type Wired, wirings } from './terminals/index.ts'
import type { Pointed } from './terminals/types.ts'
import { alphabetical } from './theme.ts'
import { wearFor } from './wiring.ts'

export function reload(count: number): void {
  say(`\n${count} palettes installed — open a new tab, or reload your terminal config`)
}

export async function runAdd(asked: string[]): Promise<void> {
  const link = asked.find((n) => /^https?:\/\//i.test(n.trim()) && !codeOf(n))

  if (link) {
    throw new Error(`${link} is not a share link — one reads ${SHARE_URL}tt4:…`)
  }

  const home = configHome()
  const manifest = readMarketplaces(home)
  const shared = new Map<string, PaletteEntry>()
  const refused: Refused[] = []

  const names = [
    ...new Set(
      asked.flatMap((n) => {
        const code = codeOf(n)

        if (!code) {
          return [n]
        }

        const adopted = adopt(home, code, manifest)
        refused.push(...adopted.refused)

        for (const entry of adopted.entries) {
          shared.set(entry.name, entry)
        }

        return adopted.entries.map((e) => e.name)
      }),
    ),
  ]

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

export function runDefault(name: string): void {
  const home = configHome()
  const manifest = readMarketplaces(home)
  const state = readInstalled(home)

  if (!state.palettes.includes(name)) {
    throw new Error(`${name} is not installed — \`ttheme add ${name}\` first`)
  }

  const { off: _, ...rest } = state
  const pointed = commit(home, manifest, state, { ...rest, startup: name }, true)
  console.log(defaultNote(name, state.terminals, pointed).join('\n'))
}

export function runSync(): void {
  const home = configHome()
  sync(home, readMarketplaces(home), readInstalled(home))
}

export function runOn(): void {
  const home = configHome()
  const state = readInstalled(home)
  const name = startupPalette(state)

  if (!name) {
    throw new Error('no palettes installed — `ttheme` picks some')
  }

  if (!state.off) {
    console.log(`Already on · ${name}`)

    return
  }

  const { off: _, ...next } = state
  const pointed = commit(home, readMarketplaces(home), state, next)
  console.log(defaultNote(name, next.terminals, pointed).join('\n'))
}

export function runOff(): void {
  const home = configHome()
  const state = readInstalled(home)

  if (state.off) {
    console.log('Already off')

    return
  }

  const pointed = commit(home, readMarketplaces(home), state, { ...state, off: true })
  const name = startupPalette(state)
  console.log(`Off · new tabs open in the terminal's own colors${name ? ` — \`ttheme on\` wears ${name} again` : ''}`)

  for (const wiring of wirings(state.terminals)) {
    if (pointed.get(wiring.id)?.restart) {
      console.log(`${wiring.name} new tabs open on your own profile once ${wiring.name} restarts`)
    }
  }
}

function defaultNote(name: string, terminals: Wired[], pointed: ReadonlyMap<Wired, Pointed>): string[] {
  const wearing = wirings(terminals).filter((wiring) => !wiring.defaults)

  const lines =
    wearing.length > 0
      ? [
          `Default ${name} · ${wearing.map((wiring) => wiring.name).join(', ')} open new tabs with it once their config reloads`,
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
    : [`Default ${name} · no terminal is wired to open with it — \`ttheme init\` wires one`]
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
  let stuck = false

  if (release.latest) {
    try {
      return upgradeTo(release.latest, asked)
    } catch (error) {
      stuck = true
      console.log(`  ttheme could not update to ${release.latest}: ${(error as Error).message}`)
    }
  } else {
    console.log(release.note)
  }

  const marketplaces = (named.length > 0 ? named : all).filter((source) => source !== OFFICIAL)

  if (named.length === 0 && marketplaces.length === 0) {
    console.log('No marketplaces to update — `ttheme marketplace add <owner>/<repo>` adds one')
  }

  const kept = (source: string, failure: Error): string =>
    `${failureLine(source, failure)} — kept the copy from the last update`

  for (const source of marketplaces.filter(isLocal)) {
    try {
      console.log(`  ${localLine(home, source)}`)
    } catch (error) {
      console.log(`  ${kept(source, error as Error)}`)
    }
  }

  const remote = marketplaces.filter((source) => !isLocal(source))
  const waiting = new Set(remote)
  const done: Refreshed[] = []
  const line = pending()

  const show = (): void =>
    line.set(
      `Updating ${[...waiting].map(shownSource).join(', ')}${remote.length > 1 ? ` · ${remote.length - waiting.size}/${remote.length}` : ''}`,
    )

  show()
  await Promise.all(
    remote.map(async (source) => {
      const outcome = await attempt(home, source)

      if ('refreshed' in outcome) {
        done.push(outcome.refreshed)
      }

      waiting.delete(source)

      if (waiting.size > 0) {
        show()
      } else {
        line.done()
      }

      line.say(`  ${'refreshed' in outcome ? refreshLine(outcome.refreshed) : kept(source, outcome.failure)}`)
    }),
  )
  line.done()

  if (!existsSync(installedPath(home))) {
    return stuck ? 1 : 0
  }

  for (const moved of applyRefreshed(home, done)) {
    console.log(`  ${moved}`)
  }

  const updates = updatesLine(home)

  if (updates) {
    console.log(updates)
  }

  return stuck ? 1 : 0
}

export async function takeUpdates(home: string, names: string[]): Promise<void> {
  const manifest = readMarketplaces(home, false)

  const fresh = new Map(
    updatesOf(home, manifest)
      .filter((e) => names.includes(e.name))
      .map((e) => [e.name, e]),
  )

  if (fresh.size === 0) {
    return
  }

  const was = readKept(home)
  writeKept(
    home,
    was.map((e) => fresh.get(e.name) ?? e),
  )
  const state = readInstalled(home)
  sync(home, manifest, state)
  const pictures = new Map(was.map((e) => [e.name, e.pictures]))
  await bringPictures(
    home,
    available(home, manifest, false)
      .palettes.filter((e) => fresh.has(e.name))
      .map((e) => since(e, pictures.get(e.name))),
    state.terminals,
  )
}

export async function pickPalettes(
  manifest: Manifest,
  installed: string[],
  scope: PickerScope,
  required = false,
  go?: string,
): Promise<string[] | undefined> {
  const wear = wearFor(configHome())
  const worn = manifest.palettes.map((entry) => inMode(entry, wear))
  const entries = process.env.TTHEME_SORT === 'catalog' ? worn : alphabetical(worn)
  knowAliases(entries)
  const tty = process.stdout.isTTY === true
  const live = liveOf(process.env, tty, configHome())
  const saved = live ? await live.saved() : new Map<string, string>()

  const prompt = new PalettePrompt({
    entries,
    scope,
    installed,
    required,
    ...(go ? { go } : {}),
    color: !colorless(),
    fx: promptFx(process.env.TTHEME_FX),
    onFocus: live ? (entry) => process.stdout.write(live.paint(entry)) : undefined,
  })

  const done = await prompt.prompt()

  if (live) {
    process.stdout.write(live.restore(saved))
  }

  if (done === 'cancel') {
    return undefined
  }

  return manifest.palettes.filter((e) => prompt.picked.has(e.name)).map((e) => e.name)
}
