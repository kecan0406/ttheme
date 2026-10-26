import assert from 'node:assert/strict'
import { test } from 'node:test'
import { decodePng } from '../core/png.ts'
import { qrModules, qrPicture, qrScale } from './qr.ts'

test('a link too long for a QR code gets none instead of failing', () => {
  assert.ok(qrModules('x'.repeat(2953)))
  assert.equal(qrModules('x'.repeat(2954)), undefined)
})

test('a picture QR takes the largest module up to half a cell that fits, and none under a quarter', () => {
  const cell = { w: 16, h: 34 }

  assert.equal(qrScale(65, cell, { cols: 183, rows: 48 }), 8)
  assert.equal(qrScale(161, cell, { cols: 120, rows: 32 }), 6)
  assert.equal(qrScale(161, cell, { cols: 80, rows: 20 }), 4)
  assert.equal(qrScale(161, { w: 8, h: 17 }, { cols: 80, rows: 20 }), 2)

  const modules = qrModules('x'.repeat(2000)) as boolean[][]
  const tight = qrPicture(modules, cell, { cols: 80, rows: 10 }, 7)
  assert.equal(tight.out, '')
  assert.equal(tight.rows, Math.ceil(((modules.length + 8) * 4) / cell.h))
})

test('a picture QR fills whole cells with every module where the code has it', () => {
  const modules = qrModules('https://ttheme.dev/builder/tt5:abc') as boolean[][]
  const cell = { w: 16, h: 34 }
  const qr = qrPicture(modules, cell, { cols: 100, rows: 30 }, 7)

  const sent = qr.out
    .split('\x1b_G')
    .slice(1)
    .map((part) => part.slice(part.indexOf(';') + 1, part.indexOf('\x1b\\')))
    .join('')

  const image = decodePng(Buffer.from(sent, 'base64'))
  const scale = qrScale(modules.length + 8, cell, { cols: 100, rows: 30 })
  const side = (modules.length + 8) * scale

  assert.ok(
    qr.out.startsWith(
      `${'\n'.repeat(qr.rows)}\x1b[${qr.rows}A\x1b7\x1b_Ga=T,f=100,i=7,p=7,c=${qr.cols},r=${qr.rows},C=1,m=`,
    ),
  )
  assert.ok(qr.out.endsWith(`\x1b\\\x1b8\x1b[${qr.rows}B`))
  assert.equal(image.width, qr.cols * cell.w)
  assert.equal(image.height, qr.rows * cell.h)

  const left = Math.floor((image.width - side) / 2) + 4 * scale
  const top = Math.floor((image.height - side) / 2) + 4 * scale

  for (let y = 0; y < modules.length; y++) {
    for (let x = 0; x < modules.length; x++) {
      const at = ((top + y * scale + (scale >> 1)) * image.width + left + x * scale + (scale >> 1)) * 4
      assert.equal(image.data[at], modules[y]?.[x] ? 0 : 255)
    }
  }

  assert.equal(image.data[0], 255)
})
