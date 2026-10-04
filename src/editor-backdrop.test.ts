import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { backdropTone, backgroundsDir } from './backdrop.ts'
import { rgb } from './color.ts'
import { Backdrop } from './editor-backdrop.ts'
import { listOf } from './palette-editor.ts'
import { encodeMask } from './png.ts'
import { grow, SEEDS } from './seeds.ts'

const NAME = 'kec@dust/rei'
const SIGNATURE = ['background', 'foreground', 'cursor']
const colors = grow(SEEDS)

function home(): { home: string; image: string } {
  const at = mkdtempSync(join(tmpdir(), 'ttheme-backdrop-'))
  const dir = backgroundsDir(at)
  mkdirSync(dir, { recursive: true })
  const image = join(dir, 'kec--dust--rei.a1.png')
  const tone = backdropTone({ name: NAME, ...colors }, SIGNATURE).color
  writeFileSync(image, encodeMask({ width: 40, height: 20, data: new Uint8Array(800).fill(200) }, tone))
  const picture = { key: 'a', stem: 'kec--dust--rei.a1', fill: 'kec--dust--rei.a1.png', opacity: 0.3, tone }
  writeFileSync(
    join(dir, 'images.json'),
    JSON.stringify({ version: 1, palettes: { [NAME]: { active: 'a', pictures: [picture] } } }),
  )
  writeFileSync(
    join(dir, 'kec--dust--rei.conf'),
    `background-image = ${image}\nbackground-image-fit = cover\nbackground-image-position = top-right\nbackground-image-opacity = 0.3\n`,
  )
  return { home: at, image }
}

const b64 = (text: string) => Buffer.from(text).toString('base64')

test('the editor lays the draft background under its picture, and tints a copy as the colors move', () => {
  const { home: at, image } = home()
  const backdrop = Backdrop.of({ TERM_PROGRAM: 'ghostty' }, at, NAME, ['ghostty'])
  assert.ok(backdrop)
  backdrop.load()
  const list = listOf(colors)
  assert.equal(backdrop.draw(list, SIGNATURE, [], 80, 24), '')
  backdrop.measured({ w: 10, h: 20 })
  const first = backdrop.draw(list, SIGNATURE, [], 80, 24)
  assert.ok(first.includes(Buffer.from(rgb(colors.background)).toString('base64')))
  assert.ok(first.includes(b64(image)))
  assert.equal(backdrop.draw(list, SIGNATURE, [], 80, 24), '')
  const lighter = ['#30343c', ...list.slice(1)]
  assert.ok(backdrop.draw(lighter, SIGNATURE, [], 80, 24).includes(Buffer.from(rgb('#30343c')).toString('base64')))
  const tuned = [...list.slice(0, 2), '#ff8800', ...list.slice(3)]
  const moved = backdrop.draw(tuned, SIGNATURE, [], 80, 24)
  assert.match(moved, /a=t,t=f/)
  assert.ok(!moved.includes(b64(image)))
  backdrop.close()
})

test('the builder frames the picture in its preview and keeps it off the slot list', () => {
  const { home: at } = home()
  const backdrop = Backdrop.of({ TERM_PROGRAM: 'ghostty' }, at, NAME, ['ghostty'])
  assert.ok(backdrop)
  backdrop.load()
  backdrop.measured({ w: 10, h: 20 })
  const list = listOf(colors)
  const area = { col: 30, row: 2, cols: 50, rows: 21 }
  const framed = backdrop.draw(list, SIGNATURE, [], 80, 24, area)
  assert.ok(framed.includes('\x1b[3;31H\x1b_Ga=p,'))
  assert.match(framed, /,x=16,y=0,w=23,h=20,c=50,r=21,/)
  backdrop.resized()
  const whole = backdrop.draw(list, SIGNATURE, [], 80, 24)
  assert.ok(whole.includes('\x1b[1;1H\x1b_Ga=p,'))
  assert.match(whole, /,c=80,r=24,/)
  backdrop.close()
  const wez = Backdrop.of({ WEZTERM_PANE: '1' }, at, NAME, ['wezterm'])
  assert.ok(wez)
  wez.load()
  wez.measured({ w: 10, h: 20 })
  const view = /ttheme_view=([A-Za-z0-9+/=]+)/.exec(wez.draw(list, SIGNATURE, [], 80, 24, area))?.[1] ?? ''
  assert.match(Buffer.from(view, 'base64').toString(), /\|800\|480\|500\|250\|300\|40\|3$/)
  wez.close()
})

test('WezTerm gets the draft as its view, and Warp is left to its own picture', () => {
  const { home: at, image } = home()
  const backdrop = Backdrop.of({ WEZTERM_PANE: '1' }, at, NAME, ['wezterm'])
  assert.ok(backdrop)
  backdrop.load()
  backdrop.measured({ w: 10, h: 20 })
  const out = backdrop.draw(listOf(colors), SIGNATURE, [], 80, 24)
  const view = Buffer.from(/ttheme_view=([A-Za-z0-9+/=]+)/.exec(out)?.[1] ?? '', 'base64').toString()
  assert.ok(view.startsWith(`${colors.background}|${image}|`))
  assert.equal(Backdrop.of({ TERM_PROGRAM: 'WarpTerminal' }, at, NAME, ['warp']), undefined)
  backdrop.close()
})
