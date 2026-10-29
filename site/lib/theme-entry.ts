import type { CharacterRef, Shade, Theme, WorkRef } from '@/lib/themes'
import { aboutOf, leadOf, type Work, workOf } from '../../src/core/commons.ts'
import { inMode, type PaletteEntry } from '../../src/core/manifest.ts'
import { modeOf, otherOf } from '../../src/core/mode.ts'
import { publisherOf, slugOf } from '../../src/core/theme.ts'

export interface Shelves {
  works: readonly Work[]
  commons: ReadonlySet<string>
}

function shadeOf(entry: PaletteEntry): Shade {
  return {
    background: entry.background,
    foreground: entry.foreground,
    cursor: entry.cursor,
    selectionBackground: entry.selection,
    ansi: entry.ansi,
    gate: entry.gate,
  }
}

function langOf(native: string, commons: boolean): string | null {
  if (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(native)) return 'ja'

  if (/\p{Script=Hangul}/u.test(native)) return 'ko'

  return commons && /\p{Script=Han}/u.test(native) ? 'ja' : null
}

function refOf(work: Work, { commons }: Shelves): WorkRef {
  return {
    id: work.id,
    name: work.name,
    native: work.native ?? null,
    lang: work.native ? langOf(work.native, commons.has(work.id)) : null,
    lead: leadOf(work),
  }
}

export function toTheme(entry: PaletteEntry, shelves: Shelves): Theme {
  const mode = modeOf(entry)
  const about = aboutOf(shelves.works, entry.subject)

  const also = (about?.character?.also ?? []).flatMap((id) => {
    const work = workOf(shelves.works, id)

    return work ? [refOf(work, shelves)] : []
  })

  const character: CharacterRef | null = about?.character
    ? { id: about.character.id, native: about.character.native ?? [] }
    : null

  return {
    id: entry.name,
    marketplace: publisherOf(entry.name),
    name: slugOf(entry.name),
    subject: entry.subject ?? null,
    work: about ? refOf(about.work, shelves) : null,
    also,
    character,
    from: entry.upstream?.palette ?? null,
    ...shadeOf(entry),
    mode,
    other: shadeOf(inMode(entry, otherOf(mode))),
  }
}
