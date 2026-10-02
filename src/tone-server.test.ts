import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { backgroundsDir } from './backdrop.ts'
import { writeCatalog } from './catalog.ts'
import type { Manifest, PaletteEntry } from './manifest.ts'
import { writeInstalled } from './palettes.ts'
import { encodeMask } from './png.ts'
import { readTone } from './tone.ts'
import { ToneSession } from './tone-server.ts'

function entry(name: string): PaletteEntry {
  return {
    name,
    group: 'Jujutsu Kaisen',
    order: 1,
    ansiSource: 'Horizon + Jujutsu',
    background: '#11191c',
    foreground: '#e3e2e7',
    cursor: '#7cc1d6',
    selection: '#383b5b',
    signature: ['#7cc1d6', '#e3e2e7', '#d7bcf3'],
    signatureSlots: ['cursor', 'foreground', 'ansi13'],
    ansi: Array.from({ length: 16 }, (_, i) => `#${(0x20 + i * 8).toString(16).padStart(2, '0').repeat(3)}`),
    gate: [13.8, 6.8, 0.02, 10.4, 4.0],
    backdrop: { slot: 'cursor', color: '#7cc1d6', opacity: 0.2 },
  }
}

const catalog: Manifest = {
  version: '0.1.0',
  gate: [],
  placement: { tall: 1.15, reach: 0.4, widest: 0.95, headroom: 0.04, margin: 0.03, stands: 12 },
  palettes: [entry('gojo')],
}

function session(): { home: string; tone: ToneSession } {
  const home = mkdtempSync(join(tmpdir(), 'ttheme-tone-server-'))
  writeCatalog(home, catalog)
  writeInstalled(home, { terminals: ['ghostty'], palettes: ['gojo'] })
  return { home, tone: new ToneSession(home, 'gojo', false) }
}

function fields(reply: string | undefined): string[] {
  assert.ok(reply !== undefined)
  return reply.split('\x1f')
}

test('a frame tells the host the status, the signal, the mode, the dirt, the colors, the keys and then the panel lines', () => {
  const { tone } = session()
  tone.handle('size 50 24')
  const f = fields(tone.handle('focus 1'))
  assert.equal(f[0], 'ok')
  assert.equal(f[1], '-')
  assert.equal(f[2], 'list')
  assert.equal(f[3], '0')
  assert.equal((f[4] ?? '').split(' ').length, 20)
  assert.ok((f[5] ?? '').split('\x1e').includes('enter'))
  assert.equal(f[8], '2')
  assert.equal(f[9], '0')
  assert.equal(f[10], '')
  assert.equal(f.length, 11 + 24)
  assert.equal(fields(tone.handle('key up'))[1], 'above')
  assert.equal(fields(tone.handle('ch 107'))[1], 'above')
  tone.handle('key end')
  assert.equal(fields(tone.handle('key down'))[1], 'below')
  assert.equal(fields(tone.handle('render'))[8], '15')
})

test('enter tunes a slot, which shows in the colors and the dirt, r puts it back and s saves the tone', () => {
  const { home, tone } = session()
  tone.handle('key down')
  tone.handle('key down')
  assert.equal(fields(tone.handle('key enter'))[2], 'tune')
  tone.handle('key right')
  tone.handle('key right')
  tone.handle('key enter')
  const edited = fields(tone.handle('render'))
  assert.equal(edited[3], '1')
  assert.notEqual((edited[4] ?? '').split(' ')[2], '#7cc1d6')

  const saved = fields(tone.handle('save'))
  assert.equal(saved[0], 'saved')
  assert.equal(saved[3], '0')
  assert.ok(readTone(home).gojo?.cursor)

  tone.handle('ch 114')
  const reset = fields(tone.handle('render'))
  assert.equal((reset[4] ?? '').split(' ')[2], '#7cc1d6')
  assert.equal(reset[3], '1')
  tone.handle('save')
  assert.deepEqual(readTone(home), {})
})

test('s and esc outside a tuning are signals for the host, and inside one esc stays the editor’s', () => {
  const { tone } = session()
  assert.equal(fields(tone.handle('ch 115'))[1], 'save')
  assert.equal(fields(tone.handle('key esc'))[1], 'cancel')
  assert.equal(fields(tone.handle('key down'))[1], '-')
  tone.handle('key tab')
  assert.equal(fields(tone.handle('render'))[2], 'tune')
  assert.equal(fields(tone.handle('key esc'))[1], '-')
  assert.equal(fields(tone.handle('render'))[2], 'list')
})

test('a frame says the colors being tuned would recolor the shown picture, and names a copy tinted that way', () => {
  const { home, tone } = session()
  const dir = backgroundsDir(home)
  mkdirSync(dir, { recursive: true })
  const image = join(dir, 'a.png')
  writeFileSync(image, encodeMask({ width: 2, height: 2, data: Uint8Array.from([0, 64, 128, 255]) }, '#7cc1d6'))
  const picture = { key: 'a', stem: 'a', fill: 'a.png', opacity: 0.2, tone: '#7cc1d6' }
  writeFileSync(
    join(dir, 'images.json'),
    JSON.stringify({ version: 1, palettes: { gojo: { active: 'a', pictures: [picture] } } }),
  )
  const same = fields(tone.handle(`show ${image}`))
  assert.equal(same[9], '0')
  assert.equal(same[10]?.split('\x1e')[0], image)
  for (const key of ['down', 'down', 'enter', 'right', 'right', 'right', 'enter']) {
    tone.handle(`key ${key}`)
  }
  const tuned = fields(tone.handle('render'))
  const [tinted = '', opacity] = (tuned[10] ?? '').split('\x1e')
  assert.equal(tuned[9], '1')
  assert.notEqual(tinted, image)
  assert.ok(existsSync(tinted))
  assert.match(opacity ?? '', /^\d+(\.\d+)?$/)
  tone.close()
  assert.ok(!existsSync(tinted))
})
