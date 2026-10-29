import { expect, test } from 'bun:test'
import { sceneLines } from './sessions'
import { piecesOf, plain, runOf } from './terminal'

test('a role names its text and ground slots, weight, faintness and cursor', () => {
  expect(runOf('a', '')).toEqual({ text: 'a', t: 1, g: 0 })
  expect(runOf('a', '0')).toEqual({ text: 'a', t: 4, g: 0 })
  expect(runOf('a', 'B4')).toEqual({ text: 'a', t: 8, g: 0, bold: true })
  expect(runOf('a', 'K2')).toEqual({ text: 'a', t: 4, g: 6 })
  expect(runOf('a', 'd')).toEqual({ text: 'a', t: 1, g: 0, faint: true })
  expect(runOf('a', 's')).toEqual({ text: 'a', t: 1, g: 3 })
  expect(runOf('a', 'c')).toEqual({ text: 'a', t: 1, g: 2, cursor: true })
})

test('the colors scene draws its first swatch in ANSI 0', () => {
  const [normal] = sceneLines('colors', plain(''))

  expect(normal?.map((run) => run.t)).toEqual([4, 5, 6, 7, 8, 9, 10, 11])
})

test('printable text stays loose, other text is boxed to its cells and each wide grapheme on its own', () => {
  expect(piecesOf('ls -F')).toEqual([{ text: 'ls -F', cells: 0, fill: false }])
  expect(piecesOf('ab☆c')).toEqual([
    { text: 'ab', cells: 0, fill: false },
    { text: '☆', cells: 1, fill: false },
    { text: 'c', cells: 0, fill: false },
  ])
  expect(piecesOf('かな x')).toEqual([
    { text: 'か', cells: 2, fill: false },
    { text: 'な', cells: 2, fill: false },
    { text: ' x', cells: 0, fill: false },
  ])
})

test('block elements are boxed apart so they can fill the cell, box drawing is not', () => {
  expect(piecesOf('▀▀│─')).toEqual([
    { text: '▀▀', cells: 2, fill: true },
    { text: '│─', cells: 2, fill: false },
  ])
})
