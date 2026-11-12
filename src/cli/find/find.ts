import { execFile } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { PaletteEntry } from '../../core/manifest.ts'
import * as booru from '../../pictures/booru-net.ts'
import { find, readAvailable } from '../../store/available.ts'
import { writeAtomic } from '../../store/edits.ts'
import { readInstalled } from '../../store/installed.ts'
import { configHome } from '../../store/paths.ts'
import { withSetting } from '../../store/wiring.ts'
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
    net: booru,
    store: (pairs) => {
      const path = join(home, 'ttheme', 'config.zsh')
      const before = existsSync(path) ? readFileSync(path, 'utf8') : ''
      writeAtomic(
        path,
        pairs.reduce((text, [name, value]) => withSetting(text, name, value), before),
      )

      for (const [name, value] of pairs) {
        process.env[name] = value
      }
    },
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
