import { pickedNames, type Site, tagsOf } from '../../core/booru.ts'
import { type About, aboutIn, aboutOf, shelvesOf, siteTags, type Work } from '../../core/commons.ts'
import type { Manifest, PaletteEntry } from '../../core/manifest.ts'
import { booruTags } from '../../store/available.ts'
import { edit } from '../field.ts'
import { lineStep } from '../keys.ts'
import type { Paint } from './paint.ts'
import type { Owns, TagsView } from './screen.ts'
import type { Net } from './session.ts'
import type { Terms } from './settings.ts'

const SUGGEST_WAIT = 150
const KNOWN = 3
const WRITTEN = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u
const SUGGESTED = 8
const CHIPS = 9

export function tagOf(works: readonly Work[], entry: PaletteEntry): string {
  return aboutOf(works, entry.subject)?.character?.danbooru ?? ''
}

function charactersOf(works: readonly Work[]): Map<string, About> {
  const known = new Map<string, About>()
  const index = shelvesOf(works)

  for (const work of works) {
    for (const character of work.characters) {
      const about = aboutIn(index, `${work.id}/${character.id}`)

      if (character.danbooru && about && !known.has(character.danbooru)) {
        known.set(character.danbooru, about)
      }
    }
  }

  return known
}

function completable(token: string): boolean {
  return token.length >= 2 && !/^\d+$/.test(token) && !token.includes('://') && !/^[\w.]+:\d+$/.test(token)
}

interface Host {
  view: Owns<TagsView>
  paint: Paint
  signal: AbortSignal
  net: Net
  manifest: Manifest
  entry: PaletteEntry
  research: () => void
  commit: (text: string) => Promise<void>
  leave: (code: number) => void
}

export class Tags {
  private readonly related = new Map<string, string[]>()
  private pool: string[] = []
  private relating?: AbortController
  private asking?: { timer: NodeJS.Timeout; control: AbortController }

  private readonly view: Owns<TagsView>
  private readonly paint: Paint
  private readonly signal: AbortSignal
  private readonly net: Net
  private readonly manifest: Manifest
  private readonly entry: PaletteEntry
  private readonly about: About | undefined
  private readonly characters: ReadonlyMap<string, About>
  private readonly research: () => void
  private readonly commit: (text: string) => Promise<void>
  private readonly leave: (code: number) => void

  constructor(host: Host) {
    this.view = host.view
    this.paint = host.paint
    this.signal = host.signal
    this.net = host.net
    this.manifest = host.manifest
    this.entry = host.entry
    this.about = aboutOf(host.manifest.works, host.entry.subject)
    this.characters = charactersOf(host.manifest.works)
    this.research = host.research
    this.commit = host.commit
    this.leave = host.leave
    this.pool = this.selected(this.view)
    this.syncChips()
  }

  edit(): void {
    this.view.query ??= { text: '' }
  }

  write(text: string): void {
    if (this.view.query) {
      this.view.query.text += text
    }
  }

  shut(): void {
    this.quiet()
    this.view.query = undefined
  }

  point(index: number): void {
    const shown = this.view.query?.suggest

    if (shown) {
      shown.pick = index
    }
  }

  retag(text: string): void {
    this.view.tag = text
    this.view.chosen = undefined
  }

  editKey(key: string): void {
    const view = this.view
    const query = view.query

    if (!query) {
      return
    }

    const shown = query.suggest
    const line = lineStep(key)

    if (line !== undefined && shown) {
      const count = shown.list.length
      const next = ((shown.pick ?? count) + (line > 0 ? 1 : count)) % (count + 1)
      shown.pick = next === count ? undefined : next
      this.paint.draw()

      return
    }

    if (key === 'esc' || key === 'enter') {
      const picked = shown?.pick === undefined ? undefined : shown.list[shown.pick]
      const typed = picked ? query.text.replace(/\S*$/, () => picked.value) : query.text
      const chosen = key === 'enter' ? typed.trim() : ''
      this.shut()

      if (chosen) {
        void this.commit(chosen)
      } else if (view.tag === '') {
        this.leave(2)
      } else {
        this.paint.draw()
      }

      return
    }

    const next = edit(query.text, key)

    if (next !== undefined) {
      query.text = next
      this.suggest()
      this.paint.draw()
    }
  }

  quiet(): void {
    clearTimeout(this.asking?.timer)
    this.asking?.control.abort()
    this.asking = undefined
  }

  suggest(): void {
    this.quiet()
    const query = this.view.query

    if (!query) {
      return
    }

    const text = query.text
    const token = /\S*$/.exec(text)?.[0] ?? ''

    if (!completable(token)) {
      query.suggest = undefined

      return
    }

    const known = this.ownTags(token).slice(0, KNOWN)
    query.suggest = known.length > 0 ? { list: known } : undefined
    const control = new AbortController()

    const asking = {
      control,
      timer: setTimeout(async () => {
        try {
          const found = await this.net.fetchSuggestions(token, AbortSignal.any([this.signal, control.signal]))

          if (this.asking !== asking) {
            return
          }

          const counts = new Map(found.map((item) => [item.value, item.count]))
          const names = new Set(known.map((item) => item.value))

          const list = [
            ...known.map((item) => ({ ...item, count: counts.get(item.value) ?? 0 })),
            ...found.filter((item) => !names.has(item.value)),
          ].slice(0, SUGGESTED)

          const held = query.suggest?.pick
          const pick = held ?? (WRITTEN.test(text) && list.length > 0 ? 0 : undefined)
          query.suggest = list.length > 0 ? { list, ...(pick === undefined ? {} : { pick }) } : undefined
          this.paint.draw()
        } catch {}
      }, SUGGEST_WAIT),
    }

    this.asking = asking
  }

  private selected(terms: { tag: string; chosen?: string[] }): string[] {
    if (terms.chosen) {
      return terms.chosen
    }

    if (!terms.tag) {
      return []
    }

    return this.namesOf(terms.tag, 'danbooru')
  }

  private namesOf(tag: string, site: string): string[] {
    const owner = tag === this.about?.character?.danbooru ? this.about : this.characters.get(tag)

    return owner ? siteTags(owner, site) : [tag]
  }

  private ownTags(token: string): { value: string; count: number; palette: string }[] {
    const firsts = new Map<string, string>()

    for (const p of booruTags(this.manifest.palettes, this.manifest.works, this.entry, token)) {
      const tag = tagOf(this.manifest.works, p)

      if (!firsts.has(tag)) {
        firsts.set(tag, p.name)
      }
    }

    return [...firsts].map(([value, palette]) => ({ value, count: 0, palette }))
  }

  private syncChips(): void {
    const on = this.selected(this.view)
    this.view.chips = this.pool.slice(0, CHIPS).map((name) => ({ name, on: on.includes(name) }))
  }

  toggle(at: number): void {
    const view = this.view
    const chip = view.chips[at]

    if (!chip) {
      return
    }

    const on = this.selected(view)
    const chosen = chip.on ? on.filter((name) => name !== chip.name) : [...on, chip.name]

    if (chosen.length === 0) {
      return
    }

    view.chosen = chosen
    view.tag = chosen.join(' or ')
    this.syncChips()
    this.research()
  }

  async relate(tag: string): Promise<void> {
    this.relating?.abort()
    const names = this.selected({ tag, chosen: undefined })
    this.pool = names
    this.syncChips()
    this.paint.draw()

    if (!tag || /\s/.test(tag)) {
      return
    }

    let found = this.related.get(tag)

    if (!found) {
      const asked = new AbortController()
      this.relating = asked

      try {
        found = (await this.net.fetchRelated(tag, AbortSignal.any([this.signal, asked.signal]))).map(
          (item) => item.value,
        )
      } catch {
        return
      }

      if (this.relating !== asked) {
        return
      }

      this.related.set(tag, found)
    }

    this.pool = [...new Set([...names, ...found])]
    this.syncChips()
    this.paint.draw()
  }

  query(site: Site, view: Terms = this.view): { tags: string; notes: string[] } | undefined {
    const names = view.chosen ? pickedNames(site, view.chosen) : this.namesOf(view.tag, site.key)

    if (names.length === 0) {
      return undefined
    }

    const left = view.chosen?.slice(names.length) ?? []
    const either = names.length > 1
    const cutouts = view.preset === 'cutouts' ? site.cutouts : ''
    const clash = either && cutouts.includes('~')

    const wanted = [
      either ? names.map((name) => `~${name}`).join(' ') : (names[0] as string),
      site.rate(view.rating),
      ...site.narrow(view.narrow),
      clash ? '' : cutouts,
      view.order === 'score' ? site.best : '',
    ].filter(Boolean)

    const kept: string[] = []
    const dropped: string[] = []

    for (const part of wanted) {
      if (tagsOf([...kept, part].join(' ')) <= site.tagBudget) {
        kept.push(part)
      } else {
        dropped.push(part)
      }
    }

    return {
      tags: kept.join(' '),
      notes: [
        ...(dropped.length > 0 ? [`${site.name} takes ${site.tagBudget} tags — ${dropped.join(' ')} left out`] : []),
        ...(left.length > 0
          ? [`${site.name} takes ${names.length} tag${names.length === 1 ? '' : 's'} — ${left.join(' ')} left out`]
          : []),
        ...(clash ? [`${site.name} ORs the names, so cutouts are told by the file`] : []),
        ...(view.narrow.score > 0 && !site.scored ? [`${site.name} keeps no score`] : []),
        ...(view.narrow.png && site.guesses
          ? [`${site.name} names a file type only where danbooru holds the file`]
          : []),
      ],
    }
  }
}
