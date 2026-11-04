import { tally } from '../dom'
import { composing } from '../keys'
import { emit, type ItemHighlighted } from './change'

const PAGE = 8

const MOVES = new Map<string, (at: number, last: number) => number>([
  ['ArrowDown', (at, last) => (at === last ? 0 : at + 1)],
  ['ArrowUp', (at, last) => (at <= 0 ? last : at - 1)],
  ['PageDown', (at, last) => Math.min(at + PAGE, last)],
  ['PageUp', (at) => Math.max(at - PAGE, 0)],
])

function rootOf(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>('[data-slot="combobox"]') : null
}

function inputOf(root: HTMLElement): HTMLInputElement | null {
  return root.querySelector<HTMLInputElement>('[data-slot="combobox-input"]')
}

function itemsOf(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('[data-slot="combobox-item"]')]
}

function shownIn(root: HTMLElement): HTMLElement[] {
  return itemsOf(root).filter((item) => !item.hidden)
}

function chosenIn(root: HTMLElement): HTMLElement | undefined {
  return shownIn(root).find((item) => item.dataset.value === root.dataset.value)
}

function filtering(root: HTMLElement): boolean {
  return root.dataset.filter !== 'off'
}

function light(
  root: HTMLElement,
  item: HTMLElement | undefined,
  block?: ScrollLogicalPosition,
  reason: ItemHighlighted['reason'] = 'none',
) {
  const before = root.querySelector<HTMLElement>('[data-highlighted]')

  for (const one of root.querySelectorAll('[data-highlighted]'))
    if (one !== item) one.removeAttribute('data-highlighted')
  const input = inputOf(root)

  root.toggleAttribute('data-pointed', reason === 'pointer')

  if (!item) input?.removeAttribute('aria-activedescendant')
  else {
    item.setAttribute('data-highlighted', '')
    input?.setAttribute('aria-activedescendant', item.id)

    if (block) item.scrollIntoView({ block })
  }

  if (before !== (item ?? null)) emit(root, 'itemhighlighted', { value: item?.dataset.value ?? null, reason }, false)
}

function mark(root: HTMLElement) {
  for (const item of itemsOf(root)) {
    const on = item.dataset.value === root.dataset.value
    item.setAttribute('aria-selected', String(on))
    item.toggleAttribute('data-selected', on)
  }
}

function narrow(root: HTMLElement, block?: ScrollLogicalPosition, keep = false): number {
  const query = (inputOf(root)?.value ?? '').trim().toLowerCase()
  const items = itemsOf(root)

  if (filtering(root))
    for (const item of items) item.hidden = query !== '' && !(item.dataset.text ?? '').includes(query)

  for (const group of root.querySelectorAll<HTMLElement>('[data-slot="combobox-group"]'))
    group.hidden = group.querySelector('[data-slot="combobox-item"]:not([hidden])') === null
  const shown = shownIn(root)
  const empty = root.querySelector<HTMLElement>('[data-slot="combobox-empty"]')

  if (empty) empty.hidden = shown.length > 0 || items.length === 0
  const active = keep ? inputOf(root)?.getAttribute('aria-activedescendant') : null
  const kept = shown.find((item) => item.id === active)

  if (kept) light(root, kept, undefined, root.hasAttribute('data-pointed') ? 'pointer' : 'none')
  else light(root, query === '' ? (chosenIn(root) ?? shown[0]) : shown[0], block)

  return shown.length
}

function pick(root: HTMLElement, item: HTMLElement) {
  const value = item.dataset.value ?? ''

  if (!emit(root, 'valuechange', { value, reason: 'item-press', trigger: item }, true)) return
  root.dataset.value = value
  mark(root)
  const popup = root.closest<HTMLElement>('[popover]')

  if (popup?.matches(':popover-open')) popup.hidePopover()
}

function typed(event: Event) {
  const root = rootOf(event.target)

  if (!root || event.target !== inputOf(root)) return
  const count = narrow(root, 'nearest')

  if (filtering(root)) tally(count)
}

document.addEventListener('input', typed)

document.addEventListener('compositionend', typed)

document.addEventListener('keydown', (event) => {
  const root = rootOf(event.target)

  if (!root || event.target !== inputOf(root) || composing(event) || event.altKey || event.metaKey || event.ctrlKey)
    return
  const shown = shownIn(root)
  const current = root.querySelector<HTMLElement>('[data-highlighted]:not([hidden])') ?? undefined

  if (event.key === 'Enter') {
    const item = current ?? shown[0]

    if (!item) return
    event.preventDefault()

    if (item instanceof HTMLAnchorElement) item.click()
    else pick(root, item)

    return
  }

  const move = MOVES.get(event.key)

  if (!move || shown.length === 0) return
  event.preventDefault()
  light(root, shown[move(current ? shown.indexOf(current) : -1, shown.length - 1)], 'nearest', 'keyboard')
})

document.addEventListener('pointermove', (event) => {
  if (event.pointerType !== 'mouse' || !(event.target instanceof Element)) return
  const item = event.target.closest<HTMLElement>('[data-slot="combobox-item"]')
  const root = rootOf(item)

  if (item && root && !item.hasAttribute('data-highlighted') && !item.hidden) light(root, item, undefined, 'pointer')
})

document.addEventListener('mousedown', (event) => {
  if (event.target instanceof Element && event.target.closest('[data-slot="combobox-item"]')) event.preventDefault()
})

document.addEventListener('click', (event) => {
  const item = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-slot="combobox-item"]') : null
  const root = rootOf(item)

  if (item && root) pick(root, item)
})

document.addEventListener('openchange', (event) => {
  const popup = event.target

  if (!(popup instanceof HTMLElement) || !popup.matches('[data-slot="popover"]')) return

  for (const root of popup.querySelectorAll<HTMLElement>('[data-slot="combobox"]')) {
    if (event.detail.open) {
      requestAnimationFrame(() => {
        mark(root)
        light(root, chosenIn(root) ?? shownIn(root)[0], 'center')
      })

      continue
    }

    const input = inputOf(root)

    if (input) input.value = ''
    narrow(root)
    light(root, undefined)
  }
})

const lists = new MutationObserver((records) => {
  const roots = new Set<HTMLElement>()

  for (const { target } of records) {
    const root = rootOf(target)

    if (root) roots.add(root)
  }

  for (const root of roots) {
    mark(root)
    narrow(root, 'center', true)
  }
})

for (const list of document.querySelectorAll('[data-slot="combobox-list"]'))
  lists.observe(list, { childList: true, subtree: true })
