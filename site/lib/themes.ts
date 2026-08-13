import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'smol-toml'

export interface Theme {
  name: string
  slug: string
  group: string
  native: string | null
  order: number
  background: string
  foreground: string
  cursor: string
  selectionBackground: string
  ansi: string[]
}

interface ThemeFile {
  meta: { name: string; group: string; native?: string; order: number }
  colors: {
    background: string
    foreground: string
    cursor: string
    selection_background: string
    ansi: string[]
  }
}

const themesDir = join(process.cwd(), '..', 'themes')

export function loadThemes(): Theme[] {
  return readdirSync(themesDir)
    .filter((file) => file.endsWith('.toml') && !file.startsWith('_'))
    .map((file) => {
      const { meta, colors } = parse(readFileSync(join(themesDir, file), 'utf8')) as unknown as ThemeFile
      return {
        name: meta.name,
        slug: file.replace(/\.toml$/, ''),
        group: meta.group,
        native: meta.native ?? null,
        order: meta.order,
        background: colors.background,
        foreground: colors.foreground,
        cursor: colors.cursor,
        selectionBackground: colors.selection_background,
        ansi: colors.ansi,
      }
    })
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
}
