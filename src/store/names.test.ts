import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { aliasesFor, namesDir, paletteAliases } from './names.ts'

test('a booru tag named like a member every object has finds no names, from the layers and from the aliases kept', () => {
  const home = mkdtempSync(join(tmpdir(), 'ttheme-names-'))
  const was = process.env.XDG_CACHE_HOME
  process.env.XDG_CACHE_HOME = join(home, 'cache')

  try {
    mkdirSync(namesDir(home), { recursive: true })

    writeFileSync(
      join(namesDir(home), 'ttheme-core.json'),
      JSON.stringify({
        1: { tag: 'hatsune_miku', danbooru: ['hatsune_miku'], names: { ja: ['初音ミク'], en: ['Hatsune Miku'] } },
      }),
    )

    const tags = ['constructor', '__proto__', 'toString', 'hatsune_miku']
    const want = [[], [], [], ['Hatsune Miku', '初音ミク']]

    for (const pass of ['built', 'kept']) {
      const known = paletteAliases(tags, home)
      assert.deepEqual(
        tags.map((tag) => known.get(tag)),
        want,
        pass,
      )
      assert.deepEqual(
        tags.map((tag) => aliasesFor(tag, home)),
        want,
        pass,
      )
    }
  } finally {
    if (was === undefined) {
      delete process.env.XDG_CACHE_HOME
    } else {
      process.env.XDG_CACHE_HOME = was
    }
  }
})
