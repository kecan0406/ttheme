import { plural } from '@/lib/utils'
import { announce } from './dom'
import { composing, letter, typing } from './keys'

class DocsPage extends HTMLElement {
  #spy: IntersectionObserver | null = null

  #seen = new Map<string, boolean>()

  #tallying = 0

  #input = (event: Event) => {
    const field = event.target as HTMLInputElement

    if (field.name !== 'docs-query') return
    const shown = this.#filter(field.value)
    window.clearTimeout(this.#tallying)
    this.#tallying = window.setTimeout(() => announce(shown === 0 ? 'no page matches' : plural(shown, 'page')), 500)
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
    const ids = [...this.#seen.keys()]
    const current = ids.findLast((id) => this.#seen.get(id)) ?? ids.find((id) => !this.#seen.get(id))
    const at = current === undefined ? -1 : ids.indexOf(current)

    for (const link of this.querySelectorAll<HTMLAnchorElement>('[data-toc] a')) {
      const index = ids.indexOf(link.hash.slice(1))

      if (index === at) link.setAttribute('aria-current', 'location')
      else link.removeAttribute('aria-current')
      link.toggleAttribute('data-done', index !== -1 && index < at)
    }
  }

  #watch() {
    const headings = [...this.querySelectorAll<HTMLElement>('#content :is(h2, h3)[id]')]

    if (headings.length === 0) return
    this.#seen = new Map(headings.map((heading) => [heading.id, false]))
    this.#spy = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          this.#seen.set(entry.target.id, entry.boundingClientRect.top < window.innerHeight * 0.3)
        }

        this.#mark()
      },
      { rootMargin: '0px 0px -70% 0px', threshold: [0, 1] },
    )

    for (const heading of headings) this.#spy.observe(heading)
  }

  connectedCallback() {
    this.addEventListener('input', this.#input)
    this.addEventListener('keydown', this.#submit)
    document.addEventListener('keydown', this.#keydown)
    this.#watch()
  }

  disconnectedCallback() {
    this.removeEventListener('input', this.#input)
    this.removeEventListener('keydown', this.#submit)
    document.removeEventListener('keydown', this.#keydown)
    this.#spy?.disconnect()
    window.clearTimeout(this.#tallying)
  }
}

customElements.define('docs-page', DocsPage)
