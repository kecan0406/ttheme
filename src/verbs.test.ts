import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { VERB_SPECS } from './verbs.ts'

test('the shell completes every action of ttheme marketplace that src/verbs.ts lists', () => {
  const layer = readFileSync(join(import.meta.dirname, '..', 'shell', 'ttheme.zsh'), 'utf8')
  const completion = /\$words\[2\] == marketplace && \$CURRENT == 3 \]\]; then\n\s+compadd -- (.+)\n/.exec(layer)
  const offered = completion?.[1]?.split(' ')
  const actions = VERB_SPECS.find((verb) => verb.name === 'marketplace')?.actions?.map(([usage]) => usage.split(' ')[0])
  assert.deepEqual(offered, actions)
})

test('the shell completes every flag of the verbs it carries, and the choices of one that takes a value, as src/verbs.ts lists them', () => {
  const layer = readFileSync(join(import.meta.dirname, '..', 'shell', 'ttheme.zsh'), 'utf8')
  const completion = /__tt_complete\(\) \{\n([\s\S]+?)\n {2}\}\n/.exec(layer)?.[1] ?? ''

  const missing = VERB_SPECS.filter((verb) => !verb.hidden && verb.section !== 'setup')
    .flatMap((verb) =>
      Object.entries(verb.flags ?? {}).flatMap(([flag, { choices = [] }]) =>
        choices.length > 0 ? [`--${flag}`, `compadd -- ${choices.join(' ')}`] : [`--${flag}`],
      ),
    )
    .filter((offer) => !completion.includes(offer))

  assert.deepEqual(missing, [])
})
