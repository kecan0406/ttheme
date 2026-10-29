import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Work } from '../core/commons.ts'
import type { PaletteEntry } from '../core/manifest.ts'
import { palettesZsh } from './emit-shell.ts'

function entry(name: string, subject?: string, partial: Partial<PaletteEntry> = {}): PaletteEntry {
  return {
    name,
    ...(subject ? { subject } : {}),
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
    id: 'glass-arcade',
    name: 'Glass Arcade',
    characters: [{ id: 'lumi', native: ['ルミ'], danbooru: 'lumi_(glass_arcade)', also: ['night-parade'] }],
  },
  { id: 'night-parade', name: "Night Parade's Eve", characters: [] },
  { id: 'starfall', name: 'Starfall', native: 'スターフォール', characters: [{ id: 'orla' }] },
]

test('palettes.zsh tells the shell what each palette is of, which works hold them, and which palettes a bare name means', () => {
  const text = palettesZsh(
    [
      entry('ttheme/ember'),
      entry('kai@dust/glow'),
      entry('kai@dust/orla', 'starfall/orla'),
      entry('ttheme/lumi', 'glass-arcade/lumi'),
      entry('ttheme/orla', 'starfall/orla'),
    ],
    WORKS,
  )

  const line = (name: string) => text.split('\n').find((l) => l.startsWith(`typeset -ga ${name}=`))
  const table = (name: string) => text.slice(text.indexOf(`typeset -gA ${name}=(`)).split('\n)')[0] ?? ''

  assert.equal(
    line('TTHEME_ORDER'),
    'typeset -ga TTHEME_ORDER=(ttheme/lumi ttheme/orla kai@dust/orla ttheme/ember kai@dust/glow)',
  )
  assert.equal(line('TTHEME_WORKS'), 'typeset -ga TTHEME_WORKS=(glass-arcade night-parade starfall)')
  assert.match(table('TTHEME_SUBJECT'), /^ {2}ttheme\/lumi +"glass-arcade\/lumi"$/m)
  assert.doesNotMatch(table('TTHEME_SUBJECT'), /glow|ember/)
  assert.match(table('TTHEME_ALSO'), /^ {2}ttheme\/lumi +"night-parade"$/m)
  assert.match(table('TTHEME_WORK_NAME'), /^ {2}night-parade +"Night Parade's Eve"$/m)
  assert.match(table('TTHEME_WORK_NATIVE'), /^ {2}starfall +"スターフォール"$/m)
  assert.match(table('TTHEME_SHORT'), /^ {2}orla +"kai@dust\/orla ttheme\/orla"$/m)
  assert.match(table('TTHEME_SHORT'), /^ {2}ember +"ttheme\/ember"$/m)
  assert.match(table('TTHEME_NATIVE_NAMES'), /^ {2}ttheme\/lumi +"ルミ"$/m)
  assert.match(table('TTHEME_CHARACTER'), /^ {2}ttheme\/lumi +"lumi"$/m)
})
