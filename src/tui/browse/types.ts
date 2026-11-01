import type { Readable, Writable } from 'node:stream'
import type { Hex } from '../../core/color.ts'
import type { Sort, Work } from '../../core/commons.ts'
import type { PaletteEntry } from '../../core/manifest.ts'
import type { NameHit } from '../../core/names.ts'
import type { Listed, ListedPalette, Listing } from '../../store/marketplace-index.ts'
import type { HelpSpot } from '../help.ts'
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
  works: Work[]
  auto: boolean
  status: string
}

export interface Report {
  say(line: string): void
  status(text: string): void
}

export interface BrowseIo {
  refresh(source: string): Promise<{ marketplace: Marketplace; updates: string[] }>
  fetch(source: string): Promise<Marketplace>
  index(): Promise<Listing>
  names?(query: string, signal: AbortSignal): Promise<NameHit[]>
  visit(url: string): void
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
  works: readonly Work[]
  sort?: Sort
  hub?: HubTab
  mark?: readonly Hex[]
  release?: () => ReleaseLine
  lookups?: boolean
  search?: string
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
}

export interface Offer {
  source: string
  id: string
  palettes: Pick<ListedPalette, 'name' | 'foreground' | 'cursor' | 'selection' | 'ansi'>[]
  listed?: Listed
  known?: Marketplace
}

export type Found =
  | { kind: 'new' }
  | { kind: 'search' }
  | { kind: 'back' }
  | { kind: 'state' }
  | { kind: 'listed'; listed: Listed }
  | { kind: 'work'; work: Work; offers: Offer[] }
  | { kind: 'offer'; offer: Offer }
  | { kind: 'request'; asked: string }
  | { kind: 'make' }

export type Action = 'update' | 'auto' | 'remove'

export interface Row extends Extra {
  found?: Found
  action?: Action
}

export interface Detail {
  title: string
  lines: string[]
  brief: string
  failed?: boolean
}

export type Spot =
  | RowSpot
  | KeySpot
  | HubSpot
  | HelpSpot
  | { kind: 'page'; step: number; pane?: string }
  | { kind: 'form' }
