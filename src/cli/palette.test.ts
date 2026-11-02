import { spyOn } from 'bun:test'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isCrash } from './cli.ts'
import { runPalette } from './palette.ts'

test('palette consensus says a page that is not JSON is one it cannot read, which is no crash of ttheme', async () => {
  const fetched = spyOn(globalThis, 'fetch').mockImplementation(
    Object.assign(async () => new Response('<!doctype html><title>Just a moment</title>'), { preconnect: () => {} }),
  )

  try {
    await assert.rejects(
      () => runPalette('consensus', 'orla_(starfall)', {}),
      (error: Error) => !isCrash(error) && /safebooru answered something ttheme cannot read/.test(error.message),
    )
  } finally {
    fetched.mockRestore()
  }
})
