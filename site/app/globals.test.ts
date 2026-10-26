import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import tailwind from '@tailwindcss/postcss'
import postcss from 'postcss'

const SITE = join(import.meta.dirname, '..')

test('the production stylesheet keeps the timing and fill of every scroll-driven animation', async () => {
  const from = join(SITE, 'app', 'globals.css')

  const { css } = await postcss([tailwind({ base: SITE, optimize: true })]).process(readFileSync(from, 'utf8'), {
    from,
  })

  const driven = css.match(/[^{}]*\{[^{}]*animation-timeline:[^{}]*\}/g) ?? []

  expect(driven.length).toBeGreaterThan(0)
  expect(driven.filter((rule) => /animation:\s*none\s*[;}]/.test(rule))).toEqual([])
})
