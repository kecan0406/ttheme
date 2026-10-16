import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { appearancePath, knowAppearance } from './appearance.ts'
import { ghosttyTheme } from './terminals/ghostty.ts'
import type { Host } from './terminals/types.ts'
import { modeFor } from './wiring.ts'

function inState<T>(run: (configHome: string) => T): T {
  const base = mkdtempSync(join(tmpdir(), 'ttheme-appearance-'))
  const was = process.env.XDG_STATE_HOME
  process.env.XDG_STATE_HOME = join(base, 'state')

  try {
    return run(join(base, 'config'))
  } finally {
    if (was === undefined) {
      delete process.env.XDG_STATE_HOME
    } else {
      process.env.XDG_STATE_HOME = was
    }
  }
}

function setting(configHome: string, value: string): void {
  mkdirSync(join(configHome, 'ttheme'), { recursive: true })
  writeFileSync(join(configHome, 'ttheme', 'config.zsh'), `: \${TTHEME_MODE:=${value}}\n`)
}

const answering = (platform: NodeJS.Platform, answer: string | undefined): Host => ({
  platform,
  env: {},
  run: () => answer,
})

test('auto wears the appearance last heard, and dark until one is', () => {
  inState((configHome) => {
    setting(configHome, 'auto')
    assert.equal(modeFor(configHome), 'dark')
    mkdirSync(join(appearancePath(), '..'), { recursive: true })
    writeFileSync(appearancePath(), 'light\n')
    assert.equal(modeFor(configHome), 'light')
    setting(configHome, 'dark')
    assert.equal(modeFor(configHome), 'dark')
  })
})

test('the system seeds the appearance only while none was heard', () => {
  inState(() => {
    assert.equal(knowAppearance(answering('darwin', 'Dark')), 'dark')
    assert.equal(knowAppearance(answering('darwin', undefined)), 'dark')
  })
  inState(() => assert.equal(knowAppearance(answering('darwin', undefined)), 'light'))
  inState(() => assert.equal(knowAppearance(answering('linux', "'prefer-dark'")), 'dark'))
  inState(() => assert.equal(knowAppearance(answering('linux', "'default'")), 'light'))

  inState(() => {
    assert.equal(knowAppearance(answering('linux', undefined)), undefined)
    assert.throws(() => readFileSync(appearancePath()))
  })
})

test("Ghostty's theme names one mode's file, or both under auto", () => {
  assert.equal(ghosttyTheme('kec@dust/rei', 'light'), 'ttheme-kec--dust--rei.light')
  assert.equal(ghosttyTheme('miku', 'auto'), 'light:ttheme-miku.light,dark:ttheme-miku.dark')
})
