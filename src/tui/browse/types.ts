import type { Readable, Writable } from 'node:stream'
import type { PaletteEntry } from '../../core/manifest.ts'
import type { Listed, Listing } from '../../store/marketplace-index.ts'
import type { Refreshed } from '../../store/sources.ts'
import type { TopicSpot } from '../help.ts'
import type { HubSpot, HubTab } from '../hub.ts'
import type { ReleaseLine } from '../notice.ts'
import type { Extra, PromptFx, RowSpot } from '../palette-prompt.ts'
import type { KeySpot } from '../zones.ts'

export interface Marketplace {
  source: string
  id: string
  description?: string
  shown: string
  entries: PaletteEntry[]
  auto: boolean
  status: string
}

export interface Report {
  say(line: string): void
  status(text: string): void
}

export interface BrowseIo {
  refresh(source: string): Promise<{ marketplace: Marketplace; refreshed: Refreshed; updates: string[] }>
  fetch(source: string): Promise<Marketplace>
  index(): Promise<Listing>
  apply(result: BrowseResult, report: Report): Promise<void>
}

export interface BrowseOptions {
  marketplaces: Marketplace[]
  kept: PaletteEntry[]
  installed: string[]
  updates?: string[]
  tuned?: string[]
  startup?: string
  due: string[]
  io: BrowseIo
  order?: (entries: PaletteEntry[]) => PaletteEntry[]
  hub?: HubTab
  release?: () => ReleaseLine
  lookups?: boolean
  color?: boolean
  fx?: PromptFx
  owns?: boolean
  input?: Readable
  output?: Writable
  onFocus?: (entry: PaletteEntry) => void
}

export interface BrowseResult {
  picked: Set<string>
  adds: Marketplace[]
  removes: string[]
  auto: Record<string, boolean>
  renew: string[]
  refreshed: Refreshed[]
}

export type Found =
  | { kind: 'new' }
  | { kind: 'search' }
  | { kind: 'back' }
  | { kind: 'state' }
  | { kind: 'listed'; listed: Listed }

export type Action = 'update' | 'auto' | 'remove'

export interface Row extends Extra {
  found?: Found
  action?: Action
}

export interface Detail {
  title: string
  lines: string[]
  brief: string
}

export type Spot =
  | RowSpot
  | KeySpot
  | HubSpot
  | TopicSpot
  | { kind: 'page'; step: number; pane?: string }
  | { kind: 'form' }
