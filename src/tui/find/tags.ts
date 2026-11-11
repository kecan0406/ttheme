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
  private suggestTimer?: NodeJS.Timeout
  private suggesting?: AbortController

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
    if (this.view.editing === undefined) {
      this.view.editing = ''
    }
  }

  write(text: string): void {
    if (this.view.editing !== undefined) {
      this.view.editing += text
    }
  }

  shut(): void {
    this.view.editing = undefined
    this.view.suggest = undefined
    this.view.pick = undefined
  }

  point(index: number): void {
    this.view.pick = index
  }

  retag(text: string): void {
    this.view.tag = text
    this.view.chosen = undefined
  }

  editKey(key: string): void {
    const view = this.view
    const text = view.editing ?? ''
    const shown = view.suggest ?? []
    const line = lineStep(key)

    if (line !== undefined && shown.length > 0) {
      const at = view.pick ?? shown.length
      const next = (at + (line > 0 ? 1 : shown.length)) % (shown.length + 1)
      view.pick = next === shown.length ? undefined : next
      this.paint.draw()

      return
    }

    if (key === 'esc' || key === 'enter') {
      this.quietSuggest()
    }

    if (key === 'esc') {
      view.editing = undefined

      if (view.tag === '') {
        this.leave(2)

        return
      }

      this.paint.draw()

      return
    }

    if (key === 'enter') {
      const picked = view.pick === undefined ? undefined : shown[view.pick]
      const chosen = picked ? text.replace(/\S*$/, () => picked.value) : text
      view.editing = undefined
      view.suggest = undefined
      view.pick = undefined

      if (chosen.trim()) {
        void this.commit(chosen.trim())

        return
      }

      if (view.tag === '') {
        this.leave(2)

        return
      }

      this.paint.draw()

      return
    }

    const next = edit(text, key)

    if (next !== undefined) {
      view.editing = next
      this.suggest()
      this.paint.draw()
    }
  }

  quietSuggest(): void {
    clearTimeout(this.suggestTimer)
    this.suggesting?.abort()
    this.suggesting = undefined
  }

  suggest(): void {
    this.quietSuggest()
    const view = this.view
    view.pick = undefined
    const text = view.editing ?? ''
    const token = /\S*$/.exec(text)?.[0] ?? ''

    if (!completable(token)) {
      view.suggest = undefined

      return
    }

    const known = this.ownTags(token).slice(0, KNOWN)
    view.suggest = known.length > 0 ? known : undefined

    const asked = new AbortController()
    this.suggesting = asked
    this.suggestTimer = setTimeout(async () => {
      try {
        const found = await this.net.fetchSuggestions(token, AbortSignal.any([this.signal, asked.signal]))

        if (this.suggesting === asked && view.editing !== undefined) {
          const counts = new Map(found.map((item) => [item.value, item.count]))
          const names = new Set(known.map((item) => item.value))

          const listed = [
            ...known.map((item) => ({ ...item, count: counts.get(item.value) ?? 0 })),
            ...found.filter((item) => !names.has(item.value)),
          ].slice(0, SUGGESTED)

          const held = view.pick !== undefined && view.pick < known.length ? view.pick : undefined
          view.suggest = listed
          view.pick = held ?? (WRITTEN.test(text) && listed.length > 0 ? 0 : undefined)
          this.paint.draw()
        }
      } catch {}
    }, SUGGEST_WAIT)
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
