import assert from 'node:assert/strict'
import { test } from 'node:test'
import { decode } from '../keys.ts'
import type { Grabber } from './attach.ts'
import { Own } from './own.ts'
import type { Mode, Panel } from './screen.ts'

const b64 = (text: string) => Buffer.from(text).toString('base64')

function osc(text: string) {
  const event = decode(text).events[0]
  assert.equal(event?.kind, 'osc')

  return event as Parameters<Grabber['take']>[0]
}

function desk(mode: Mode, panel?: Panel) {
  const view = { mode, panel, help: undefined, closing: undefined, query: undefined }
  const did: string[] = []

  const own = new Own({
    view: view as never,
    scratch: '',
    signal: new AbortController().signal,
    paint: { draw: () => {} } as never,
    boards: { noted: () => did.push('read'), alone: () => did.push('try') } as never,
    tags: { edit: () => did.push('edit'), write: () => did.push('write'), suggest: () => {}, shut: () => {} } as never,
    site: () => undefined,
    write: () => {},
    notice: (text) => did.push(text),
    hint: () => {},
    unhint: () => {},
    unhelp: () => did.push('unhelp'),
    unsave: () => {},
    tell: () => {},
    fill: () => {},
  })

  return { own, did }
}

test('text from the clipboard opens the tag field on the grid only, never under a picture being tried', async () => {
  const grid = desk({ on: 'grid' })
  await grid.own.clipped({ text: 'tamsin_(tidewater)' })
  assert.deepEqual(grid.did.slice(0, 1), ['edit'])
  const trying = desk({ on: 'try' })
  await trying.own.clipped({ text: 'tamsin_(tidewater)' })
  assert.deepEqual(trying.did, ['Nothing to use in that — drop a picture, or paste one or its link'])
})

test('a picture dropped while the settings panel is open is dropped like a paste', () => {
  const drop = ({ own }: ReturnType<typeof desk>) => {
    own.grabber.take(osc('\x1b]72;t=M:x=3:y=4:X=30:Y=40:o=3;image/png\x1b\\'))
    own.grabber.take(osc(`\x1b]72;t=r:x=1:m=1;${b64('PNG')}\x1b\\`))
    own.grabber.take(osc('\x1b]72;t=r:x=1:m=0\x1b\\'))
  }

  const grid = desk({ on: 'grid' })
  drop(grid)
  assert.deepEqual(grid.did.slice(0, 2), ['unhelp', 'read'])
  const panel = desk({ on: 'grid' }, { at: 0, advanced: false })
  drop(panel)
  assert.deepEqual(panel.did, [])
})
