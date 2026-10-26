import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Work } from '../core/commons.ts'
import type { PaletteEntry } from '../core/manifest.ts'
import { aliasesZsh, palettesZsh } from './emit-shell.ts'

test('a name holding a control character or a bidi control is left out of the aliases', () => {
  const text = aliasesZsh({ mio: ['芹沢\t美緒', '‪芹沢美緒', 'Mio Serizawa', '芹沢美緒'] })
  assert.match(text, /^ {2}mio "Mio Serizawa\|芹沢美緒"$/m)
})

function entry(name: string, subject?: string, partial: Partial<PaletteEntry> = {}): PaletteEntry {
  return {
    name,
    ...(subject ? { subject } : {}),
    ansiSource: 'Test',
    background: '#101010',
    foreground: '#f0f0f0',
    cursor: '#e0c060',
    selection: '#303060',
    signature: ['#e0c060', '#f0f0f0', '#101010'],
    signatureSlots: ['cursor', 'foreground', 'background'],
    ansi: Array.from({ length: 16 }, () => '#808080'),
    gate: [],
    backdrop: { slot: 'cursor', color: '#e0c060', opacity: 0.2 },
    ...partial,
  }
}

const WORKS: Work[] = [
  {
    id: 'jubeat',
    name: 'jubeat',
    characters: [{ id: 'knit', native: ['ニット'], danbooru: 'knit_(jubeat)', also: ['popn'] }],
  },
  { id: 'popn', name: "pop'n music", characters: [] },
  { id: 'evangelion', name: 'Evangelion', native: 'エヴァンゲリオン', characters: [{ id: 'rei' }] },
]

test('palettes.zsh tells the shell what each palette is of, which works hold them, and which palettes a bare name means', () => {
  const text = palettesZsh(
    [
      entry('ttheme/neutral', undefined, { default: true }),
      entry('kec@dust/glow'),
      entry('kec@dust/rei', 'evangelion/rei'),
      entry('ttheme/knit', 'jubeat/knit'),
      entry('ttheme/rei', 'evangelion/rei'),
    ],
    WORKS,
  )

  const line = (name: string) => text.split('\n').find((l) => l.startsWith(`typeset -ga ${name}=`))
  const table = (name: string) => text.slice(text.indexOf(`typeset -gA ${name}=(`)).split('\n)')[0] ?? ''

  assert.equal(line('TTHEME_ORDER'), 'typeset -ga TTHEME_ORDER=(ttheme/rei kec@dust/rei ttheme/knit kec@dust/glow)')
  assert.equal(line('TTHEME_WORKS'), 'typeset -ga TTHEME_WORKS=(evangelion jubeat popn)')
  assert.match(table('TTHEME_SUBJECT'), /^ {2}ttheme\/knit +"jubeat\/knit"$/m)
  assert.doesNotMatch(table('TTHEME_SUBJECT'), /glow|neutral/)
  assert.match(table('TTHEME_ALSO'), /^ {2}ttheme\/knit +"popn"$/m)
  assert.match(table('TTHEME_WORK_NAME'), /^ {2}popn +"pop'n music"$/m)
  assert.match(table('TTHEME_WORK_NATIVE'), /^ {2}evangelion +"エヴァンゲリオン"$/m)
  assert.match(table('TTHEME_SHORT'), /^ {2}rei +"kec@dust\/rei ttheme\/rei"$/m)
  assert.match(table('TTHEME_SHORT'), /^ {2}neutral +"ttheme\/neutral"$/m)
  assert.match(table('TTHEME_NATIVE_NAMES'), /^ {2}ttheme\/knit +"ニット"$/m)
  assert.match(table('TTHEME_CHARACTER'), /^ {2}ttheme\/knit +"knit"$/m)
})
