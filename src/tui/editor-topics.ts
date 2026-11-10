import { BASE } from '../core/slots.ts'
import type { Legend, Topic } from './help.ts'
import type { PaletteEditor } from './palette-editor.ts'
import { MARKS } from './style.ts'

const LEAVE = 'Asks first when something changed: y saves, n discards, esc keeps editing. A second ctrl+c discards.'

const BOX_KEYS = new Set(['n  N', 'f', 'u', 'ctrl+r', 'space'])

export function editorBoxTopics(e: PaletteEditor): Topic[] {
  const quiet =
    e.options.help !== false &&
    e.mode === 'list' &&
    !e.inspect &&
    !e.compare &&
    !e.quitting &&
    !e.menu &&
    !e.overlay &&
    !e.help &&
    e.typing === undefined

  return quiet ? editorTopics(e).filter((t) => BOX_KEYS.has(t.keys)) : []
}

export function editorTopics(e: PaletteEditor): Topic[] {
  const list = e.mode === 'list'
  const plain = list && !e.inspect
  const tuning = e.mode === 'tune'
  const ansi = e.slot() >= BASE.length
  const others = (e.options.palettes ?? []).length > 0
  const roomy = list && e.roomy
  const when = (on: boolean, key: string) => (on ? { run: () => e.press(key) } : {})
  const close: Topic = { group: 'Help', keys: '? / esc', does: 'Close help', run: () => {} }

  const leave = (on: boolean): Topic => ({
    group: 'Finish',
    keys: 'esc / ctrl+c',
    does: 'Leave',
    more: LEAVE,
    ...when(on, 'esc'),
  })

  const pictures: Topic[] = e.options.find
    ? [
        {
          group: 'Picture',
          keys: 'p',
          does: 'Find a picture',
          more: 'Searches the boorus and tries each picture on in these colors.',
          ...when(e.mode !== 'tune', 'p'),
        },
        { group: 'Picture', keys: 'b', does: 'Show or hide the picture', ...when(list, 'b') },
        {
          group: 'Picture',
          keys: 'ctrl+v',
          does: 'Paste a picture',
          more: 'Drop a picture on the window, or paste one, its path or its link.',
        },
      ]
    : []

  if (e.mode === 'seeds') {
    return [
      { group: 'Seeds', keys: '↑↓', does: 'Choose a seed' },
      { group: 'Seeds', keys: '←→', does: 'Change it by a step' },
      { group: 'Seeds', keys: 'shift+←→', does: 'Change it by five steps', more: 'Ten steps on the hue.' },
      { group: 'Seeds', keys: 'home  end', does: 'Set it to either end' },
      {
        group: 'Seeds',
        keys: 'enter',
        does: 'Keep the seeds and tune each color',
        more: 'The seeds stay behind once you move on.',
        ...when(true, 'enter'),
      },
      { group: 'Seeds', keys: 'o', does: 'Start from another palette', ...when(others, 'o') },
      ...pictures,
      leave(true),
      close,
    ]
  }

  return [
    { group: 'Move', keys: '↑↓', does: 'Move between colors' },
    { group: 'Move', keys: '←→', does: 'Switch between normal and bright' },
    { group: 'Move', keys: 'home  end', does: 'Go to the first or last color' },
    { group: 'Move', keys: 'pgup  pgdn', does: 'Go to the base or the ANSI colors' },
    {
      group: 'Contrast',
      keys: 'n  N',
      does: 'Go to the next or previous color that fails',
      ...when(list && e.misses().size > 0, 'n'),
    },
    {
      group: 'Contrast',
      keys: 'f',
      does: 'Fix the colors that fail',
      more: 'Moves only the colors a contrast check fails, as little as it can.',
      ...when(list, 'f'),
    },
    { group: 'Tune a color', keys: 'enter / tab', does: 'Open the picker', ...when(plain, 'enter') },
    { group: 'Tune a color', keys: '↑↓', does: 'Lightness' },
    {
      group: 'Tune a color',
      keys: '←→',
      does: 'Chroma',
      more: `Chroma stops at what sRGB can show. What lightness or hue took away comes back while you tune, marked ${MARKS.off}.`,
    },
    { group: 'Tune a color', keys: 'shift+←→ / , .', does: 'Hue by 5, or by 1' },
    { group: 'Tune a color', keys: 'pgup  pgdn', does: 'Lightness by 5' },
    {
      group: 'Tune a color',
      keys: 'home  end  0-9',
      does: 'Jump the channel moved last',
      more: 'home / end go to either end, a digit to that tenth of the way.',
    },
    {
      group: 'Tune a color',
      keys: 'tab',
      does: `Set lightness by contrast (${MARKS.contrast})`,
      more: 'Lightness follows the contrast with the color it is read on. home takes the lowest that passes, 1-9 a ratio.',
      ...when(tuning, 'tab'),
    },
    {
      group: 'Tune a color',
      keys: 'a',
      does: 'Choose which colors move together',
      more: 'This color, its pair, the normals, the brights or the accents. Each keeps its own color and moves by the same step.',
      ...when(tuning && ansi, 'a'),
    },
    {
      group: 'Tune a color',
      keys: 'enter',
      does: 'Keep',
      more: 'A click outside the picker keeps too.',
      ...when(tuning, 'enter'),
    },
    {
      group: 'Tune a color',
      keys: 'esc',
      does: 'Cancel the tune',
      more: 'Every color the tune moved goes back.',
      ...when(tuning && !e.compare, 'esc'),
    },
    { group: 'Edit', keys: 'u', does: 'Undo', ...when(list || tuning, 'u') },
    { group: 'Edit', keys: 'ctrl+r', does: 'Redo', ...when(list || tuning, 'ctrl-r') },
    { group: 'Edit', keys: 'c', does: 'Copy the color' },
    { group: 'Edit', keys: 'v', does: 'Paste a color' },
    {
      group: 'Edit',
      keys: 'r',
      does: `Put it back ${e.based()}`,
      more: `A click on base${e.roomy ? ` or ${MARKS.off}` : ''} in the picker does the same.`,
    },
    { group: 'Edit', keys: 'R', does: 'Put every color back' },
    {
      group: 'Edit',
      keys: '#',
      does: 'Type a color',
      more: '#rrggbb, rgb(r g b) or oklch(l c h). A paste works too.',
      ...when(true, '#'),
    },
    {
      group: 'Link',
      keys: 'l',
      does: 'Link a bright to its normal',
      more: 'Tuning the normal moves a linked bright. Tuning the bright alone unlinks it.',
      ...when(ansi, 'l'),
    },
    { group: 'Link', keys: '=', does: 'Snap the bright to its normal' },
    {
      group: 'View',
      keys: 'g',
      does: 'Show the relations',
      more: 'The lightness, chroma and hue of all sixteen ANSI colors at once, and the relations the contrast checks hold.',
      ...when(true, 'g'),
    },
    {
      group: 'View',
      keys: 'shift+←→',
      does: 'Switch the sample tab',
      more: 'The color under the cursor is underlined where the sample uses it.',
    },
    { group: 'View', keys: 'w', does: 'Dim what does not use this color', ...when(roomy, 'w') },
    {
      group: 'View',
      keys: 'i',
      does: 'Inspect the sample',
      more: 'A click on the sample does the same. Arrows move, enter goes to the color, esc goes back.',
      ...when(roomy && !e.inspect, 'i'),
    },
    { group: 'View', keys: 'm', does: 'Show only the changed colors', ...when(roomy, 'm') },
    {
      group: 'View',
      keys: 'space',
      does: 'Compare with where you started',
      more: 'Shows the colors you started from, on the terminal too.',
      ...when(true, ' '),
    },
    ...(e.tone
      ? []
      : [
          {
            group: 'Palette',
            keys: 'o',
            does: 'Take another palette’s colors',
            ...when(list && others, 'o'),
          },
          {
            group: 'Palette',
            keys: 'I',
            does: 'Import colors from a palette or a share code',
            ...when(roomy, 'I'),
          },
        ]),
    ...(e.options.exports
      ? [
          {
            group: 'Palette',
            keys: 'x',
            does: 'Copy the share code, an add command or the set file',
            ...when(roomy, 'x'),
          },
        ]
      : []),
    ...pictures,
    { group: 'Finish', keys: 's', does: 'Save', ...when(true, 's') },
    leave(plain && !e.compare),
    close,
  ]
}

export function editorLegend(e: PaletteEditor): Legend {
  if (e.mode === 'seeds') {
    return []
  }

  return [
    [MARKS.miss, 'fails a contrast check'],
    [MARKS.on, 'changed'],
    [MARKS.linked, 'follows its normal'],
    [MARKS.off, 'its base color'],
    [MARKS.contrast, 'contrast'],
  ]
}
