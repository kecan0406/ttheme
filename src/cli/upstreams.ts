import type { Manifest, PaletteEntry } from '../core/manifest.ts'
import { type Mode, modeOf, otherOf } from '../core/mode.ts'
import { recolor } from '../core/own.ts'
import type { Colors } from '../core/seeds.ts'
import { listOf, SLOT_NAMES } from '../core/slots.ts'
import { type Following, following, moves, type Sides, sidesOf } from '../core/upstream.ts'
import { readInstalled } from '../store/installed.ts'
import { ownFile, readLocal, writeOwn } from '../store/local.ts'

export interface Behind {
  entry: PaletteEntry
  theirs: Sides
  done: Following
}

export interface Clash {
  against: string
  slots: number[]
  original: Colors
  table: string
  base: Colors
}

export function behindOf(home: string, manifest: Manifest): Behind[] {
  const own = readLocal(home, false).entries
  const pool = new Map([...manifest.palettes, ...own].map((e) => [e.name, e]))

  return own.flatMap((entry) => {
    const theirs = entry.upstream ? pool.get(entry.upstream.palette) : undefined
    const done = entry.upstream && theirs ? following(sidesOf(entry), entry.upstream, sidesOf(theirs)) : undefined

    return done && theirs ? [{ entry, theirs: sidesOf(theirs), done }] : []
  })
}

export function takes({ entry, done }: Behind): boolean {
  return entry.upstream !== undefined && moves(entry.upstream, done)
}

export function updatable(home: string, manifest: Manifest): string[] {
  const installed = new Set(readInstalled(home).palettes)

  return behindOf(home, manifest)
    .filter((behind) => takes(behind) && installed.has(behind.entry.name))
    .map((behind) => behind.entry.name)
}

export function conflictLine({ entry, done }: Behind): string | undefined {
  if (done.conflicts.length === 0) {
    return undefined
  }

  const both = done.conflicts.map(({ mode, slots }) => `${slots.map((slot) => SLOT_NAMES[slot]).join(', ')} (${mode})`)

  return `${entry.name} and ${entry.upstream?.palette} both changed ${both.join('; ')} — \`ttheme edit ${entry.name}\` picks between them`
}

const inMode = (sides: Partial<Sides>, mode: Mode) => [sides.colors, sides.other].find((c) => c && modeOf(c) === mode)

export function clashOf(behind: Behind | undefined, mine: Colors): Clash | undefined {
  const mode = modeOf(mine)
  const slots = behind?.done.conflicts.find((c) => c.mode === mode)?.slots
  const theirs = behind ? inMode(behind.theirs, mode) : undefined
  const upstream = behind?.entry.upstream
  const base = upstream ? inMode(upstream, mode) : undefined

  if (!slots || !theirs || !upstream?.colors || !base) {
    return undefined
  }

  const their = listOf(theirs)
  const was = listOf(base)
  const own = listOf(mine)

  return {
    against: upstream.palette,
    slots,
    original: colorsFrom(own.map((c, slot) => (slots.includes(slot) ? (their[slot] as string) : c))),
    table: base === upstream.colors ? 'upstream.colors' : `upstream.colors.${mode}`,
    base: colorsFrom(was.map((c, slot) => (slots.includes(slot) ? (their[slot] as string) : c))),
  }
}

function colorsFrom([background, foreground, cursor, selection, ...ansi]: string[]): Colors {
  return {
    background: background as string,
    foreground: foreground as string,
    cursor: cursor as string,
    selection: selection as string,
    ansi,
  }
}

export function clashNote(clash: Clash): string {
  return `${clash.against} changed ${clash.slots.map((slot) => SLOT_NAMES[slot]).join(', ')} too — r takes its color, s saves what you pick`
}

export function settled(text: string, clash: Clash): string {
  return recolor(text, clash.base, clash.table)
}

export function takeUpstream(home: string, { entry, done }: Behind): void {
  const own = ownFile(home, entry.name)

  if (!own) {
    return
  }

  const made = modeOf(done.sides.colors)
  let text = recolor(own.text, done.sides.colors, 'colors')

  if (done.sides.other) {
    text = recolor(text, done.sides.other, `colors.${otherOf(made)}`)
  }

  const base = done.upstream.colors

  if (base) {
    text = recolor(text, base, 'upstream.colors')

    if (done.upstream.other) {
      text = recolor(text, done.upstream.other, `upstream.colors.${otherOf(modeOf(base))}`)
    }
  }

  writeOwn(home, entry.name, text)
}
