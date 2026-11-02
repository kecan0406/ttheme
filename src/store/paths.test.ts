import assert from 'node:assert/strict'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { cacheRoot, configHome } from './paths.ts'

test('an empty XDG variable means the default, as the shell layer reads it', () => {
  const was = { config: process.env.XDG_CONFIG_HOME, cache: process.env.XDG_CACHE_HOME }
  process.env.XDG_CONFIG_HOME = ''
  process.env.XDG_CACHE_HOME = ''

  try {
    assert.equal(configHome(), join(homedir(), '.config'))
    assert.equal(cacheRoot(), join(homedir(), '.cache', 'ttheme'))
  } finally {
    for (const [name, value] of [
      ['XDG_CONFIG_HOME', was.config],
      ['XDG_CACHE_HOME', was.cache],
    ] as const) {
      if (value === undefined) {
        delete process.env[name]
      } else {
        process.env[name] = value
      }
    }
  }
})
