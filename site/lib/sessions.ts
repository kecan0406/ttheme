import { type Line, linesOf, plain, type Run } from '@/lib/terminal'
import { shortName, type Theme } from '@/lib/themes'
import { FACE, SLOT_NAMES } from '../../src/core/slots.ts'

export const SCENES = ['shell', 'git', 'test', 'colors'] as const

export type Scene = (typeof SCENES)[number]

const NAME_SLOT = 7

const PROMPT = '«2»~/dotfiles «4»main «B5»❯ «»'

const ARROW = '«B5»❯ «»'

const TAB_PROMPT = '«2»➜  «6»ttheme«4» git:(«1»main«4») «»'

const swatches = (from: number) => Array.from({ length: 8 }, (_, i) => `«${from + i}»███ `).join('')

const LETTERS = [1, 2, 3, 4, 5, 6, 9, 10, 11, 12, 13, 14].map((n) => `«${n}»Aa `).join('')

export const OWN_NAME: Run = { text: '', t: NAME_SLOT, g: 0, live: 'name' }

export function useOf(theme: Theme): Run {
  return { text: shortName(theme.id), t: NAME_SLOT, g: 0, live: 'use' }
}

function tailed(markup: string, tail: Run): Line {
  return [...(linesOf([markup])[0] ?? []), tail]
}

export function sceneLines(scene: Scene, use: Run): Line[] {
  if (scene === 'git') {
    return linesOf([
      `${ARROW}git log --oneline --graph -3`,
      '«1»* «3»a47f151 «6»(«B6»HEAD -> «B2»main«6»)«» Bump version',
      '«1»* «3»cd854dd«» Name marketplaces owner@name',
      '«1»* «3»3e84502«» Tier the help',
      `${ARROW}git diff --stat`,
      ' src/marketplaces.ts | 12 «2»++++++++«1»----',
      `${ARROW}«s»git push«c» `,
    ])
  }

  if (scene === 'test') {
    return linesOf([
      `${ARROW}bun test`,
      '«8»src/contrast.test.ts:',
      '«2»✓«» every palette passes the contrast checks «8»[4.1ms]',
      '«2»✓«» the other mode passes them too «8»[0.3ms]',
      '«B1»✗«» bright follows its normal «8»[1.2ms]',
      '«3»»«» fetches the picture «8»(skipped)',
      ' «2»41 pass«» «3»1 skip«» «B1»1 fail',
    ])
  }

  if (scene === 'colors') {
    return linesOf([
      swatches(0),
      swatches(8),
      LETTERS,
      '«s» selection «» cursor «c» ',
      '«8»comment«» foreground «7»ansi7«» «B15»ansi15',
    ])
  }

  return [
    ...linesOf([`${PROMPT}ls -F`, '«B4»shell/«»  «B4»themes/«»  «B2»setup.sh*«»  «6»zshrc@«»  todo.md']),
    tailed(`${PROMPT}ttheme use `, use),
    ...linesOf(['«8»this tab only', `${PROMPT}cat notes`, '«1»cat: notes: No such file or directory', `${PROMPT}«c» `]),
  ]
}

function prompted(text: string): Line {
  return tailed(TAB_PROMPT, plain(text))
}

function markOf(slot: (typeof FACE)[number]): Run {
  return slot === 'selection' ? { text: ' sel ', t: 1, g: 3 } : { text: '●', t: SLOT_NAMES.indexOf(slot), g: 0 }
}

export function tabLines(theme: Theme): Line[] {
  const file = `builtin/sets/${theme.work?.id ?? 'original'}.toml`

  return [
    prompted(`ttheme use ${theme.name}`),
    [{ text: ` ${theme.work?.name ?? ''} `, t: 1, g: 3 }],
    [{ text: ` ${theme.name} `, t: 0, g: 2, bold: true }],
    [plain(' '), ...FACE.map(markOf)],
    ...linesOf([
      `${TAB_PROMPT}git log --oneline -2`,
      '«3»b699337«» «B6»(HEAD -> «B2»main«B6»)«» Harmonize every palette',
      '«3»ff9cb92«» Pin palettes to directories',
    ]),
    prompted(`grep -H '^cursor' ${file}`),
    ...[theme.cursor, theme.other.cursor].map(
      (cursor): Line => [
        { text: file, t: 9, g: 0 },
        { text: ':', t: 10, g: 0 },
        { text: 'cursor', t: 5, g: 0, bold: true },
        plain(` = "${cursor}"`),
      ],
    ),
    ...linesOf([`${TAB_PROMPT}«c» `]),
  ]
}
