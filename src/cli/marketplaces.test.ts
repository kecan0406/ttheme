import { spyOn } from 'bun:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { paletteToml } from '../core/draft.ts'
import { escaped } from '../core/text.ts'
import { runMarketplace } from './marketplaces.ts'

const palette = {
  name: 'x',
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
  assert.ok(said.some((line) => line.startsWith(`  ✗ palettes/${escaped(odd)}.toml: meta.name "x" does not match`)))
})
