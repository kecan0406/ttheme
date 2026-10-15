import assert from 'node:assert/strict'
import { test } from 'node:test'
import { aliasesZsh } from './shell.ts'

test('a name holding a control character or a bidi control is left out of the aliases', () => {
  const text = aliasesZsh({ mio: ['芹沢\t美緒', '‪芹沢美緒', 'Mio Serizawa', '芹沢美緒'] })
  assert.match(text, /^ {2}mio "Mio Serizawa\|芹沢美緒"$/m)
})
