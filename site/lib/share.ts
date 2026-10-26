import { commons } from '@/lib/builtin'
import { shelvesFor } from '@/lib/marketplaces'
import { pictureOf } from '@/lib/pictures'
import { toTheme } from '@/lib/theme-entry'
import type { Theme } from '@/lib/themes'
import type { Picture } from '@/lib/view-types'
import { followSubject } from '../../src/core/commons.ts'
import { type Draft, shareLink } from '../../src/core/draft.ts'
import type { PaletteEntry } from '../../src/core/manifest.ts'
import { fromCode, readCodes } from '../../src/core/own.ts'
import { publisherOf } from '../../src/core/theme.ts'

export interface Shared {
  code: string
  link: string
  entry: PaletteEntry
  drafts: Draft[]
  theme: Theme
  pictures: Picture[]
  index: number
  palettes: Theme[]
}

function themeOf(entry: PaletteEntry): Theme {
  const subject = entry.subject ? { subject: followSubject(commons.renames, entry.subject) } : {}

  return toTheme({ ...entry, ...subject }, shelvesFor(publisherOf(entry.name)))
}

export function readShared(code: string, index = 0): Shared {
  const entries = readCodes(code)
  const at = Number.isInteger(index) && index >= 0 && index < entries.length ? index : 0
  const entry = entries[at] as PaletteEntry
  const palettes = entries.map(themeOf)

  return {
    code,
    link: shareLink(code),
    entry,
    drafts: fromCode(code),
    theme: palettes[at] as Theme,
    pictures: (entry.pictures ?? []).map(pictureOf),
    index: at,
    palettes,
  }
}
