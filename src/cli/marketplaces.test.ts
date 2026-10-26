import { spyOn } from 'bun:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { paletteToml } from '../core/draft.ts'
import { escaped, quoted } from '../core/text.ts'
import { checkMarketplace, runMarketplace } from './marketplaces.ts'

const palette = {
  name: 'ann@pastel/x',
  ansiSource: 'Test',
  signature: ['cursor', 'selection', 'ansi5'],
  background: '#1b170c',
  foreground: '#ede2c6',
  cursor: '#e8d082',
  selection: '#10409c',
  ansi: Array.from({ length: 16 }, (_, i) => `#${(0x30 + i * 8).toString(16).padStart(2, '0').repeat(3)}`),
}

test('marketplace check spells out the control characters and direction marks of the keys and file names it reports', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ttheme-check-'))
  const odd = `x\x1b]52;c;aGk=\x07${String.fromCodePoint(0x202e)}`
  const key = JSON.stringify(odd)
  mkdirSync(join(dir, 'palettes'))
  writeFileSync(
    join(dir, 'ttheme-marketplace.toml'),
    `name = "pastel"\ndescription = "Soft"\n${key} = 1\n\n[owner]\nname = "ann"\n`,
  )
  writeFileSync(join(dir, 'palettes', `${odd}.toml`), `${paletteToml(palette)}${key} = 1\n`)
  const said: string[] = []
  const hear = (...parts: unknown[]) => void said.push(parts.join(' '))
  const log = spyOn(console, 'log').mockImplementation(hear)
  const error = spyOn(console, 'error').mockImplementation(hear)
  const was = process.env.XDG_CONFIG_HOME
  process.env.XDG_CONFIG_HOME = join(dir, 'config')

  try {
    assert.equal(await runMarketplace('check', dir), 1)
  } finally {
    log.mockRestore()
    error.mockRestore()

    if (was === undefined) {
      delete process.env.XDG_CONFIG_HOME
    } else {
      process.env.XDG_CONFIG_HOME = was
    }
  }

  assert.ok(said.every((line) => !/[\p{Cc}\p{Bidi_Control}]/u.test(line.replaceAll('\n', ''))))
  assert.ok(said.includes(`  ! ttheme-marketplace.toml: unknown key ${escaped(odd)} — ttheme ignores it`))
  assert.ok(said.includes(`  ! palettes/${escaped(odd)}.toml: unknown key colors.${escaped(odd)} — ttheme ignores it`))
  assert.ok(
    said.includes(
      `  ✗ palettes/${escaped(odd)}.toml: the file name ${quoted(odd)} takes lowercase letters, digits and single hyphens — it is the palette's name`,
    ),
  )
})

function heard<T>(run: () => T) {
  const said: string[] = []
  const hear = (...parts: unknown[]) => void said.push(parts.join(' '))
  const log = spyOn(console, 'log').mockImplementation(hear)
  const error = spyOn(console, 'error').mockImplementation(hear)

  try {
    return { result: run(), said }
  } finally {
    log.mockRestore()
    error.mockRestore()
  }
}

test('marketplace check holds the palettes and the works they propose to the commons', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ttheme-check-'))

  const put = (path: string, text: string) => {
    mkdirSync(join(dir, path, '..'), { recursive: true })
    writeFileSync(join(dir, path), text)
  }

  put('ttheme-marketplace.toml', 'name = "pastel"\ndescription = "Soft"\n\n[owner]\nname = "ann"\n')
  put('palettes/rei.toml', paletteToml({ ...palette, subject: 'evangelion/rei' }))
  put('palettes/azusa.toml', paletteToml({ ...palette, subject: 'k-on/azusa' }))
  put('palettes/ayanami.toml', paletteToml({ ...palette, subject: 'eva/rei' }))
  put('palettes/dawn.toml', paletteToml({ ...palette, subject: 'nowhere/dawn' }))
  put('palettes/K-On!/yui.toml', paletteToml(palette))
  put('works/k-on.toml', 'name = "K-On!"\n\n[[character]]\nid = "azusa"\ndanbooru = "nakano_azusa"\n')
  put(
    'works/evangelion.toml',
    'name = "Evangelion"\nlogo = "eva.png"\n\n[[character]]\nid = "rei"\n\n[[character]]\nid = "rei2"\ndanbooru = "ayanami_rei"\nalso = ["k-on", "lost"]\n',
  )

  const commons = {
    works: [{ id: 'evangelion', name: 'Evangelion', characters: [{ id: 'rei', danbooru: 'ayanami_rei' }] }],
    renames: { eva: 'evangelion' },
  }

  const { result, said } = heard(() => checkMarketplace(dir, commons))

  assert.equal(result, 1)
  assert.deepEqual(
    said.filter((line) => line.startsWith('  ✗') || line.startsWith('  !')),
    [
      '  ✗ palettes/K-On!/yui.toml: ttheme reads palettes/ alone, not the folders in it — move it up',
      '  ✗ palettes/dawn.toml: nowhere/dawn is in neither the commons nor works/ — propose it in works/nowhere.toml',
      '  ✗ works/evangelion.toml: evangelion/rei2 is "ayanami_rei" on danbooru, which is evangelion/rei already — name evangelion/rei instead',
      '  ✗ works/evangelion.toml: evangelion/rei2 lists "lost" in also, which is not another work',
      '  ! works/evangelion.toml: unknown key logo — ttheme ignores it',
      '  ! palettes/ayanami.toml: the commons calls eva/rei evangelion/rei now — name it that way',
      '  ! works/evangelion.toml: the commons holds evangelion/rei — its entry there wins',
    ],
  )
})
