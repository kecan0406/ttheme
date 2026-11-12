import {
  BLOCKS,
  blockSet,
  KINDS,
  kindSet,
  type Narrow,
  narrowOf,
  RATINGS,
  ratingSet,
  SCORES,
  SITES,
  SIZES,
  type Site,
  siteSet,
  tagList,
} from '../../core/booru.ts'
import { canRemoveBackground } from '../../pictures/cutout.ts'
import { edit } from '../field.ts'
import { lineStep } from '../keys.ts'
import type { Paint } from './paint.ts'
import {
  type Count,
  DIGITS,
  type FindSpot,
  type FindView,
  type Notice,
  type Order,
  type Owns,
  type Panel,
  pageOf,
  type Row,
  type Setting,
  type SettingsView,
  stepped,
} from './screen.ts'
import type { Net } from './session.ts'

export const SETTINGS: Setting[] = [
  {
    name: 'TTHEME_FIND_RATING',
    label: 'Rating',
    about: 'The ratings to list, each site read in its own words — space ticks one, and one stays ticked',
    choices: RATINGS,
    multi: { read: ratingSet },
  },
  {
    name: 'TTHEME_FIND_BLOCK',
    label: 'Block',
    about: 'Posts tagged with nudity or underwear are left out — space unticks one',
    choices: BLOCKS,
    multi: { read: blockSet, none: 'none' },
  },
  {
    name: 'TTHEME_FIND_POSTS',
    label: 'Posts',
    about: 'Every post of the character, or only the transparent cutouts',
    choices: ['all', 'cutouts'],
  },
  {
    name: 'TTHEME_FIND_SOLO',
    label: 'Solo',
    about:
      'When on, only the posts known to show the character alone — checked as posts arrive, so the counts below leave it out',
    choices: ['on', 'off'],
  },
  {
    name: 'TTHEME_FIND_ORDER',
    label: 'Order',
    about: 'How posts are ranked: fit, by how well each makes a backdrop; newest; or score',
    choices: ['fit', 'newest', 'score'],
  },
  {
    name: 'TTHEME_FIND_SETS',
    label: 'Sets',
    about: 'One picture posted over and over, or held by another site too: fold it into one tile, or show each',
    choices: ['fold', 'show'],
  },
  ...(canRemoveBackground()
    ? [
        {
          name: 'TTHEME_FIND_REMOVE_BG',
          label: 'Remove bg',
          about: 'Cut the character out of an opaque picture you try on, with macOS Vision',
          choices: ['on', 'off'],
        },
      ]
    : []),
  {
    name: 'TTHEME_FIND_MIN_SCORE',
    label: 'Min score',
    about:
      'Posts scored at least this — danbooru, konachan and yande.re; zerochan keeps no score. ←→ steps, or type any number',
    choices: SCORES,
    entry: 'number',
    advanced: true,
  },
  {
    name: 'TTHEME_FIND_MIN_SIZE',
    label: 'Min size',
    about: 'The shorter side of a picture, in px — every site filters it. ←→ steps, or type any number',
    choices: SIZES,
    entry: 'number',
    advanced: true,
  },
  {
    name: 'TTHEME_FIND_SITES',
    label: 'Sites',
    about: 'The sites the all tab mixes — each keeps its own tab. Space ticks one, and one stays ticked',
    choices: SITES.map((site) => site.name),
    multi: { read: siteSet },
    advanced: true,
  },
  {
    name: 'TTHEME_FIND_HIDE',
    label: 'Hide',
    about: "Comics, monochrome, sketches or chibi, told by tag in every site's spelling — checked as posts arrive",
    choices: KINDS,
    multi: { read: kindSet, none: 'none' },
    advanced: true,
  },
  {
    name: 'TTHEME_FIND_HIDE_TAGS',
    label: 'Hide tags',
    about: 'Posts with any of these tags are left out, spaced like cosplay multiple_girls — checked as posts arrive',
    choices: [],
    entry: 'text',
    advanced: true,
  },
  {
    name: 'TTHEME_FIND_PNG',
    label: 'PNG only',
    about:
      'PNG originals only — danbooru counts it, the others are told by the file; zerochan only where danbooru holds it',
    choices: ['off', 'on'],
    advanced: true,
  },
  ...SITES.flatMap((site) =>
    site.account
      ? [
          {
            name: site.account.setting,
            label: site.account.label,
            about: site.account.about,
            choices: [],
            entry: 'text' as const,
            read: site.account.read,
            advanced: true,
          },
        ]
      : [],
  ),
]

export function initial(setting: Setting, raw: string | undefined): string {
  if (setting.multi) {
    return setting.multi.read(raw).join(' ') || (setting.multi.none as string)
  }

  if (setting.entry === 'number') {
    return /^\d+$/.test(raw ?? '') && Number(raw) > 0 ? String(Number(raw)) : 'off'
  }

  if (setting.read) {
    return setting.read(raw)
  }

  if (setting.entry === 'text') {
    return tagList(raw).join(' ')
  }

  return setting.choices.find((choice) => choice === raw) ?? (setting.choices[0] as string)
}

function committed(row: Row, typed: string): string {
  if (row.entry === 'number') {
    return Number(typed) > 0 ? String(Number(typed)) : 'off'
  }

  return row.read ? row.read(typed) : tagList(typed).join(' ')
}

export interface Terms {
  tag: string
  chosen?: string[]
  preset: FindView['preset']
  order: FindView['order']
  rating: FindView['rating']
  narrow: FindView['narrow']
  enabled: FindView['enabled']
}

const ORDERS: Order[] = ['fit', 'newest', 'score']

export function orderOf(value: string): Order {
  return ORDERS.find((order) => order === value) ?? 'fit'
}

const COUNT_WAIT = 300

export function settingValues(env: NodeJS.ProcessEnv): Map<string, string> {
  return new Map<string, string>(SETTINGS.map((setting) => [setting.name, initial(setting, env[setting.name])]))
}

export function narrowedBy(setting: (name: string) => string): Narrow {
  return narrowOf(setting('TTHEME_FIND_MIN_SCORE'), setting('TTHEME_FIND_MIN_SIZE'), setting('TTHEME_FIND_PNG'))
}

interface Host {
  view: Owns<SettingsView>
  values: Map<string, string>
  paint: Paint
  signal: AbortSignal
  net: Net
  keep: (pairs: [string, string][]) => void
  site: () => Site | undefined
  query: (site: Site, terms: Terms) => { tags: string; notes: string[] } | undefined
  adopted: () => void
  tell: (notice?: Notice) => void
}

export class Settings {
  private countTimer?: NodeJS.Timeout
  private counting?: AbortController

  private readonly view: Owns<SettingsView>
  private readonly values: Map<string, string>
  private readonly paint: Paint
  private readonly signal: AbortSignal
  private readonly net: Net
  private readonly keep: (pairs: [string, string][]) => void
  private readonly site: () => Site | undefined
  private readonly query: (site: Site, terms: Terms) => { tags: string; notes: string[] } | undefined
  private readonly adopted: () => void
  private readonly tell: (notice?: Notice) => void

  constructor(host: Host) {
    this.view = host.view
    this.values = host.values
    this.paint = host.paint
    this.signal = host.signal
    this.net = host.net
    this.keep = host.keep
    this.site = host.site
    this.query = host.query
    this.adopted = host.adopted
    this.tell = host.tell
  }

  private narrowed(): Narrow {
    return narrowedBy((name) => this.setting(name))
  }

  setting(name: string): string {
    return this.values.get(name) as string
  }

  point(index: number): void {
    if (this.view.panel) {
      this.view.panel.at = index
    }
  }

  open(advanced: boolean, name?: string): void {
    const named = SETTINGS.findIndex((setting) => setting.name === name)
    const at = named >= 0 && Boolean(SETTINGS[named]?.advanced) === advanced ? named : undefined
    this.view.panel = { at: at ?? pageOf(this.view.settings, advanced)[0] ?? 0, advanced }
    this.recount()
  }

  private shut(): void {
    this.view.panel = undefined
    this.quietCount()
  }

  swap(): void {
    this.view.preset = this.view.preset === 'cutouts' ? 'all' : 'cutouts'
  }

  panelPoint(spot: FindSpot | undefined): void {
    const view = this.view
    const panel = view.panel

    if (!panel || (spot?.kind !== 'setting' && spot?.kind !== 'choice')) {
      return
    }

    const row = view.settings[spot.index]

    if (panel.typing !== undefined) {
      const typed = view.settings[panel.at]

      if (typed && (spot.index !== panel.at || spot.kind === 'setting')) {
        this.typeKey(panel, typed, 'enter')
      } else {
        return
      }
    }

    if (spot.kind === 'setting' && spot.index === view.settings.length) {
      panel.at = spot.index
      this.panelKey('enter')

      return
    }

    panel.at = spot.index

    if (spot.kind === 'choice' && row) {
      if (row.entry === 'text' || spot.choice === undefined) {
        this.panelKey('enter')

        return
      }

      if (row.multi) {
        row.cursor = Math.max(0, row.choices.indexOf(spot.choice))
        this.panelKey(' ')

        return
      }

      if (row.value !== spot.choice) {
        row.value = spot.choice
        this.recount()
      }
    }

    this.paint.draw()
  }

  panelKey(key: string): void {
    const view = this.view
    const panel = view.panel

    if (!panel) {
      return
    }

    const at = panel.at
    const row = view.settings[at]

    if (panel.typing !== undefined && row) {
      this.typeKey(panel, row, key)

      return
    }

    const page = pageOf(view.settings, panel.advanced)
    const line = lineStep(key)

    if (line !== undefined) {
      const k = page.indexOf(at) + line
      panel.at = page[(k + page.length) % page.length] ?? at
      this.paint.draw()

      return
    }

    if (key === 'a' || (key === 'enter' && at === view.settings.length)) {
      panel.advanced = !panel.advanced
      panel.at = pageOf(view.settings, panel.advanced)[0] ?? 0
      this.paint.draw()

      return
    }

    if (row?.entry && (key === 'enter' || (row.entry === 'number' && /^[0-9]$/.test(key)))) {
      panel.typing = key === 'enter' ? (row.entry === 'text' ? row.value : '') : key
      this.paint.draw()

      return
    }

    if ((key === 'left' || key === 'right') && row && row.entry !== 'text') {
      const step = key === 'left' ? -1 : 1

      if (row.multi) {
        row.cursor = (row.cursor + step + row.choices.length) % row.choices.length
      } else {
        row.value = stepped(row.choices, row.value, step)
        this.recount()
      }

      this.paint.draw()

      return
    }

    if (key === ' ' && row?.multi) {
      const on = row.value.split(' ')
      const next = row.choices.filter((choice, k) => (k === row.cursor ? !on.includes(choice) : on.includes(choice)))
      const empty = row.multi.none

      if (next.length > 0 || empty !== undefined) {
        row.value = next.length > 0 ? next.join(' ') : (empty as string)
        this.recount()
        this.paint.draw()
      }

      return
    }

    if (key === 'esc') {
      view.settings.forEach((setting, i) => {
        setting.value = this.setting(SETTINGS[i]?.name ?? '')
      })
      this.shut()
      this.paint.draw()

      return
    }

    if (key === 'enter' || key === 's' || key === 'alt-c') {
      this.shut()
      this.adopt()
    }
  }

  private typeKey(panel: Panel, row: Row, key: string): void {
    const typed = panel.typing ?? ''

    if (key === 'esc') {
      panel.typing = undefined
      this.paint.draw()

      return
    }

    if (key === 'enter' || key === 'up' || key === 'down') {
      row.value = committed(row, typed)
      panel.typing = undefined
      this.recount()

      if (key === 'enter') {
        this.paint.draw()

        return
      }

      this.panelKey(key)

      return
    }

    const next = edit(typed, key, (ch) =>
      row.entry === 'number' ? /^[0-9]$/.test(ch) && typed.length < DIGITS : /^[\x20-\x7e]$/.test(ch),
    )

    if (next !== undefined) {
      panel.typing = next
      this.paint.draw()
    }
  }

  quietCount(): void {
    clearTimeout(this.countTimer)
    this.counting?.abort()
    this.counting = undefined
  }

  recount(): void {
    const panel = this.view.panel
    this.quietCount()

    if (!panel) {
      return
    }

    panel.counts = undefined

    if (!this.view.tag) {
      return
    }

    const asked = new AbortController()
    this.counting = asked
    this.countTimer = setTimeout(() => void this.countPending(asked), COUNT_WAIT)
  }

  private pending(): Terms {
    const value = (name: string) =>
      this.view.settings[SETTINGS.findIndex((setting) => setting.name === name)]?.value ?? this.setting(name)

    return {
      tag: this.view.tag,
      chosen: this.view.chosen,
      preset: value('TTHEME_FIND_POSTS') === 'all' ? 'all' : 'cutouts',
      order: orderOf(value('TTHEME_FIND_ORDER')),
      rating: ratingSet(value('TTHEME_FIND_RATING')),
      narrow: narrowOf(value('TTHEME_FIND_MIN_SCORE'), value('TTHEME_FIND_MIN_SIZE'), value('TTHEME_FIND_PNG')),
      enabled: siteSet(value('TTHEME_FIND_SITES')),
    }
  }

  private async countPending(asked: AbortController): Promise<void> {
    const terms = this.pending()
    const tab = this.site()
    const sites = tab ? [tab] : SITES.filter((site) => terms.enabled.includes(site.name))
    const signal = AbortSignal.any([this.signal, asked.signal])

    const counts = await Promise.all(
      sites.map(async (site): Promise<Count> => {
        const plan = this.query(site, terms)

        if (!plan) {
          return { site: site.name, count: 0 }
        }

        if (site.counts && !site.counts(plan.tags)) {
          return { site: site.name }
        }

        try {
          const count = await this.net.fetchCount(site, plan.tags, signal)

          return { site: site.name, ...(Number.isFinite(count) ? { count } : {}) }
        } catch {
          return { site: site.name }
        }
      }),
    )

    if (this.counting === asked && this.view.panel) {
      this.view.panel.counts = counts
      this.paint.draw()
    }
  }

  put(name: string, value: string): void {
    const row = this.view.settings[SETTINGS.findIndex((setting) => setting.name === name)]

    if (row) {
      row.value = value
      this.adopt()
    }
  }

  private adopt(): void {
    const view = this.view
    const before = SETTINGS.map((setting) => this.setting(setting.name))
    view.settings.forEach((row, i) => {
      const setting = SETTINGS[i]

      if (setting) {
        this.values.set(setting.name, row.value)
      }
    })
    const changed = SETTINGS.filter((setting, i) => this.setting(setting.name) !== before[i])

    if (changed.length === 0) {
      this.paint.draw()

      return
    }

    this.save(changed)
    view.rating = ratingSet(this.setting('TTHEME_FIND_RATING'))
    view.block = blockSet(this.setting('TTHEME_FIND_BLOCK'))
    view.sets = this.setting('TTHEME_FIND_SETS') === 'show' ? 'show' : 'fold'
    view.preset = this.setting('TTHEME_FIND_POSTS') === 'all' ? 'all' : 'cutouts'
    view.order = orderOf(this.setting('TTHEME_FIND_ORDER'))
    view.solo = this.setting('TTHEME_FIND_SOLO') === 'on'
    view.narrow = this.narrowed()
    view.enabled = siteSet(this.setting('TTHEME_FIND_SITES'))
    view.hide = kindSet(this.setting('TTHEME_FIND_HIDE'))
    view.hideTags = tagList(this.setting('TTHEME_FIND_HIDE_TAGS'))
    this.adopted()
  }

  private save(changed: Setting[]): void {
    this.store(changed.map((setting) => [setting.name, this.setting(setting.name)]))
  }

  private store(pairs: [string, string][]): boolean {
    try {
      this.keep(pairs)

      return true
    } catch (error) {
      this.tell({ text: error instanceof Error ? error.message : String(error), tone: 'error' })

      return false
    }
  }
}
