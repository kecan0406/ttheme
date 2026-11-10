import type { Legend, Topic } from '../help.ts'
import { type HubTab, hubNext } from '../hub.ts'
import type { PaletteList } from '../palette-prompt.ts'
import { MARKS } from '../style.ts'
import type { Review } from './review.ts'
import type { Search } from './search.ts'
import type { Staged } from './staged.ts'
import type { Row } from './types.ts'

export interface TopicsHost {
  readonly hub: HubTab | undefined
  readonly list: PaletteList<Row>
  readonly staged: Staged
  readonly search: Search
  readonly review: Review
  showing(): 'browse' | 'search'
  side(): 'cards' | 'panel' | 'form'
  key(key: string): void
  take(back: boolean): void
  back(): void
  openSearch(): void
  openForm(): void
  closeSearch(): void
}

export function browseTopics(host: TopicsHost): Topic[] {
  const screens: Topic[] = host.hub
    ? [
        {
          group: 'Help',
          keys: 'tab  shift+tab',
          does: `Switch to ${hubNext(host.hub)}`,
          run: () => host.key('tab'),
          onBar: true,
        },
      ]
    : []

  const close: Topic = { group: 'Help', keys: '? / esc', does: 'Close help', run: () => {}, onBar: true }

  const moving: Topic[] = [
    { group: 'Move', keys: '↑↓ / ctrl+j  ctrl+k', does: 'Move up or down' },
    { group: 'Move', keys: 'pgup  pgdn  home  end', does: 'Move a page, or to either end' },
  ]

  const filtering: Topic[] = [
    { group: 'Filter', keys: 'type', does: 'Filter the list' },
    { group: 'Filter', keys: 'ctrl+u', does: 'Clear the filter' },
  ]

  if (host.showing() === 'search') {
    return [
      ...moving,
      { group: 'Move', keys: '← / esc', does: 'Back to Browse', run: () => host.closeSearch(), onBar: true },
      {
        group: 'Filter',
        keys: 'type',
        does: 'Find a work or a marketplace',
        more: "Once you stop typing, the title is looked up in any language, unless TTHEME_NAME_LOOKUP is off. A palette's whole name finds its work too.",
      },
      filtering[1] as Topic,
      {
        group: 'Add',
        keys: 'space',
        does: 'Add it, or undo the add',
        more: 'An added marketplace is fetched at once and kept when you apply.',
        run: () => host.take(false),
        onBar: true,
      },
      { group: 'Add', keys: 'enter', does: 'Add it and go to its card', run: () => host.take(true), onBar: true },
      {
        group: 'Add',
        keys: 'enter on ⧉',
        does: 'Ask for a palette or read how to make one',
        more: 'Request a character and Make one show when no marketplace has what you typed.',
        run: () => host.take(true),
        onBar: true,
      },
      {
        group: 'Add',
        keys: 'ctrl+r',
        does: 'Load the list again',
        more: 'The list is gathered from GitHub every half hour.',
        run: () => host.search.load(),
      },
      ...screens,
      close,
    ]
  }

  const form = host.side() === 'form'
  const panel = host.side() === 'panel'
  const when = (on: boolean, run: () => void) => (on ? { run } : {})

  return [
    ...moving,
    {
      group: 'Move',
      keys: '→ / enter',
      does: 'Open a marketplace or a work',
      ...when(!form, () => host.key('right')),
      onBar: true,
    },
    {
      group: 'Move',
      keys: '← / esc',
      does: 'Back to the marketplaces',
      ...when(panel || form, () => host.back()),
      onBar: true,
    },
    {
      group: 'Palettes',
      keys: 'space',
      does: 'Pick or unpick',
      more: 'Apply installs what is picked and removes what is not. Picking a work or a marketplace picks every palette in it.',
      ...when(!form, () => host.key(' ')),
      onBar: true,
    },
    {
      group: 'Palettes',
      keys: 'ctrl+r',
      does: `Take an update (${MARKS.update})`,
      more: `On a palette or a work marked ${MARKS.update}. The update is installed when you apply.`,
      ...when(panel, () => host.key('ctrl-r')),
      onBar: true,
    },
    ...filtering,
    {
      group: 'Marketplaces',
      keys: 'enter on + Add',
      does: 'Add one from GitHub or a folder',
      more: 'Type owner/repo, owner/repo#v1 for a tag or a branch, or the path of a folder.',
      ...when(!form, () => {
        host.back()
        host.list.select('extra new')
        host.openForm()
      }),
      onBar: true,
    },
    {
      group: 'Marketplaces',
      keys: 'enter on ⌕ Search',
      does: 'Find one on GitHub',
      ...when(!form, () => {
        host.back()
        host.list.select('extra search')
        host.openSearch()
      }),
      onBar: true,
    },
    {
      group: 'Marketplaces',
      keys: '↓  past the palettes',
      does: 'Update, auto-update or remove it',
      more: 'A marketplace keeps its own actions under its palettes in the panel.',
    },
    {
      group: 'Finish',
      keys: 'enter',
      does: 'Review and apply',
      ...when(host.staged.dirty(), () => host.review.open()),
      onBar: true,
    },
    { group: 'Finish', keys: 'esc', does: 'Leave, asking first about changes not applied', onBar: true },
    ...screens,
    close,
  ]
}

export function browseLegend(): Legend {
  return [
    [MARKS.on, 'picked'],
    [MARKS.off, 'not picked'],
    [`${MARKS.closed} ${MARKS.opened}`, 'a work, closed or open'],
    [MARKS.update, 'has an update'],
    [MARKS.auto, 'updates on its own'],
    [MARKS.miss, 'fails a contrast check'],
    [MARKS.star, 'stars on GitHub'],
  ]
}
