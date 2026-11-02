import { CREDITS_PATH } from '@/lib/art'
import { CATEGORIES, categoryPath } from '@/lib/categories'
import { BROWSE_PATH, MARKETPLACES_PATH } from '@/lib/gallery'
import { WORK_PATH } from '@/lib/works'
import { reducedMotion } from './dom'

type Page = 'works' | 'marketplaces' | 'credits' | 'work'

type Move = 'open' | 'close' | 'lens' | 'page'

interface Place {
  page: Page
  id: string
}

const ART = 'data-move-art'

const FRAME = 'data-move-frame'

const TILE = 16 / 9

const LENSES: Page[] = ['works', 'marketplaces']

const WORKS_PATHS = [BROWSE_PATH, ...CATEGORIES.map((category) => categoryPath(category.slug))]

let restored = false

function placeOf(href: string | null | undefined): Place | null {
  if (!href) return null
  const { origin, pathname } = new URL(href, location.href)

  if (origin !== location.origin) return null

  if (WORKS_PATHS.includes(pathname)) return { page: 'works', id: pathname }

  if (pathname === MARKETPLACES_PATH) return { page: 'marketplaces', id: '' }

  if (pathname === CREDITS_PATH) return { page: 'credits', id: '' }

  if (!pathname.startsWith(`${WORK_PATH}/`)) return null

  try {
    return { page: 'work', id: decodeURIComponent(pathname.slice(WORK_PATH.length + 1)) }
  } catch {
    return null
  }
}

function moveOf(from: Place | null, to: Place | null): Move | null {
  if (!from || !to || (from.page === to.page && from.id === to.id)) return null

  if (from.page === 'works' && to.page === 'work') return 'open'

  if (from.page === 'work' && to.page === 'works') return 'close'

  return from.page !== to.page && LENSES.includes(from.page) && LENSES.includes(to.page) ? 'lens' : 'page'
}

function clear() {
  for (const element of document.querySelectorAll(`[${ART}]`)) element.removeAttribute(ART)

  for (const frame of document.querySelectorAll(`[${FRAME}]`)) frame.remove()
}

function artIn(holder: Element): HTMLImageElement | SVGSVGElement | null {
  const art = holder.querySelector(':scope > img, :scope > svg')

  if (art instanceof HTMLImageElement) return art.complete && art.naturalWidth > 0 ? art : null

  return art instanceof SVGSVGElement ? art : null
}

function tileOf(work: string): HTMLElement | null {
  const header = document.querySelector('[data-site-header]')?.getBoundingClientRect().bottom ?? 0

  for (const item of document.querySelectorAll<HTMLElement>(
    '[data-tiles] > [data-work], [data-found-tiles] > [data-work]',
  )) {
    if (item.dataset.work !== work || item.hidden) continue
    const tile = item.querySelector<HTMLElement>('[data-slot="work-art"]')
    const box = tile?.getBoundingClientRect()

    if (tile && box && box.width > 0 && box.top >= header && box.top + box.height * 0.4 <= window.innerHeight)
      return tile
  }

  return null
}

function hero(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-slot="work-hero"]')
}

function frame(holder: HTMLElement): boolean {
  const art = artIn(holder)

  if (!art) return false
  const { width, height } = holder.getBoundingClientRect()
  const image = art instanceof HTMLImageElement
  const view = image ? null : art.viewBox.baseVal
  const across = image ? art.naturalWidth : (view?.width ?? 0)
  const down = image ? art.naturalHeight : (view?.height ?? 0)

  if (!(across > 0 && down > 0 && width > 0 && height > 0)) return false
  const rise = image ? Number.parseFloat(getComputedStyle(art).objectPosition.split(' ')[1] ?? '50') / 100 : 0.5
  const scale = Math.max(width / across, height / down)

  const crop =
    across / down >= TILE
      ? { x: (across - down * TILE) / 2, y: 0, w: down * TILE, h: down }
      : { x: 0, y: (down - across / TILE) / 2, w: across, h: across / TILE }

  const copy = art.cloneNode(true) as HTMLImageElement | SVGSVGElement
  copy.removeAttribute('class')
  copy.setAttribute(FRAME, '')
  copy.setAttribute(ART, '')
  Object.assign(copy.style, {
    position: 'absolute',
    left: `${(width - scale * across) / 2 + scale * crop.x}px`,
    top: `${(height - scale * down) * rise + scale * crop.y}px`,
    width: `${scale * crop.w}px`,
    height: `${scale * crop.h}px`,
    maxWidth: 'none',
    objectFit: 'cover',
  })

  if (copy instanceof HTMLImageElement) copy.decoding = 'sync'
  else copy.setAttribute('viewBox', `${crop.x + (view?.x ?? 0)} ${crop.y + (view?.y ?? 0)} ${crop.w} ${crop.h}`)
  holder.prepend(copy)

  return true
}

export function moveTo(href: string | null | undefined): Move | null {
  return moveOf(placeOf(location.href), placeOf(href))
}

export function depart(event: PageSwapEvent): boolean {
  const { activation, viewTransition } = event

  if (
    !viewTransition ||
    !('types' in viewTransition) ||
    !activation ||
    activation.navigationType === 'reload' ||
    reducedMotion()
  )
    return false
  const to = placeOf(activation.entry.url)
  const move = moveOf(placeOf(location.href), to)

  if (!move || !to) return false
  clear()
  const holder = move === 'open' ? tileOf(to.id) : move === 'close' ? hero() : null
  const box = holder?.getBoundingClientRect()

  if (holder && box && artIn(holder) && (move === 'open' || box.bottom >= box.height * 0.6))
    holder.setAttribute(ART, '')
  viewTransition.types.add('move')
  viewTransition.types.add(move)
  viewTransition.ready.catch(() => {})
  viewTransition.finished.then(clear, clear)

  return true
}

function reveal(event: PageRevealEvent) {
  const transition = event.viewTransition
  const back = restored
  restored = false

  if (!transition || !('types' in transition) || !transition.types.has('move')) return
  const activation = 'navigation' in window ? window.navigation.activation : null
  const from = placeOf(activation?.from?.url)
  clear()
  const shown = transition.types.has('open') ? hero() : null

  if (shown) frame(shown)
  const settled = activation?.navigationType !== 'traverse' || back
  const tile = transition.types.has('close') && from && settled ? tileOf(from.id) : null
  const art = tile && artIn(tile)

  if (tile && art) {
    tile.setAttribute(ART, '')

    if (art instanceof HTMLImageElement) art.decoding = 'sync'
    else transition.types.add('facets')
  }

  transition.ready.catch(() => {})
  transition.finished.then(clear, clear)
}

window.addEventListener('pageshow', (event) => {
  restored = event.persisted

  if (event.persisted) clear()
})

window.addEventListener('pagereveal', reveal)

hero()
  ?.querySelector<HTMLImageElement>(':scope > img')
  ?.decode()
  .catch(() => {})
