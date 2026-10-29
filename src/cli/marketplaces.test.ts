import { spyOn } from 'bun:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { paletteToml } from '../core/draft.ts'
import { setText } from '../core/sets.ts'
import { escaped, quoted } from '../core/text.ts'
import { checkMarketplace, runMarketplace } from './marketplaces.ts'

const palette = {
  name: 'ann@pastel/x',
  background: '#1b170c',
  foreground: '#ede2c6',
  cursor: '#e8d082',
  selection: '#10409c',
  ansi: Array.from({ length: 16 }, (_, i) => `#${(0x30 + i * 8).toString(16).padStart(2, '0').repeat(3)}`),
}

test('marketplace check spells out the control characters and direction marks of the keys, slugs and file names it reports', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ttheme-check-'))
  const odd = `x\x1b]52;c;aGk=\x07${String.fromCodePoint(0x202e)}`
  const key = JSON.stringify(odd)
  mkdirSync(join(dir, 'sets'))
  writeFileSync(
    join(dir, 'ttheme-marketplace.toml'),
    `name = "pastel"\ndescription = "Soft"\n${key} = 1\n\n[owner]\nname = "ann"\n`,
  )
  writeFileSync(join(dir, 'sets', `${odd}.toml`), setText([{ slug: 'x', text: `${paletteToml(palette)}${key} = 1\n` }]))
  writeFileSync(join(dir, 'sets', 'original.toml'), setText([{ slug: odd, text: paletteToml(palette) }]))
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
  assert.ok(said.includes(`  ! sets/${escaped(odd)}.toml: unknown key x.colors.${escaped(odd)} — ttheme ignores it`))
  assert.ok(
    said.includes(`  ✗ sets/original.toml: the slug ${quoted(odd)} takes lowercase letters, digits and single hyphens`),
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

  put('sets/starfall.toml', setText([{ slug: 'orla', text: paletteToml({ ...palette, subject: 'starfall/orla' }) }]))

  put(
    'sets/lantern-row.toml',
    setText([{ slug: 'pip', text: paletteToml({ ...palette, subject: 'lantern-row/pip' }) }]),
  )

  put('sets/nowhere.toml', setText([{ slug: 'dawn', text: paletteToml({ ...palette, subject: 'nowhere/dawn' }) }]))
  put('sets/Lantern Row!/wren.toml', setText([{ slug: 'wren', text: paletteToml(palette) }]))
  put('works/lantern-row.toml', 'name = "Lantern Row!"\n\n[[character]]\nid = "pip"\ndanbooru = "pip_(lantern_row)"\n')
  put(
    'works/starfall.toml',
    'name = "Starfall"\nlogo = "starfall.png"\n\n[[character]]\nid = "orla"\n\n[[character]]\nid = "orla2"\ndanbooru = "orla_(starfall)"\nalso = ["lantern-row", "lost"]\n',
  )

  const commons = {
    works: [{ id: 'starfall', name: 'Starfall', characters: [{ id: 'orla', danbooru: 'orla_(starfall)' }] }],
  }

  const { result, said } = heard(() => checkMarketplace(dir, commons))

  assert.equal(result, 1)
  assert.deepEqual(
    said.filter((line) => line.startsWith('  ✗') || line.startsWith('  !')),
    [
      '  ✗ sets/Lantern Row!/wren.toml: ttheme reads sets/ alone, not the folders in it — move it up',
      '  ✗ sets/nowhere.toml: dawn: nowhere/dawn is in neither the commons nor works/ — propose it in works/nowhere.toml',
      '  ✗ works/starfall.toml: starfall/orla2 is "orla_(starfall)" on danbooru, which is starfall/orla already — name starfall/orla instead',
      '  ✗ works/starfall.toml: starfall/orla2 lists "lost" in also, which is not another work',
      '  ! works/starfall.toml: unknown key logo — ttheme ignores it',
      '  ! works/starfall.toml: the commons holds starfall/orla — its entry there wins',
    ],
  )
})
