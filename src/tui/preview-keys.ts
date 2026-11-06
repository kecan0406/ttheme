import { hubNext } from './hub.ts'

interface PreviewKey {
  where: 'list' | 'panel' | 'sample' | 'group' | 'pick' | 'settings' | 'hub' | 'help'
  group: string
  keys: string
  does: string
  onBar?: boolean
}

export const PREVIEW_KEYS: readonly PreviewKey[] = [
  { where: 'list', group: 'Move', keys: '↑↓ / ctrl+j  ctrl+k', does: 'Move up or down' },
  { where: 'list', group: 'Move', keys: 'pgup  pgdn  home  end', does: 'Move a page, or to either end' },
  { where: 'list', group: 'Move', keys: '←→ / space', does: 'Close or open a shelf' },
  { where: 'list', group: 'Filter', keys: 'type', does: 'Filter by name or title' },
  { where: 'list', group: 'Filter', keys: 'ctrl+u', does: 'Clear the filter' },
  { where: 'hub', group: 'Filter', keys: 'enter', does: 'Search marketplaces when nothing matches', onBar: true },
  { where: 'list', group: 'Palette', keys: 'enter', does: 'Use it, choosing where', onBar: true },
  { where: 'list', group: 'Palette', keys: '→ / ctrl+e', does: 'Edit its colors and picture', onBar: true },
  { where: 'list', group: 'Palette', keys: 'tab', does: 'See the sample full screen', onBar: true },
  { where: 'list', group: 'Finish', keys: 'esc', does: 'Cancel and put the tab back', onBar: true },
  { where: 'list', group: 'Finish', keys: 'alt+g', does: 'Group and sort the list', onBar: true },
  { where: 'list', group: 'Finish', keys: 'alt+c', does: 'Open the settings', onBar: true },
  { where: 'hub', group: 'Finish', keys: 'shift+tab', does: `Switch to ${hubNext('preview')}`, onBar: true },
  { where: 'panel', group: 'Move', keys: '↑↓ / j k', does: 'Move between rows', onBar: true },
  { where: 'panel', group: 'Move', keys: 'home  end', does: 'Go to the first or last row' },
  { where: 'panel', group: 'Picture', keys: '←→ / , .', does: 'Choose a picture', onBar: true },
  { where: 'panel', group: 'Picture', keys: 'f', does: 'Find a picture online', onBar: true },
  { where: 'panel', group: 'Picture', keys: 'D', does: 'Remove the picture', onBar: true },
  { where: 'panel', group: 'Picture', keys: '←→ / h l', does: 'Change size, position or opacity', onBar: true },
  { where: 'panel', group: 'Picture', keys: 'shift+←→', does: 'Change it by 10' },
  { where: 'panel', group: 'Picture', keys: '1-9', does: 'Place it', onBar: true },
  { where: 'panel', group: 'Picture', keys: '=  +', does: 'Reset this row, or every row', onBar: true },
  { where: 'panel', group: 'Picture', keys: 'space', does: 'Hide or show the picture' },
  { where: 'panel', group: 'Picture', keys: 'c', does: 'Original or tinted', onBar: true },
  { where: 'panel', group: 'Picture', keys: 'y', does: 'Copy the artist credit' },
  { where: 'panel', group: 'Palette', keys: 'enter', does: 'Edit its colors full screen', onBar: true },
  { where: 'panel', group: 'Finish', keys: 's', does: 'Save the picture', onBar: true },
  { where: 'panel', group: 'Finish', keys: 'shift+enter', does: 'Save, then choose where to use it', onBar: true },
  {
    where: 'panel',
    group: 'Finish',
    keys: 'esc',
    does: 'Back to the list, dropping changes since the last save',
    onBar: true,
  },
  { where: 'sample', group: 'Move', keys: '↑↓', does: 'Move to the next palette', onBar: true },
  { where: 'sample', group: 'Sample', keys: 'shift+←→', does: 'Switch the sample', onBar: true },
  { where: 'sample', group: 'Sample', keys: 'enter', does: 'Use it, choosing where', onBar: true },
  { where: 'sample', group: 'Finish', keys: 'tab / esc', does: 'Back to the list', onBar: true },
  { where: 'group', group: 'Move', keys: '↑↓ / j k', does: 'Move between choices' },
  { where: 'group', group: 'Choose', keys: 'space / enter', does: 'Pick it, saved at once' },
  { where: 'group', group: 'Finish', keys: 'esc / alt+g', does: 'Close the menu' },
  { where: 'pick', group: 'Choose', keys: '←→ / tab', does: 'Choose where it goes' },
  { where: 'pick', group: 'Choose', keys: 'enter', does: 'Use it there' },
  { where: 'pick', group: 'Finish', keys: 'esc', does: 'Back to the list' },
  { where: 'settings', group: 'Move', keys: '↑↓ / j k', does: 'Move between settings' },
  { where: 'settings', group: 'Change', keys: '←→', does: 'Change the value' },
  { where: 'settings', group: 'Finish', keys: 'enter', does: 'Save the settings' },
  { where: 'settings', group: 'Finish', keys: 'esc', does: 'Cancel and put them back' },
  { where: 'help', group: 'Help', keys: '? / esc', does: 'Close help', onBar: true },
]
