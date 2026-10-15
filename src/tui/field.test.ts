import assert from 'node:assert/strict'
import { test } from 'node:test'
import { edit, Field } from './field.ts'

test('a C1 control is no character a field takes, typed or pasted', () => {
  assert.equal(edit('ab', '\x85'), undefined)
  assert.equal(edit('ab', '\x9f'), undefined)
  assert.equal(edit('ab', '\xa0'), 'ab\xa0')
  const field = new Field('a')
  field.paste('b\x9bc\x80d')
  assert.equal(field.value, 'abcd')
})
