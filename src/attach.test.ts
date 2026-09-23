import assert from 'node:assert/strict'
import { test } from 'node:test'
import { type Got, Grabber, jpegSize, pastedRefs, takeInbound } from './attach.ts'

const files = new Set(['/pics/a.png', '/pics/my pic.png', '/pics/b.jpg'])
const exists = (path: string) => files.has(path)
const b64 = (text: string) => Buffer.from(text).toString('base64')

test('pastedRefs reads every way a terminal hands over dropped files', () => {
  assert.deepEqual(pastedRefs('/pics/my\\ pic.png /pics/a.png', exists), ['/pics/my pic.png', '/pics/a.png'])
  assert.deepEqual(pastedRefs("'/pics/my pic.png' '/pics/b.jpg'", exists), ['/pics/my pic.png', '/pics/b.jpg'])
  assert.deepEqual(pastedRefs('/pics/my pic.png\n/pics/a.png\n', exists), ['/pics/my pic.png', '/pics/a.png'])
  assert.deepEqual(pastedRefs('/pics/my pic.png ', exists), ['/pics/my pic.png'])
  assert.deepEqual(pastedRefs('file:///pics/my%20pic.png', exists), ['/pics/my pic.png'])
  assert.deepEqual(pastedRefs('https://example.com/x.png', exists), ['https://example.com/x.png'])
  assert.deepEqual(pastedRefs('/pics/missing.png hello', exists), [])
})

test('jpegSize reads the frame header', () => {
  const bytes = new Uint8Array([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0x58, 0x03, 0x20, 0x03,
  ])
  assert.deepEqual(jpegSize(bytes), { width: 800, height: 600 })
  assert.equal(jpegSize(new Uint8Array([0x89, 0x50])), null)
})

test('takeInbound splits pastes and protocol replies from keys and keeps unfinished ones', () => {
  const split = takeInbound('a\x1b[200~/pics/a')
  assert.deepEqual(split, { events: [], keys: 'a', pending: '\x1b[200~/pics/a' })
  const done = takeInbound(`${split.pending}.png\x1b[201~\x1b[Ab`)
  assert.deepEqual(done.events, [{ kind: 'paste', text: '/pics/a.png' }])
  assert.equal(done.keys, '\x1b[Ab')
  const replies = takeInbound('\x1b[?5522;2$y\x1b]72;t=q\x1b\\\x1b[?62;22c')
  assert.deepEqual(replies.events, [
    { kind: 'mode', mode: 5522, value: 2 },
    { kind: 'osc', code: '72', meta: { t: 'q' }, payload: '' },
    { kind: 'attributes' },
  ])
  assert.equal(takeInbound('\x1b]5522;type=read').pending, '\x1b]5522;type=read')
})

function grabber(): { sent: string[]; got: Got[]; grab: Grabber } {
  const sent: string[] = []
  const got: Got[] = []
  return {
    sent,
    got,
    grab: new Grabber(
      (text) => sent.push(text),
      (item) => got.push(item),
    ),
  }
}

function osc(text: string) {
  const event = takeInbound(text).events[0]
  assert.equal(event?.kind, 'osc')
  return event as Parameters<Grabber['take']>[0]
}

test('a kitty paste event is answered with a read that carries its one-time password', () => {
  const { sent, got, grab } = grabber()
  const pw = b64('secret')
  grab.take(osc(`\x1b]5522;type=read:status=OK:pw=${pw}\x1b\\`))
  grab.take(osc(`\x1b]5522;type=read:status=DATA:mime=${b64('.')}:pw=${pw};${b64('text/plain image/png\n')}\x1b\\`))
  grab.take(osc(`\x1b]5522;type=read:status=DONE:pw=${pw}\x1b\\`))
  assert.deepEqual(sent, [`\x1b]5522;type=read:name=${b64('Paste event')}:pw=${pw};${b64('image/png')}\x1b\\`])
  grab.take(osc('\x1b]5522;type=read:status=OK\x1b\\'))
  grab.take(osc(`\x1b]5522;type=read:status=DATA:mime=${b64('image/png')};${b64('PNG1')}\x1b\\`))
  grab.take(osc(`\x1b]5522;type=read:status=DATA:mime=${b64('image/png')};${b64('PNG2')}\x1b\\`))
  grab.take(osc('\x1b]5522;type=read:status=DONE\x1b\\'))
  assert.equal(got.length, 1)
  assert.equal(got[0]?.kind, 'bytes')
  assert.equal(Buffer.from((got[0] as { bytes: Uint8Array }).bytes).toString(), 'PNG1PNG2')
})

test('a drop is accepted, read in chunks and closed', () => {
  const { sent, got, grab } = grabber()
  grab.take(osc('\x1b]72;t=m:x=3:y=4:X=30:Y=40:o=3;text/plain image/png\x1b\\'))
  assert.equal(sent.at(-1), '\x1b]72;t=m:o=1;image/png text/plain\x1b\\')
  grab.take(osc('\x1b]72;t=M:x=3:y=4:X=30:Y=40:o=3;text/plain image/png\x1b\\'))
  assert.equal(sent.at(-1), '\x1b]72;t=r:x=2\x1b\\')
  grab.take(osc(`\x1b]72;t=r:x=2:m=1;${b64('ab')}\x1b\\`))
  grab.take(osc(`\x1b]72;m=1;${b64('cd')}\x1b\\`))
  grab.take(osc('\x1b]72;t=r:x=2:m=0\x1b\\'))
  assert.equal(sent.at(-1), '\x1b]72;t=r:o=1\x1b\\')
  assert.equal(Buffer.from((got[0] as { bytes: Uint8Array }).bytes).toString(), 'abcd')
})
