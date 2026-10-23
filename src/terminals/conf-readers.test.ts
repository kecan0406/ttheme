import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { readConf } from '../pictures/conf.ts'
import { kittyWatcher } from './emit/kitty.ts'
import { weztermModule } from './emit/wezterm.ts'

function interpreter(name: string, args: string[]): string | undefined {
  const probe = spawnSync(name, args, { encoding: 'utf8' })

  return probe.status === 0 ? name : undefined
}

const PYTHON = interpreter('python3', ['-c', 'print(1)'])
const LUA = interpreter('luajit', ['-e', 'print(1)'])

function fixture(): string {
  return mkdtempSync(join(tmpdir(), 'ttheme-readers-'))
}

function conf(dir: string, name: string, lines: string[]): string {
  const path = join(dir, name)

  mkdirSync(dir, { recursive: true })
  writeFileSync(path, `${lines.join('\n')}\n`)

  return path
}

function entries(set: Map<string, string> | undefined): [string, string][] {
  return [...(set ?? new Map()).entries()].sort(([a], [b]) => (a < b ? -1 : 1))
}

const PYTHON_DRIVER = [
  'import json, sys',
  'sys.path.insert(0, sys.argv[1])',
  'import kitty',
  'out = {}',
  'kitty.read(sys.argv[2], out)',
  'print(json.dumps(out, sort_keys=True))',
].join('\n')

const LUA_DRIVER = [
  'local c = {}',
  'read(arg[1], c, 0)',
  'local keys = {}',
  'for k, v in pairs(c) do keys[#keys+1] = k .. "=" .. v end',
  'table.sort(keys)',
  'print(table.concat(keys, "\\n"))',
].join('\n')

function fixtureFiles(dir: string): string {
  conf(dir, 'tune.conf', ['background-image-opacity = 0.4'])
  conf(dir, 'kagami.conf', [
    '# by someone',
    'background-image = /pictures/kagami.png',
    'background-image-fit = cover',
    'background-image-position = top-right',
    'background-image-opacity = 0.2',
    'config-file = ?tune.conf',
  ])

  return join(dir, 'kagami.conf')
}

test('the Python reader reads a conf the way the TypeScript one does', { skip: !PYTHON }, () => {
  const dir = fixture()
  const file = fixtureFiles(dir)
  const module = join(dir, 'kitty.py')

  writeFileSync(module, kittyWatcher({ themes: join(dir, 'themes'), backgrounds: dir, own: join(dir, 'kitty.conf') }))
  writeFileSync(join(dir, 'driver.py'), PYTHON_DRIVER)

  const shell = spawnSync('python3', [join(dir, 'driver.py'), dir, file], { encoding: 'utf8' })

  assert.equal(shell.status, 0, shell.stderr)
  assert.deepEqual(
    Object.entries(JSON.parse(shell.stdout)).sort(([a], [b]) => (a < b ? -1 : 1)),
    entries(readConf(file, dir, '/home/ke')),
  )
})

test('the Lua reader reads a conf the way the TypeScript one does', { skip: !LUA }, () => {
  const dir = fixture()
  const file = fixtureFiles(dir)

  const module = weztermModule({
    path: join(dir, 'wezterm.lua'),
    colors: dir,
    backgrounds: dir,
    mode: 'dark',
    palettes: [],
  })

  const from = module.indexOf('local BACKGROUNDS')
  const to = module.indexOf('local function layers(')

  assert.ok(from >= 0 && to > from)

  const script = join(dir, 'reader.lua')

  writeFileSync(script, `${module.slice(from, to)}\n${LUA_DRIVER}\n`)

  const shell = spawnSync('luajit', [script, file], { encoding: 'utf8' })

  assert.equal(shell.status, 0, shell.stderr)
  assert.deepEqual(
    shell.stdout.trimEnd().split('\n').sort(),
    entries(readConf(file, dir, '/home/ke'))
      .map(([key, value]) => `${key}=${value}`)
      .sort(),
  )
})
