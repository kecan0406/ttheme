import { DraftCard, InUseCard, MENUS } from '@/components/site-menus'
import { DRAFT_KEY, type DraftLine, draftLines, STORE } from '@/lib/drafts'
import { palettePath } from '@/lib/gallery'
import type { MenuWork } from '@/lib/menu'
import { html } from '@/lib/render'
import type { SearchWork } from '@/lib/search'
import type { Theme } from '@/lib/themes'
import { WEAR_EVENT } from '@/lib/wear'
import { workPath } from '@/lib/works'
import { ago } from '../../src/core/text.ts'
import { swap } from './dom'
import { afterPaint } from './palettes'
import { heldIndex, searchIndex } from './search-index'
import type { OpenChange } from './ui/change'
import { hide, show } from './ui/popover'
import { fallback, recall } from './wear'

const OPEN_MS = 120

const CLOSE_MS = 260

const POPUPS = Object.values(MENUS)

function popupOf(target: EventTarget | null): HTMLElement | null {
  const id = target instanceof Element ? target.closest<HTMLElement>('[data-menu-item]')?.dataset.menuItem : undefined

  return id ? document.getElementById(id) : null
}

function isOpen(popup: HTMLElement): boolean {
  return popup.matches(':popover-open')
}

function menuWork(work: SearchWork): MenuWork {
  return {
    id: work.id,
    name: work.name,
    native: work.native,
    lang: work.lang,
    path: work.path,
    art: work.art,
    facets: work.facets,
  }
}

interface Wait {
  to: 'open' | 'close'
  popup: HTMLElement
  timer: number
}

class SiteMenus extends HTMLElement {
  #wait: Wait | null = null
  #pinned: HTMLElement | null = null

  #moved = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return
    const popup = popupOf(event.target)

    if (!popup || (this.#wait?.to === 'open' && this.#wait.popup === popup)) return
    this.#settle()

    if (isOpen(popup)) return
    const switching = this.#open() !== null && this.#pinned === null

    if (switching) show(popup, 'trigger-hover')
    else this.#wait = { to: 'open', popup, timer: window.setTimeout(() => this.#waited(), OPEN_MS) }
  }

  #out = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return
    const from = popupOf(event.target)

    if (from && from === popupOf(event.relatedTarget)) return
    this.#later()
  }

  #press = (event: MouseEvent) => {
    const popup = popupOf(event.target)

    if (!popup) return
    this.#settle()

    if (!(event.target as Element).closest('[data-menu-trigger]')) {
      const open = this.#open()

      if (open) hide(open, 'trigger-press')

      return
    }

    if (!isOpen(popup)) return
    event.preventDefault()

    if (this.#pinned === popup) hide(popup, 'trigger-press')
    else this.#pinned = popup
  }

  #enter = (event: PointerEvent) => {
    if (event.pointerType === 'mouse' && this.#wait?.to === 'close') this.#settle()
  }

  #leave = (event: PointerEvent) => {
    if (event.pointerType === 'mouse') this.#later()
  }

  #changed = (event: CustomEvent<OpenChange>) => {
    const popup = event.target
    const { open, reason } = event.detail

    if (!(popup instanceof HTMLElement) || !POPUPS.includes(popup.id as (typeof POPUPS)[number])) return

    if (open) this.#pinned = reason === 'trigger-hover' ? null : popup
    else if (this.#pinned === popup) this.#pinned = null

    if (open && popup.id === MENUS.builder) this.#drafts()
  }

  #wore = (event: Event) => this.#inUse((event as CustomEvent<Theme>).detail)

  connectedCallback() {
    this.addEventListener('pointermove', this.#moved)
    this.addEventListener('pointerout', this.#out)
    this.addEventListener('click', this.#press)
    document.addEventListener('openchange', this.#changed)
    document.addEventListener(WEAR_EVENT, this.#wore)

    for (const popup of this.#popups()) {
      popup.addEventListener('pointerenter', this.#enter)
      popup.addEventListener('pointerleave', this.#leave)
    }

    this.#inUse(recall() ?? fallback())
    this.#drafts()
  }

  disconnectedCallback() {
    this.removeEventListener('pointermove', this.#moved)
    this.removeEventListener('pointerout', this.#out)
    this.removeEventListener('click', this.#press)
    document.removeEventListener('openchange', this.#changed)
    document.removeEventListener(WEAR_EVENT, this.#wore)

    for (const popup of this.#popups()) {
      popup.removeEventListener('pointerenter', this.#enter)
      popup.removeEventListener('pointerleave', this.#leave)
    }

    this.#settle()
  }

  #popups(): HTMLElement[] {
    return POPUPS.flatMap((id) => {
      const popup = document.getElementById(id)

      return popup ? [popup] : []
    })
  }

  #open(): HTMLElement | null {
    return this.#popups().find(isOpen) ?? null
  }

  #settle() {
    window.clearTimeout(this.#wait?.timer)
    this.#wait = null
  }

  #waited() {
    const wait = this.#wait

    if (!wait) return
    this.#wait = null
    const { popup } = wait

    if (wait.to === 'open') show(popup, 'trigger-hover')
    else if (this.#pinned !== popup && !popup.matches(':hover') && !this.querySelector(':hover')) hide(popup, 'none')
  }

  #later() {
    this.#settle()
    const popup = this.#open()

    if (!popup || this.#pinned === popup) return
    this.#wait = { to: 'close', popup, timer: window.setTimeout(() => this.#waited(), CLOSE_MS) }
  }

  #inUse(theme: Theme | null) {
    const card = document.querySelector<HTMLElement>('[data-feature="browse"] [data-in-use]')

    if (!card || !theme) return
    const id = theme.work?.id ?? ''
    const known = id ? heldIndex()?.works.find((work) => work.id === id) : undefined

    if (card.dataset.work === id && (card.hasAttribute('data-held') || !known)) {
      card.setAttribute('data-ready', '')

      if (!card.hasAttribute('data-held')) this.#fetchFor(id)

      return
    }

    const work: MenuWork | null = known
      ? menuWork(known)
      : theme.work
        ? { ...theme.work, path: workPath(theme.work.id), art: null, facets: '' }
        : null

    swap(
      card,
      html(
        InUseCard({
          work,
          href: work?.path ?? palettePath(theme),
          ready: true,
          held: id === '' || known !== undefined,
        }),
      ),
    )

    if (id && !known) this.#fetchFor(id)
  }

  #fetchFor(id: string) {
    afterPaint(() =>
      searchIndex().then(
        () => {
          if ((recall() ?? fallback())?.work?.id === id) this.#inUse(recall() ?? fallback())
        },
        () => undefined,
      ),
    )
  }

  #drafts() {
    let drafts: DraftLine[] = []

    try {
      drafts = draftLines(localStorage.getItem(STORE))
    } catch {
      return
    }

    const latest = drafts[0]
    const feature = document.querySelector('[data-feature="builder"]')

    if (!latest || !feature?.firstElementChild) return
    swap(
      feature.firstElementChild,
      html(
        DraftCard({
          name: latest.name,
          colors: latest.made,
          when: `edited ${ago(latest.at)}`,
          href: `/builder?${new URLSearchParams({ [DRAFT_KEY]: latest.id })}`,
        }),
      ),
    )
  }
}

customElements.define('site-menus', SiteMenus)
