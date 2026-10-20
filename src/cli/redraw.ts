import { availableParallelism, homedir } from 'node:os'
import type { Coloring } from '../core/backdrop-tone.ts'
import { inMode, type Manifest } from '../core/manifest.ts'
import { modeOf, otherOf } from '../core/mode.ts'
import {
  applyRedraw,
  backgroundsDir,
  cached,
  coloringOf,
  decodable,
  inkDue,
  type Paint,
  type Picture,
  paintFor,
  rackIn,
  readStore,
  undrawn,
} from '../pictures/backdrop.ts'
import { MATTING } from '../pictures/cutout.ts'
import { prune, writable } from '../pictures/drawn.ts'
import { prepareOne, redrawOne } from '../pictures/redrawing.ts'
import { Pool } from '../pictures/render.ts'
import { available, readAvailable } from '../store/available.ts'
import { readInstalled } from '../store/installed.ts'
import { configHome } from '../store/paths.ts'
import { blurOf } from '../store/wiring.ts'
import { aligns as alignsFor, refreshPictures } from './sync.ts'

const WORKERS = 4

interface Job {
  name: string
  key: string
  paint: Paint
  coloring?: Coloring
}

interface Redrawing {
  emit?: boolean
  manifest?: Manifest
  step?: (done: number, of: number) => void
  ownColors?: boolean
}

function plural(n: number): string {
  return `${n} background picture${n === 1 ? '' : 's'}`
}

export async function redrawPictures(
  home: string,
  say: (line: string) => void,
  user = homedir(),
  { emit = true, manifest, step, ownColors = false }: Redrawing = {},
): Promise<number> {
  const store = readStore(backgroundsDir(home))

  if (Object.keys(store.palettes).length === 0) {
    return 0
  }

  const blurring = blurOf(home)
  const shown = manifest ? available(home, manifest) : readAvailable(home)
  const entries = new Map(shown.palettes.map((entry) => [entry.name, entry]))
  const hits: Job[] = []
  const misses: Job[] = []
  const primes: Job[] = []
  const keeping = writable()

  for (const [name, rack] of Object.entries(store.palettes)) {
    const entry = entries.get(name)

    if (!entry) {
      continue
    }

    const paint = paintFor(entry)
    let other: Paint | undefined

    for (const picture of rack.pictures) {
      if (ownColors && coloringOf(picture) === 'tone') {
        const into = cached(home, name, picture, paint, blurring, 'original') ? hits : misses
        into.push({ name, key: picture.key, paint, coloring: 'original' })
        continue
      }

      const flips = inkDue(picture, paint)

      const due =
        undrawn(picture) ||
        flips ||
        (picture.blur ?? 0) !== blurring ||
        (picture.cut !== undefined && picture.matte !== MATTING)

      if (due) {
        const into = cached(home, name, picture, paint, blurring) ? hits : misses
        into.push({ name, key: picture.key, paint })
      }

      if (keeping && !flips && !undrawn(picture) && coloringOf(picture) === 'tone' && decodable(home, picture)) {
        other ??= paintFor(inMode(entry, otherOf(modeOf(entry))))

        if (!cached(home, name, picture, other, blurring, 'tone')) {
          primes.push({ name, key: picture.key, paint: other })
        }
      }
    }
  }

  const total = hits.length + misses.length + primes.length

  if (total === 0) {
    return 0
  }

  const aligns = alignsFor(readInstalled(home).terminals)
  const drawn: { name: string; picture: Picture }[] = []
  let done = 0

  for (const { name, key, paint, coloring } of hits) {
    try {
      const picture = await redrawOne(home, name, key, paint, blurring, aligns, user, coloring)

      if (picture) {
        drawn.push({ name, picture })
      }
    } catch (error) {
      say(`  ▢ ${name} ${key} — ${error instanceof Error ? error.message : String(error)}, left as it was`)
    }

    step?.(++done, total)
  }

  if (misses.length + primes.length > 0) {
    if (misses.length > 0) {
      const how = ownColors ? `in ${misses.length === 1 ? 'its' : 'their'} own colors` : 'again'

      say(`Drawing ${plural(misses.length)} ${how}${blurring ? ` · blur ${blurring}px` : ''}`)
    } else {
      say(`Drawing ${plural(primes.length)} for the other mode`)
    }

    const pool = new Pool(Math.min(WORKERS, availableParallelism() - 1, misses.length + primes.length))
    const tick = () => step?.(++done, total)

    const results = await pool.map(
      misses.map(({ name, key, paint, coloring }) => ({
        job: 'redraw' as const,
        home,
        user,
        name,
        key,
        paint,
        blur: blurring,
        aligns,
        ...(coloring ? { coloring } : {}),
      })),
      tick,
    )

    await pool.map(
      primes.map(({ name, key, paint }) => ({
        job: 'prepare' as const,
        home,
        name,
        key,
        paint,
        blur: blurring,
        coloring: 'tone' as const,
      })),
      tick,
    )

    pool.close()

    misses.forEach(({ name, key }, at) => {
      const result = results[at]

      if (result instanceof Error || !result) {
        say(
          `  ▢ ${name} ${key} — ${result instanceof Error ? result.message : 'no original to draw it from'}, left as it was`,
        )

        return
      }

      drawn.push({ name, picture: result })
    })
  }

  applyRedraw(home, drawn)
  prune()

  if (emit && drawn.length > 0) {
    refreshPictures(home, user)
  }

  return drawn.length
}

export async function redrawColoring(
  home: string,
  name: string,
  coloring: Coloring,
  key?: string,
  user = homedir(),
): Promise<{ key: string; changed: boolean }> {
  const rack = rackIn(readStore(backgroundsDir(home)), name)
  const picture = rack?.pictures.find((held) => held.key === (key ?? rack.active))

  if (!rack || !picture) {
    throw new Error(`${name} has no picture ${key ?? 'shown'}`)
  }

  if (coloringOf(picture) === coloring) {
    return { key: picture.key, changed: false }
  }

  const entry = readAvailable(home).palettes.find((held) => held.name === name)

  if (!entry) {
    throw new Error(`no palette called ${name}`)
  }

  const aligns = alignsFor(readInstalled(home).terminals)
  const drawn = await redrawOne(home, name, picture.key, paintFor(entry), blurOf(home), aligns, user, coloring)

  if (!drawn) {
    throw new Error(`${name} ${picture.key} has no original to draw it from`)
  }

  applyRedraw(home, [{ name, picture: drawn }])
  refreshPictures(home, user)

  return { key: picture.key, changed: true }
}

export function prepareColoring(home: string, name: string, key?: string) {
  const rack = rackIn(readStore(backgroundsDir(home)), name)
  const picture = rack?.pictures.find((held) => held.key === (key ?? rack.active))

  if (!rack || !picture) {
    throw new Error(`${name} has no picture ${key ?? 'shown'}`)
  }

  const entry = readAvailable(home).palettes.find((held) => held.name === name)

  if (!entry) {
    throw new Error(`no palette called ${name}`)
  }

  const coloring = coloringOf(picture) === 'original' ? 'tone' : 'original'

  if (!prepareOne(home, name, picture.key, paintFor(entry), blurOf(home), coloring)) {
    throw new Error(`${name} ${picture.key} has no original to draw it from`)
  }

  return { key: picture.key, coloring }
}

export async function runRedraw(): Promise<number> {
  await redrawPictures(configHome(), (line) => process.stderr.write(`${line}\n`))

  return 0
}
