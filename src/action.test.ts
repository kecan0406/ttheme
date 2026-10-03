import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const action = readFileSync(join(import.meta.dirname, '..', 'market', 'action.yml'), 'utf8')

test('the market action builds with the release its owner names, and the latest when none is named', () => {
  assert.match(action, /^inputs:\n {2}version:\n(?: {4}.*\n)*? {4}default: latest$/m)
  assert.match(action, /run: npx -y "@kecan0406\/ttheme@\$\{TTHEME_VERSION\}" market build \.$/m)
})

test('the market action hands its input to the shell through the environment, never inside the script', () => {
  const uses = action.split('\n').filter((line) => line.includes('inputs.'))
  assert.deepEqual(uses, ['        TTHEME_VERSION: ${{ inputs.version }}'])
})
