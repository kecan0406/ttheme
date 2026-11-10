import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { PaletteEntry } from '../../core/manifest.ts'
import { find, readAvailable } from '../../store/available.ts'
import { readInstalled } from '../../store/installed.ts'
import { configHome } from '../../store/paths.ts'
import { viewsInWindow, viewVar } from '../../terminals/terminal.ts'
import type { Start } from '../../tui/find/attach.ts'
import { Finder, type FindIO } from '../../tui/find/finder.ts'
import { tagOf } from '../../tui/find/tags.ts'
import { interactive } from '../../tui/terminal.ts'
import { aligns as alignsFor, refreshesPictures } from '../sync.ts'
import { visit } from '../visit.ts'

const spawned = promisify(execFile)

function ioFor(home: string, entry: PaletteEntry): FindIO {
  return {
    visit,
    aligns: () => alignsFor(readInstalled(home).terminals),
    refreshes: () => refreshesPictures(home),
    refresh: async () => {
      await spawned(process.execPath, [process.argv[1] as string, 'image', entry.name, 'tuned'])
    },
  }
}

export async function findFor(
  home: string,
  entry: PaletteEntry,
  start?: Start,
): Promise<{ saved: string | undefined; installs: number }> {
  const manifest = readAvailable(home)
  const finder = new Finder(home, manifest, entry, tagOf(manifest.works, entry), ioFor(home, entry), start)
  await finder.run()

  if (viewsInWindow(process.env)) {
    process.stdout.write(viewVar(''))
  }

  return { saved: finder.saved, installs: finder.installs }
}

export async function runFind(name: string): Promise<number> {
  const home = configHome()
  const manifest = readAvailable(home)
  const entry = find(manifest.palettes, name)

  if (!interactive()) {
    throw new Error('needs a terminal')
  }

  const finder = new Finder(home, manifest, entry, tagOf(manifest.works, entry), ioFor(home, entry))
  const code = await finder.run()

  if (finder.saved && code !== 0) {
    process.stderr.write(`${finder.saved}\n`)

    return 0
  }

  return code
}
