import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { colorsOf, installBackdrop, toneFor } from '../src/backdrop.ts'
import type { PaletteEntry } from '../src/manifest.ts'

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
  const manifest = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'dist', 'manifest.json'), 'utf8')) as {
    palettes: PaletteEntry[]
  }
  const entry = manifest.palettes.find((p) => p.name === name)
  if (!entry) {
    throw new Error(`no ${name} in the catalog`)
  }
  installTestPicture(configHome, entry, 1000, { width: 1160, height: 706 })
}
