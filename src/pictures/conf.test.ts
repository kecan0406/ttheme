import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { ROOT } from '../root.ts'
import {
  CONF_DEPTH,
  CONF_INCLUDE,
  CONF_KEYS,
  CONF_OPTIONAL,
  confReaderLua,
  confReaderPython,
  readConf,
} from './conf.ts'

function fixture(): string {
  return mkdtempSync(join(tmpdir(), 'ttheme-conf-'))
}

function conf(dir: string, name: string, lines: string[]): string {
  const path = join(dir, name)

  mkdirSync(dir, { recursive: true })
  writeFileSync(path, `${lines.join('\n')}\n`)

  return path
}

test('the reader reads the keys the format names and follows the include it holds', () => {
  const dir = fixture()

  conf(dir, 'tune.conf', ['background-image-opacity = 0.4'])

  const file = conf(dir, 'tamsin.conf', [
    '# by someone',
    'background-image = /pictures/tamsin.png',
    'background-image-fit = cover',
    'background-image-position = top-right',
    'background-image-opacity = 0.2',
    'config-file = ?tune.conf',
  ])

  const set = readConf(file, dir, '/home/ke')

  assert.ok(set)
  assert.equal(set.get('background-image'), '/pictures/tamsin.png')
  assert.equal(set.get('background-image-fit'), 'cover')
  assert.equal(set.get('background-image-position'), 'top-right')
  assert.equal(set.get('background-image-opacity'), '0.4')
  assert.equal(set.has('# by someone'), false)
})

test('the reader follows at most the depth the format sets, so an include loop ends', () => {
  const dir = fixture()

  for (let level = 0; level < CONF_DEPTH + 3; level++) {
    conf(dir, `level-${level}.conf`, [
      `background-image-opacity = 0.${level}`,
      ...(level < CONF_DEPTH + 2 ? [`config-file = ?level-${level + 1}.conf`] : []),
    ])
  }

  const set = readConf(join(dir, 'level-0.conf'), dir, '/home/ke')

  assert.ok(set)
  assert.equal(set.get('background-image-opacity'), `0.${CONF_DEPTH}`)
})

test('a file that includes itself ends the reader instead of hanging it', () => {
  const dir = fixture()

  conf(dir, 'loop.conf', ['background-image-opacity = 0.3', 'config-file = ?loop.conf'])

  const set = readConf(join(dir, 'loop.conf'), dir, '/home/ke')

  assert.ok(set)
  assert.equal(set.get('background-image-opacity'), '0.3')
})

test('the generated Python reader carries the format it was generated from', () => {
  const reader = confReaderPython().join('\n')

  assert.match(reader, new RegExp(`if key == '${CONF_INCLUDE}':`))
  assert.match(reader, new RegExp(`if depth < ${CONF_DEPTH}:`))
  assert.match(reader, /def read\(path, into, depth=0\):/)
  assert.equal(reader.split('depth + 1').length - 1, 1)
})

test('the generated Lua reader carries the format it was generated from', () => {
  const reader = confReaderLua().join('\n')

  assert.match(reader, new RegExp(`if key == '${CONF_INCLUDE}' then`))
  assert.match(reader, new RegExp(`if depth < ${CONF_DEPTH} then`))
  assert.match(reader, /read\(locate\(\(value:gsub\('\^%\?', ''\)\)\), into, depth \+ 1\)/)
  assert.equal(reader.split('depth + 1').length - 1, 1)
})

test('every key the format names is one the reader takes', () => {
  const dir = fixture()

  const file = conf(
    dir,
    'tamsin.conf',
    CONF_KEYS.map((key, index) => `${key} = ${index}`),
  )

  const set = readConf(file, dir, '/home/ke')

  assert.ok(set)

  for (const [index, key] of CONF_KEYS.entries()) {
    assert.equal(set.get(key), `${index}`)
  }
})

test('the shell layer reads the keys the format names, and no others', () => {
  const text = readFileSync(join(ROOT, 'shell', 'adapters', '_bg.zsh'), 'utf8')
  const keys = [...new Set(text.match(/background-image[a-z-]*/g) ?? [])].sort()

  assert.deepEqual(keys, [...CONF_KEYS].sort())
})

test('the shell layer writes and follows the include the format names', () => {
  const text = readFileSync(join(ROOT, 'shell', 'adapters', '_bg.zsh'), 'utf8')

  assert.ok(text.includes(`${CONF_INCLUDE} = ${CONF_OPTIONAL}`))
  assert.ok(text.includes(`${CONF_INCLUDE} = ${CONF_OPTIONAL}$`))
})
