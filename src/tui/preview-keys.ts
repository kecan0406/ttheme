import { hubNext } from './hub.ts'

export interface PreviewKey {
  where: 'list' | 'panel' | 'hub' | 'help' | 'first'
  group: string
  keys: string
  does: string
}

export const PREVIEW_KEYS: readonly PreviewKey[] = [
  { where: 'list', group: 'Move', keys: '↑↓  ctrl+j  ctrl+k', does: 'Move up or down' },
  { where: 'list', group: 'Move', keys: 'pgup  pgdn  home  end', does: 'Move a page, or to either end' },
  { where: 'list', group: 'Move', keys: '←→  space', does: 'Close or open a catalog' },
  { where: 'list', group: 'Filter', keys: 'type', does: 'Filter by name or title, in Japanese too' },
  { where: 'list', group: 'Filter', keys: 'ctrl+u', does: 'Clear the filter' },
  { where: 'list', group: 'Palette', keys: '⇧←→', does: 'Switch the sample' },
  { where: 'list', group: 'Palette', keys: 'enter', does: 'Use it, choosing where' },
  { where: 'list', group: 'Palette', keys: 'tab  →  ctrl+e', does: 'Edit its colors and picture' },
  { where: 'list', group: 'Finish', keys: 'esc', does: 'Cancel and put the tab back' },
  { where: 'list', group: 'Finish', keys: 'alt+c', does: 'Open the settings' },
  { where: 'hub', group: 'Finish', keys: 'shift+tab', does: `Switch to ${hubNext('preview')}` },
  { where: 'panel', group: 'Move', keys: '↑↓  j  k', does: 'Move between rows' },
  { where: 'panel', group: 'Move', keys: 'home  end', does: 'Go to the first or last row' },
  { where: 'panel', group: 'Picture', keys: '←→  ,  .', does: 'Choose a picture' },
  { where: 'panel', group: 'Picture', keys: 'f', does: 'Find a picture online' },
  { where: 'panel', group: 'Picture', keys: 'D', does: 'Remove the picture' },
  { where: 'panel', group: 'Picture', keys: '←→  h  l', does: 'Change size, position or opacity' },
  { where: 'panel', group: 'Picture', keys: '⇧←→', does: 'Change it by 10' },
  { where: 'panel', group: 'Picture', keys: '1-9', does: 'Place it' },
  { where: 'panel', group: 'Picture', keys: '=  +', does: 'Reset this row, or every row' },
  { where: 'panel', group: 'Picture', keys: 'space', does: 'Hide or show the picture' },
  { where: 'panel', group: 'Picture', keys: 'c', does: 'Own colors or tinted' },
  { where: 'panel', group: 'Picture', keys: 'y', does: 'Copy the artist credit' },
  { where: 'panel', group: 'Palette', keys: 'enter', does: 'Edit its colors full screen' },
  { where: 'panel', group: 'Finish', keys: 's', does: 'Save the picture' },
  { where: 'panel', group: 'Finish', keys: '⇧enter', does: 'Save, then choose where to use it' },
  { where: 'panel', group: 'Finish', keys: 'esc', does: 'Back to the list, dropping changes since the last save' },
  { where: 'help', group: 'Help', keys: '?  esc', does: 'Close help' },
  { where: 'first', group: 'Help', keys: 'any key', does: 'Close help, and ? opens it again' },
]
