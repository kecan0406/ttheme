import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { movePins, pinsPath } from './pins.ts'
import { type Moves, plan, renameProblems } from './renames.ts'

const ID = 'ann@pastel'

function moved(renames: Record<string, string | false>, installed: string[], forceRemove = false): Moves {
  const moves: Moves = { renamed: new Map(), removed: [] }
  plan(ID, { renames, forceRemove }, new Set(['dusk', 'noon']), installed, moves)
  return moves
}

test('an installed palette its marketplace renamed follows the chain to the palette there now, and one mapped to false is removed', () => {
  const moves = moved({ dawn: 'twilight', twilight: 'dusk', old: false }, [
    `${ID}/dawn`,
    `${ID}/old`,
    `${ID}/noon`,
    'bob@x/dawn',
  ])
  assert.deepEqual([...moves.renamed], [[`${ID}/dawn`, `${ID}/dusk`]])
  assert.deepEqual(moves.removed, [`${ID}/old`])
})

test('a palette that left its marketplace stays installed unless the marketplace asks for its removal, and a chain that loops goes nowhere', () => {
  assert.deepEqual(moved({ a: 'b', b: 'a' }, [`${ID}/a`, `${ID}/gone`]), { renamed: new Map(), removed: [] })
  assert.deepEqual(moved({ a: 'b', b: 'a' }, [`${ID}/a`, `${ID}/gone`], true).removed, [`${ID}/a`, `${ID}/gone`])
})

test('marketplace check names a chain that loops or ends off the marketplace, and a rename of a palette still there', () => {
  const { errors, warnings } = renameProblems(
    { a: 'b', b: 'a', c: 'missing', noon: 'dusk', fine: 'dusk', gone: false },
    new Set(['dusk', 'noon']),
  )
  assert.equal(errors.length, 3)
  assert.match(errors.join('\n'), /renames\.c: the chain ends at missing/)
  assert.deepEqual(warnings, ['renames.noon: noon is still a palette here, so the rename never applies'])
})

test('pins follow a renamed palette and drop a removed one, leaving the rest of the file as it was', () => {
  const home = mkdtempSync(join(tmpdir(), 'ttheme-pins-'))
  mkdirSync(join(home, 'ttheme'))
  writeFileSync(pinsPath(home), `~/a/**        ${ID}/dawn\nssh:box       ${ID}/old\n/srv two/**   konata\n`)
  movePins(home, new Map([[`${ID}/dawn`, `${ID}/dusk`]]), [`${ID}/old`])
  assert.equal(readFileSync(pinsPath(home), 'utf8'), `~/a/**        ${ID}/dusk\n/srv two/**   konata\n`)
})
