import { availableParallelism, homedir } from 'node:os'
import { readAvailable } from './available.ts'
import {
  applyRedraw,
  backgroundsDir,
  type Coloring,
  coloringOf,
  type Picture,
  paintFor,
  readStore,
  undrawn,
} from './backdrop.ts'
import { MATTING } from './cutout.ts'
import { aligns as alignsFor, configHome, readInstalled, refreshPictures } from './palettes.ts'
import { prepareOne, redrawOne } from './pictures.ts'
import { Pool } from './render.ts'
import { blurOf } from './wiring.ts'

const WORKERS = 4

export async function redrawPictures(home: string, say: (line: string) => void, user = homedir()): Promise<number> {
  const store = readStore(backgroundsDir(home))
  const blurring = blurOf(home)
  const paints = new Map(readAvailable(home).palettes.map((entry) => [entry.name, paintFor(entry)]))
  const due = Object.entries(store.palettes).flatMap(([name, rack]) => {
    const paint = paints.get(name)
    return paint
      ? rack.pictures
          .filter(
            (picture) =>
              undrawn(picture) ||
              (picture.blur ?? 0) !== blurring ||
              (picture.cut !== undefined && picture.matte !== MATTING),
          )
          .map((picture) => ({ name, key: picture.key, paint }))
      : []
  })
  if (due.length === 0) {
    return 0
  }
  say(
    `Drawing ${due.length} background picture${due.length === 1 ? '' : 's'} again${blurring ? ` · blur ${blurring}px` : ''}`,
  )
  const aligns = alignsFor(readInstalled(home).terminals)
  const pool = new Pool(Math.min(WORKERS, availableParallelism() - 1))
  const results = await pool.map(
    due.map(({ name, key, paint }) => ({
      job: 'redraw' as const,
      home,
      user,
      name,
      key,
      paint,
      blur: blurring,
      aligns,
    })),
  )
  pool.close()
  const drawn: { name: string; picture: Picture }[] = []
  results.forEach((result, at) => {
    const { name, key } = due[at] as (typeof due)[number]
    if (result instanceof Error || result === null) {
      say(
        `  ▢ ${name} ${key} — ${result instanceof Error ? result.message : 'no original to draw it from'}, left as it was`,
      )
      return
    }
    drawn.push({ name, picture: result })
  })
  applyRedraw(home, drawn)
  refreshPictures(home, user)
  return drawn.length
}

export async function redrawColoring(
  home: string,
  name: string,
  coloring: Coloring,
  key?: string,
  user = homedir(),
): Promise<{ key: string; changed: boolean }> {
  const rack = readStore(backgroundsDir(home)).palettes[name]
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

export function prepareColoring(home: string, name: string, key?: string): { key: string; coloring: Coloring } {
  const rack = readStore(backgroundsDir(home)).palettes[name]
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
