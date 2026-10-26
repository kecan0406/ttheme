import { join } from 'node:path'
import { toneFor } from '../src/core/backdrop-tone.ts'
import type { PaletteEntry } from '../src/core/manifest.ts'
import { colorsOf, installBackdrop } from '../src/pictures/backdrop.ts'
import { find, readPackaged } from '../src/store/available.ts'

export function installTestPicture(
  configHome: string,
  entry: PaletteEntry,
  id: number,
  window: { width: number; height: number },
): void {
  const size = 32
  const data = new Uint8Array(size * size * 4)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const at = (y * size + x) * 4
      const inside = Math.hypot(x - size / 2, y - size / 2) < size / 3
      data.set([220, 220, 220, inside ? 255 : 0], at)
    }
  }

  const colors = colorsOf(entry)
  installBackdrop(
    configHome,
    colors,
    toneFor(colors, entry.backdrop?.slot ?? 'cursor'),
    { width: size, height: size, data },
    {
      site: 'danbooru',
      id,
      ext: 'png',
      bytes: new Uint8Array([id]),
      from: `danbooru ${id} https://example.test/${id}`,
    },
    window,
    0,
  )
}

if (import.meta.main) {
  const [configHome = '', name = ''] = process.argv.slice(2)
  const entry = find(readPackaged(join(import.meta.dirname, '..')).builtin.palettes, name)

  installTestPicture(configHome, entry, 1000, { width: 1160, height: 706 })
  process.stdout.write(`${entry.name}\n`)
}
