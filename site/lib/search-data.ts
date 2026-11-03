import type { SearchPalette } from '@/lib/search'
import { paint, type Shade, type Theme } from '@/lib/themes'
import { slugOf } from '../../src/core/theme.ts'

const LOOK_PICKS: ((shade: Shade) => string)[] = [
  (shade) => shade.background,
  (shade) => shade.foreground,
  (shade) => shade.cursor,
  (shade) => shade.selectionBackground,
  ...[1, 2, 3, 4, 5, 6, 8].map((at) => (shade: Shade) => shade.ansi[at] ?? shade.foreground),
]

export function searchPalette(theme: Theme): SearchPalette {
  return { name: theme.id, slug: slugOf(theme.id), look: LOOK_PICKS.map((pick) => paint(theme, pick)) }
}
