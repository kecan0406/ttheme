import { plural } from '@/lib/utils'
import { announce } from './dom'
import { composing, letter, typing } from './keys'

function idOf(hash: string): string {
  try {
    return decodeURIComponent(hash.slice(1))
  } catch {
    return ''
  }
}

class DocsPage extends HTMLElement {
  #spy: IntersectionObserver | null = null

  #passed = new Map<string, boolean>()

  #pinned: string | null = null

  #tallying = 0

  #frame = 0

  #sized: ResizeObserver | null = null

  #fit = () => {
    if (this.#frame !== 0) return
    this.#frame = requestAnimationFrame(() => {
      this.#frame = 0
      const nav = this.querySelector<HTMLElement>('#docs-menu')
      const main = this.querySelector<HTMLElement>('#content')

      if (!nav || !main) return
      const top = Number.parseFloat(getComputedStyle(nav).top) || 0
      const room = Math.max(0, Math.floor(main.getBoundingClientRect().bottom - top))
      this.style.setProperty('--docs-room', `${room}px`)
    })
  }

  #input = (event: Event) => {
    const field = event.target as HTMLInputElement

    if (field.name !== 'docs-query') return
    const shown = this.#filter(field.value)
    window.clearTimeout(this.#tallying)
    this.#tallying = window.setTimeout(() => announce(shown === 0 ? 'No page matches' : plural(shown, 'page')), 500)
  }

  #submit = (event: KeyboardEvent) => {
    const field = event.target as HTMLInputElement

    if (field.name !== 'docs-query' || event.key !== 'Enter' || composing(event)) return
    const first = this.querySelector<HTMLAnchorElement>('[data-terms]:not([hidden]) a')

    if (!first) return
    event.preventDefault()
    location.assign(first.href)
  }

  #keydown = (event: KeyboardEvent) => {
    if (!letter(event, 'k') || event.metaKey === event.ctrlKey || event.altKey || event.shiftKey) return

    if (event.defaultPrevented || composing(event) || typing(event.target)) return
    const menu = this.querySelector<HTMLElement>('#docs-menu')
    const field = menu?.querySelector<HTMLInputElement>('input[name="docs-query"]')

    if (!menu || !field) return
    event.preventDefault()

    if (getComputedStyle(menu).display === 'none') menu.showPopover()
    field.focus()
    field.select()
  }

  #filter(query: string): number {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    let shown = 0

    for (const item of this.querySelectorAll<HTMLElement>('[data-terms]')) {
      const terms = item.dataset.terms ?? ''
      const hit = words.every((word) => terms.includes(word))
      item.hidden = !hit

      if (hit) shown += 1
    }

    for (const group of this.querySelectorAll<HTMLElement>('[data-group]')) {
      group.hidden = group.querySelector('[data-terms]:not([hidden])') === null
    }

    const none = this.querySelector<HTMLElement>('[data-none]')

    if (none) none.hidden = shown > 0

    return shown
  }

  #mark() {
    const ids = [...this.#passed.keys()]
    const current = this.#pinned ?? ids.findLast((id) => this.#passed.get(id)) ?? ids[0]
    const at = current === undefined ? -1 : ids.indexOf(current)

    for (const link of this.querySelectorAll<HTMLAnchorElement>('[data-toc] a')) {
      const index = ids.indexOf(link.hash.slice(1))

      if (index === at) link.setAttribute('aria-current', 'location')
      else link.removeAttribute('aria-current')
      link.toggleAttribute('data-done', index !== -1 && index < at)
    }
  }

  #pin(id: string) {
    this.#pinned = this.#passed.has(id) ? id : null
    this.#mark()
  }

  #follow = (event: MouseEvent) => {
    const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href^="#"]')

    if (link) this.#pin(idOf(link.hash))
  }

  #arrive = () => {
    this.#pin(idOf(location.hash))
  }

  #release = () => {
    if (this.#pinned === null) return
    this.#pinned = null
    this.#mark()
  }

  #watch() {
    const headings = [...this.querySelectorAll<HTMLElement>('#content :is(h2, h3)[id]')]

    if (headings.length === 0) return
    const padding = Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0

    const margin = Math.max(
      0,
      ...headings.map((heading) => Number.parseFloat(getComputedStyle(heading).scrollMarginTop) || 0),
    )

    const line = Math.ceil(padding + margin) + 4
    this.#passed = new Map(headings.map((heading) => [heading.id, false]))
    this.#spy = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) this.#passed.set(entry.target.id, entry.boundingClientRect.top < line)
        this.#mark()
      },
      { rootMargin: `-${line}px 0px 0px 0px`, threshold: [0, 1] },
    )

    for (const heading of headings) this.#spy.observe(heading)

    if (location.hash) this.#arrive()
  }

  connectedCallback() {
    this.addEventListener('input', this.#input)
    this.addEventListener('keydown', this.#submit)
    this.addEventListener('click', this.#follow)
    document.addEventListener('keydown', this.#keydown)
    window.addEventListener('hashchange', this.#arrive)

    for (const kind of ['wheel', 'touchstart', 'keydown'])
      window.addEventListener(kind, this.#release, { passive: true })
    window.addEventListener('scroll', this.#fit, { passive: true })
    window.addEventListener('resize', this.#fit, { passive: true })
    const main = this.querySelector('#content')
    this.#sized = new ResizeObserver(this.#fit)

    if (main) this.#sized.observe(main)
    this.#watch()
    this.#fit()
  }

  disconnectedCallback() {
    this.removeEventListener('input', this.#input)
    this.removeEventListener('keydown', this.#submit)
    this.removeEventListener('click', this.#follow)
    document.removeEventListener('keydown', this.#keydown)
    window.removeEventListener('hashchange', this.#arrive)

    for (const kind of ['wheel', 'touchstart', 'keydown']) window.removeEventListener(kind, this.#release)
    window.removeEventListener('scroll', this.#fit)
    window.removeEventListener('resize', this.#fit)
    this.#sized?.disconnect()
    cancelAnimationFrame(this.#frame)
    this.#frame = 0
    this.#spy?.disconnect()
    window.clearTimeout(this.#tallying)
  }
}

customElements.define('docs-page', DocsPage)
