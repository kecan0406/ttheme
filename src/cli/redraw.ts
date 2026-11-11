import { availableParallelism, homedir } from 'node:os'
import type { Coloring } from '../core/backdrop-tone.ts'
import {
  type Attempt,
  applyRedraw,
  backgroundsDir,
  coloringOf,
  type Paint,
  type Picture,
  paintFor,
  rackIn,
  readStore,
  swapped,
  thumbless,
  triedAs,
  workFor,
  writeThumb,
} from '../pictures/backdrop.ts'
import { redrawOne } from '../pictures/redrawing.ts'
import { Pool } from '../pictures/render.ts'
import { type View, viewOf } from '../store/available.ts'
import { readInstalled } from '../store/installed.ts'
import { configHome } from '../store/paths.ts'
import { blurOf, stickerOf } from '../store/wiring.ts'
import { aligns as alignsFor, refreshPictures } from './sync.ts'

const WORKERS = 4

interface Job {
  name: string
  paint: Paint
  picture: Picture
  attempt: Attempt
}

interface Redrawing {
  emit?: boolean
  view?: View
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
  { emit = true, view, step, ownColors = false }: Redrawing = {},
): Promise<number> {
  const store = readStore(backgroundsDir(home))

  if (Object.keys(store.palettes).length === 0) {
    return 0
  }

  const blurring = blurOf(home)
  const sticker = stickerOf(home)
  const shown = (view ?? viewOf(home, undefined, true, Object.keys(store.palettes))).available
  const entries = new Map(shown.palettes.map((entry) => [entry.name, entry]))
  const swaps: Job[] = []
  const draws: Job[] = []

  for (const [name, rack] of Object.entries(store.palettes)) {
    const entry = entries.get(name)

    if (!entry) {
      continue
    }

    const paint = paintFor(entry)

    for (const picture of rack.pictures) {
      const work = workFor(picture, { paint, blur: blurring, sticker }, ownColors)

      if (work) {
        ;(work.by === 'draw' ? draws : swaps).push({ name, paint, picture, attempt: work.attempt })
      }
    }
  }

  const total = swaps.length + draws.length

  if (total === 0) {
    await shrinkBare(home)

    return 0
  }

  const aligns = alignsFor(readInstalled(home).terminals)
  const drawn: { name: string; picture: Picture }[] = []
  const tried: { name: string; picture: Picture }[] = []
  let done = 0

  for (const job of swaps) {
    const next = swapped(home, job.name, job.picture, job.paint, aligns, user)

    if (next) {
      drawn.push({ name: job.name, picture: next })
      step?.(++done, total)
    } else {
      draws.push(job)
    }
  }

  if (draws.length > 0) {
    const how = ownColors ? `in ${draws.length === 1 ? 'its' : 'their'} own colors` : 'again'

    say(`Drawing ${plural(draws.length)} ${how}${blurring ? `  blur ${blurring}px` : ''}`)

    const pool = new Pool(Math.min(WORKERS, availableParallelism() - 1, draws.length))

    const results = await pool.map(
      draws.map(({ name, paint, picture, attempt }) => ({
        job: 'redraw' as const,
        home,
        user,
        name,
        key: picture.key,
        paint,
        blur: blurring,
        sticker,
        aligns,
        ...(attempt.coloring === coloringOf(picture) ? {} : { coloring: attempt.coloring }),
      })),
      () => step?.(++done, total),
    )

    pool.close()

    draws.forEach(({ name, picture, attempt }, at) => {
      const result = results[at]

      if (result instanceof Error || !result) {
        say(
          `  ▢ ${name} ${picture.key} — ${result instanceof Error ? result.message : 'no original to draw it from'}, left as it was`,
        )
        tried.push({ name, picture: triedAs(picture, attempt) })

        return
      }

      drawn.push({ name, picture: result })
    })
  }

  applyRedraw(home, [...drawn, ...tried])
  await shrinkBare(home)

  if (emit && drawn.length > 0) {
    refreshPictures(home, user, undefined, view)
  }

  return drawn.length
}

async function shrinkBare(home: string): Promise<void> {
  const bare = thumbless(home)

  if (bare.length <= 2) {
    for (const { name, key } of bare) {
      writeThumb(home, name, key)
    }

    return
  }

  const pool = new Pool(Math.min(WORKERS, availableParallelism() - 1, bare.length))
  await pool.map(bare.map(({ name, key }) => ({ job: 'shrink' as const, home, name, key })))
  pool.close()
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

  const view = viewOf(home)
  const entry = view.available.palettes.find((held) => held.name === name)

  if (!entry) {
    throw new Error(`no palette called ${name}`)
  }

  const aligns = alignsFor(readInstalled(home).terminals)

  const drawn = await redrawOne(
    home,
    name,
    picture.key,
    paintFor(entry),
    blurOf(home),
    aligns,
    user,
    coloring,
    stickerOf(home),
  )

  if (!drawn) {
    throw new Error(`${name} ${picture.key} has no original to draw it from`)
  }

  applyRedraw(home, [{ name, picture: drawn }])
  refreshPictures(home, user, undefined, view)

  return { key: picture.key, changed: true }
}

export async function runRedraw(): Promise<number> {
  await redrawPictures(configHome(), (line) => process.stderr.write(`${line}\n`))

  return 0
}
