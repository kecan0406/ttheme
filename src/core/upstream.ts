import type { PaletteEntry, UpstreamEntry } from './manifest.ts'
import { type Mode, modeOf } from './mode.ts'
import type { Colors } from './seeds.ts'

export interface Sides {
  colors: Colors
  other?: Colors
}

export interface Followed {
  colors: Colors
  base: Colors
  taken: number[]
  conflicts: number[]
}

export interface Following {
  sides: Sides
  upstream: UpstreamEntry
  taken: number
  conflicts: { mode: Mode; slots: number[] }[]
}

const listOf = (c: Colors): string[] => [c.background, c.foreground, c.cursor, c.selection, ...c.ansi]

function colorsOf([background, foreground, cursor, selection, ...ansi]: string[]): Colors {
  return {
    background: background as string,
    foreground: foreground as string,
    cursor: cursor as string,
    selection: selection as string,
    ansi,
  }
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

export function follow(mine: Colors, base: Colors, theirs: Colors): Followed {
  const own = listOf(mine)
  const was = listOf(base)
  const colors = [...own]
  const next = [...was]
  const taken: number[] = []
  const conflicts: number[] = []

  for (const [slot, their] of listOf(theirs).entries()) {
    const before = was[slot] as string
    const kept = own[slot] as string

    if (same(their, before)) {
      continue
    }

    if (same(kept, before)) {
      colors[slot] = their
      next[slot] = their
      taken.push(slot)
    } else if (same(kept, their)) {
      next[slot] = their
    } else {
      conflicts.push(slot)
    }
  }

  return { colors: colorsOf(colors), base: colorsOf(next), taken, conflicts }
}

function inMode(sides: Sides, mode: Mode): Colors | undefined {
  return [sides.colors, sides.other].find((c) => c !== undefined && modeOf(c) === mode)
}

export function following(mine: Sides, upstream: UpstreamEntry, theirs: Sides): Following | undefined {
  if (!upstream.colors) {
    return undefined
  }

  const sides: Sides = { ...mine }
  const bases = [upstream.colors, ...(upstream.other ? [upstream.other] : [])]
  const moved: Colors[] = []
  let taken = 0
  const conflicts: Following['conflicts'] = []

  for (const base of bases) {
    const mode = modeOf(base)
    const own = inMode(mine, mode)
    const their = inMode(theirs, mode)

    if (!own || !their) {
      moved.push(base)
      continue
    }

    const done = follow(own, base, their)
    moved.push(done.base)
    taken += done.taken.length

    if (done.conflicts.length > 0) {
      conflicts.push({ mode, slots: done.conflicts })
    }

    if (own === mine.colors) {
      sides.colors = done.colors
    } else {
      sides.other = done.colors
    }
  }

  const [colors, other] = moved

  return {
    sides,
    upstream: { palette: upstream.palette, ...(colors ? { colors } : {}), ...(other ? { other } : {}) },
    taken,
    conflicts,
  }
}

export function moves(upstream: UpstreamEntry, done: Following): boolean {
  const bases = [upstream.colors, upstream.other]
  const next = [done.upstream.colors, done.upstream.other]

  return bases.some((base, at) => {
    const now = next[at]

    return (
      base !== undefined && now !== undefined && listOf(base).some((c, slot) => !same(c, listOf(now)[slot] as string))
    )
  })
}

export function sidesOf(
  entry: Pick<PaletteEntry, 'background' | 'foreground' | 'cursor' | 'selection' | 'ansi' | 'other'>,
): Sides {
  return {
    colors: {
      background: entry.background,
      foreground: entry.foreground,
      cursor: entry.cursor,
      selection: entry.selection,
      ansi: entry.ansi,
    },
    ...(entry.other ? { other: entry.other } : {}),
  }
}

export function upstreamFrom(entry: PaletteEntry): UpstreamEntry {
  const { colors, other } = sidesOf(entry)

  return { palette: entry.name, colors, ...(other ? { other } : {}) }
}
