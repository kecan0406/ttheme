import { availableParallelism, homedir } from 'node:os'
import { applyRedraw, backgroundsDir, type Picture, readStore } from './backdrop.ts'
import { readAvailable } from './catalog.ts'
import { configHome, readInstalled, refreshProfiles } from './palettes.ts'
import { Pool } from './render.ts'
import { blurOf } from './wiring.ts'

const WORKERS = 4

export async function redrawPictures(home: string, say: (line: string) => void, user = homedir()): Promise<number> {
  const store = readStore(backgroundsDir(home))
  const blurring = blurOf(home)
  const hues = new Map(readAvailable(home).palettes.map((entry) => [entry.name, entry.backdrop]))
  const due = Object.entries(store.palettes).flatMap(([name, rack]) => {
    const hue = hues.get(name)
    return hue
      ? rack.pictures
          .filter((picture) => picture.tone === undefined || (picture.blur ?? 0) !== blurring)
          .map((picture) => ({ name, key: picture.key, hue }))
      : []
  })
  if (due.length === 0) {
    return 0
  }
  say(
    `drawing ${due.length} background picture${due.length === 1 ? '' : 's'} again${blurring ? ` · blur ${blurring}px` : ''}`,
  )
  const aligns = !readInstalled(home).terminals.includes('iterm2')
  const pool = new Pool(Math.min(WORKERS, availableParallelism() - 1))
  const results = await pool.map(
    due.map(({ name, key, hue }) => ({
      job: 'redraw' as const,
      home,
      user,
      name,
      key,
      hue,
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
  refreshProfiles(home, user)
  return drawn.length
}

export async function runRedraw(): Promise<number> {
  await redrawPictures(configHome(), (line) => process.stderr.write(`${line}\n`))
  return 0
}
