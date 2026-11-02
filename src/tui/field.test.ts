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

test('a bidi control is no character a field takes, typed or pasted', () => {
  assert.equal(edit('ab', '\u202e'), undefined)
  assert.equal(edit('ab', '\u200e'), undefined)
  const field = new Field('a')
  field.paste('b\u2067c\u200fd')
  assert.equal(field.value, 'abcd')
})

test('a paste stops at 1024 characters, so a stray megabyte does not slow every key after it', () => {
  const field = new Field('a')
  field.paste('한'.repeat(5000))
  assert.equal([...field.value].length, 1024)
  field.paste('more')
  assert.equal([...field.value].length, 1024)
})
