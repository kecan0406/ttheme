import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { STEM_RULES, stem } from '../core/theme.ts'
import { ROOT } from '../root.ts'
import { stemLua, stemPython, stemZsh } from './emit/stem.ts'

function shellFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    const path = join(dir, item.name)

    return item.isDirectory() ? shellFiles(path) : item.name.endsWith('.zsh') ? [path] : []
  })
}

const quoted = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')

const CANONICAL = new RegExp(quoted(stemZsh('EXPR')).replace('EXPR', '[^}]*'), 'g')

test('the rules turn a palette name into the file stem the terminals use', () => {
  assert.equal(stem('orla'), 'orla')
  assert.equal(stem('kumquat@marketplace'), 'kumquat--marketplace')
  assert.equal(stem('kumquat@marketplace/orla'), 'kumquat--marketplace--orla')
})

test('the rules replace the first match of each, as the shell does', () => {
  assert.equal(stem('a@b@c'), 'a--b@c')
  assert.equal(stem('a/b/c'), 'a--b/c')
})

test('the generated Python and Lua stems carry every rule', () => {
  for (const [from, to] of STEM_RULES) {
    assert.ok(stemPython('palette').includes(`replace('${from}', '${to}', 1)`))
    assert.ok(stemLua('palette').includes(`gsub('${from}', '${to}', 1)`))
  }

  assert.equal(stemPython('palette'), "palette.replace('@', '--', 1).replace('/', '--', 1)")
  assert.equal(stemLua('palette'), "((palette:gsub('@', '--', 1)):gsub('/', '--', 1))")
})

test('every mangling in the shell layer is the canonical form the rules make', () => {
  for (const file of shellFiles(join(ROOT, 'shell'))) {
    const text = readFileSync(file, 'utf8')
    const mangled = text.split('@/--').length - 1
    const canonical = text.match(CANONICAL)?.length ?? 0

    assert.equal(mangled, canonical, `${file}: ${mangled} manglings, ${canonical} in the canonical form`)
  }
})

test('the canonical form computes what the rules compute', () => {
  const names = ['orla', 'kumquat@marketplace', 'kumquat@marketplace/orla', 'a@b@c']

  const shell = spawnSync('zsh', ['-f', '-c', `for x in "$@"; do print -r -- ${stemZsh('x')}; done`, '--', ...names], {
    encoding: 'utf8',
  })

  assert.equal(shell.status, 0, shell.stderr)
  assert.deepEqual(
    shell.stdout.trimEnd().split('\n'),
    names.map((name) => stem(name)),
  )
})
