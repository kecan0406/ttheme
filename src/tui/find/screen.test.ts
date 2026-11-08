import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { type FindView, findHovers, findTopics, type Row, renderFind, stepped, transmit } from './screen.ts'

test('a step from a typed value goes to the nearest step that way, and steps wrap around', () => {
  const sizes = ['off', '720', '1080', '1440', '1800', '2560']
  assert.equal(stepped(sizes, '1600', 1), '1800')
  assert.equal(stepped(sizes, '1600', -1), '1440')
  assert.equal(stepped(sizes, '3000', 1), 'off')
  assert.equal(stepped(sizes, '2560', 1), 'off')
  assert.equal(stepped(sizes, 'off', -1), '2560')
})

test('transmit sends the picture itself, in chunks, to a terminal that reads no files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ttheme-transmit-'))
  const path = join(dir, 'p.png')
  const bytes = Buffer.from(Array.from({ length: 5000 }, (_, i) => i % 256))
  writeFileSync(path, bytes)
  const p = { id: 9, path, row: 0, col: 0, cols: 4, rows: 2, z: -1 }
  assert.equal(transmit(p), `\x1b_Ga=t,t=f,f=100,i=9,q=2;${Buffer.from(path).toString('base64')}\x1b\\`)
  const sent = transmit(p, false) ?? ''
  const chunks = sent.split('\x1b_G').slice(1)
  assert.ok(chunks[0]?.startsWith('a=t,f=100,i=9,m=1,q=2;'))
  assert.ok(chunks.at(-1)?.startsWith('m=0,q=2;'))
  const data = chunks.map((chunk) => chunk.slice(chunk.indexOf(';') + 1, -2)).join('')
  assert.deepEqual(Buffer.from(data, 'base64'), bytes)
  assert.equal(transmit({ ...p, path: join(dir, 'gone.png') }, false), undefined)
})

function viewOf(over: Partial<FindView> = {}): FindView {
  const row = (label: string, choices: string[], extra: Partial<Row> = {}): Row => ({
    label,
    about: 'Posts scored at least this — danbooru, konachan and yande.re; zerochan keeps no score',
    choices,
    value: choices.join(' '),
    default: choices.join(' '),
    cursor: 0,
    ...extra,
  })

  const tune = { size: 'fill' as const, at: 2, opacity: 0.2 }

  return {
    palette: 'miku',
    tag: 'hatsune_miku',
    site: 'all',
    siteAnsi: 6,
    nextSite: 'danbooru',
    preset: 'cutouts',
    order: 'fit',
    solo: false,
    rating: ['safe'],
    block: ['nudity', 'underwear'],
    sets: 'fold',
    narrow: { score: 0, size: 0, png: false },
    enabled: ['danbooru'],
    hide: [],
    hideTags: [],
    settings: [
      row('Rating', ['safe', 'questionable', 'explicit'], { multi: {} }),
      row('Block', ['nudity', 'underwear'], { multi: { none: 'none' } }),
      row('Posts', ['all', 'cutouts'], { value: 'all', default: 'all' }),
      row('Solo', ['on', 'off'], { value: 'off', default: 'off' }),
      row('Order', ['fit', 'newest', 'score'], { value: 'fit', default: 'fit' }),
      row('Sets', ['fold', 'show'], { value: 'fold', default: 'fold' }),
      row('Remove bg', ['on', 'off'], { value: 'on', default: 'on' }),
      row('Min score', ['off', '5', '10', '25', '50', '100'], {
        value: 'off',
        default: 'off',
        entry: 'number',
        advanced: true,
      }),
      row('Min size', ['off', '720', '1080', '1440', '1800', '2560'], {
        value: 'off',
        default: 'off',
        entry: 'number',
        advanced: true,
      }),
      row('Sites', ['danbooru', 'konachan', 'yande.re', 'zerochan'], { multi: {}, advanced: true }),
      row('Hide', ['comic', 'monochrome', 'sketch', 'chibi'], { multi: { none: 'none' }, advanced: true }),
    ],
    panel: 0,
    advanced: false,
    colors: { cursor: '#ffffff', selection: '#333333', background: '#000000', foreground: '#eeeeee', ansi: [] },
    tiles: [],
    installed: [],
    queued: [],
    held: [],
    checked: 0,
    total: 0,
    searching: false,
    stage: 'fetch',
    sites: [],
    focus: 0,
    top: 0,
    scroll: 0,
    beat: 0,
    mode: 'grid',
    help: undefined,
    scene: 0,
    details: false,
    tune,
    untuned: tune,
    coloring: 'tone',
    chips: [],
    ...over,
  }
}

test('the settings panel in a window too short for it shows what fits instead of failing', () => {
  const frame = renderFind(viewOf(), 25, 21)
  assert.equal(frame.lines.length, 21)
  assert.match(frame.lines[1] ?? '', /Settings/)
})

test('a tag a site sends with control or direction characters is drawn without them', () => {
  const rlo = String.fromCodePoint(0x202e)
  const frame = renderFind(viewOf({ tag: `hatsune_miku\x1b]52;c;aGk=\x07${rlo}`, panel: undefined }), 100, 30)
  const out = frame.lines.join('\n')
  assert.match(out, /hatsune_miku\]52;c;aGk=/)
  assert.ok(!out.includes('\x1b]52') && !out.includes('\x07') && !out.includes(rlo))
})

test('the tile under the pointer takes a dim frame, the focused one keeps its own, and nothing else is framed', () => {
  const tile = (id: number): FindView['tiles'][number] => ({
    id,
    key: id,
    site: 'danbooru',
    siteAnsi: 6,
    width: 1920,
    height: 1080,
    reduced: false,
    page: '',
    artist: 'someone',
    score: 1,
    variants: 0,
    mates: [],
  })

  const framed = (pointer?: { row: number; col: number }) =>
    renderFind(viewOf({ panel: undefined, tiles: [tile(1), tile(2), tile(3)], pointer }), 100, 30)
      .lines.join('\n')
      .split('╭').length - 1

  assert.equal(framed(), 1)
  assert.equal(framed({ row: 10, col: 30 }), 2)
  assert.equal(framed({ row: 10, col: 5 }), 1)
  assert.equal(framed({ row: 10, col: 90 }), 1)
  assert.equal(framed({ row: 1, col: 30 }), 1)
})

test('no tile takes a hover frame while find waits to close', () => {
  const tile = {
    id: 1,
    key: 1,
    site: 'danbooru',
    siteAnsi: 6,
    width: 1920,
    height: 1080,
    reduced: false,
    page: '',
    artist: 'someone',
    score: 1,
    variants: 0,
    mates: [],
  }

  const view = viewOf({ panel: undefined, tiles: [tile, { ...tile, id: 2, key: 2 }], pointer: { row: 10, col: 30 } })

  assert.equal(renderFind(view, 100, 30).lines.join('\n').split('╭').length - 1, 2)
  assert.equal(
    renderFind({ ...view, closing: true }, 100, 30)
      .lines.join('\n')
      .split('╭').length - 1,
    1,
  )
})

test('only what a click would act on in the state find is in lights under the pointer', () => {
  const grid = viewOf({ panel: undefined })
  assert.ok(findHovers(grid, { kind: 'tile', index: 0 }))
  assert.ok(findHovers(grid, { kind: 'site', tab: 1 }))
  assert.ok(!findHovers(grid, { kind: 'setting', index: 0 }))
  assert.ok(findHovers(viewOf(), { kind: 'setting', index: 0 }))
  assert.ok(!findHovers(viewOf(), { kind: 'tile', index: 0 }))
  assert.ok(!findHovers(viewOf({ panel: undefined, closing: true }), { kind: 'tile', index: 0 }))
  assert.ok(findHovers(grid, { kind: 'key', key: 'esc' }))
  assert.ok(!findHovers(viewOf({ panel: undefined, mode: 'try' }), { kind: 'tile', index: 0 }))
  assert.ok(findHovers(viewOf({ panel: undefined, mode: 'try' }), { kind: 'scene', scene: 1 }))
})

test('the Advanced topic of the help presses the a the grid takes', () => {
  const pressed: string[] = []
  const topics = findTopics(viewOf({ panel: undefined }), (key) => pressed.push(key))
  topics.find((t) => t.does === 'Open the advanced filters')?.run?.()
  assert.deepEqual(pressed, ['a'])
})
