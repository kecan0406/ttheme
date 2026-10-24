import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { WIRED } from '../core/wired.ts'
import { ROOT } from '../root.ts'
import { WIRINGS } from './index.ts'
import { TRAITS } from './terminal.ts'

const root = ROOT
const read = (...path: string[]) => readFileSync(join(root, ...path), 'utf8')

test('every wired terminal is one module: its own id, emitter, traits row and shell adapter', () => {
  for (const id of WIRED) {
    const wiring = WIRINGS[id]
    assert.equal(wiring.id, id)
    assert.equal(wiring.emitter.id, id, `${id} emits under another terminal's name`)
    assert.ok(id in TRAITS, `${id} has no TRAITS row`)
    assert.ok(existsSync(join(root, 'shell', 'adapters', `${id}.zsh`)), `${id} has no shell adapter`)
  }
})

test('the shell bakes pictures for exactly the wired terminals that cannot place one', () => {
  const aligns = /^__tt_bg_aligns\(\) \{ (.*) \}$/m.exec(read('shell', 'adapters', '_wired.zsh'))?.[1] ?? ''
  const named = [...aligns.matchAll(/\(Ie\)([\w-]+)\]/g)].map(([, id]) => id)
  assert.deepEqual(
    named,
    WIRED.filter((id) => WIRINGS[id].bakes),
  )
})

test('every wired terminal has its column in the support tables', () => {
  for (const file of [['README.md'], ['docs', 'reference', 'terminals.md']]) {
    const head = read(...file)
      .split('\n')
      .find((line) => line.startsWith('|') && line.includes('Ghostty'))

    for (const id of WIRED) {
      assert.ok(head?.includes(` ${WIRINGS[id].name} `), `${file.join('/')} has no ${WIRINGS[id].name} column`)
    }
  }
})
