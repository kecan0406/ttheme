import { type Filters, matches, type Searchable, SOURCES, type Source, START, shelvesMatching } from '@/lib/gallery'

function read(row: HTMLElement): Searchable {
  return {
    text: row.dataset.search ?? '',
    official: row.hasAttribute('data-official'),
  }
}

class MarketplaceBoard extends HTMLElement {
  #filters: Filters = { ...START }
  #open = new Set<string>()

  #input = (event: Event) => {
    const target = event.target as HTMLInputElement
    if (target.name !== 'query') return
    this.#filters = { ...this.#filters, query: target.value }
    this.#render()
  }

  #change = (event: Event) => {
    const { name, value } = event.target as HTMLInputElement
    if (name !== 'source') return
    this.#filters = { ...this.#filters, source: value as Source }
    this.#render()
  }

  #toggle = (event: Event) => {
    const shelf = event.target
    if (!(shelf instanceof HTMLDetailsElement) || this.#filtering()) return
    const key = shelf.dataset.shelf ?? ''
    if (shelf.open) this.#open.add(key)
    else this.#open.delete(key)
  }

  #slash = (event: KeyboardEvent) => {
    if (event.key !== '/' || event.target instanceof HTMLInputElement) return
    event.preventDefault()
    this.querySelector<HTMLInputElement>('input[name="query"]')?.focus()
  }

  connectedCallback() {
    this.addEventListener('input', this.#input)
    this.addEventListener('change', this.#change)
    this.addEventListener('toggle', this.#toggle, true)
    window.addEventListener('keydown', this.#slash)
    for (const shelf of this.querySelectorAll<HTMLDetailsElement>('details[data-shelf][open]'))
      this.#open.add(shelf.dataset.shelf ?? '')
    const query = this.querySelector<HTMLInputElement>('input[name="query"]')?.value ?? ''
    const source = this.querySelector<HTMLInputElement>('input[name="source"]:checked')?.value as Source | undefined
    this.#filters = { query, source: source ?? START.source }
    this.#render()
  }

  disconnectedCallback() {
    window.removeEventListener('keydown', this.#slash)
  }

  #filtering(): boolean {
    return this.#filters.query.trim() !== ''
  }

  #render() {
    const shelves = [...this.querySelectorAll<HTMLDetailsElement>('details[data-shelf]')]
    const rows = shelves.map((shelf) => [...shelf.querySelectorAll<HTMLElement>('[data-row]')])
    const found = rows.map((members) => members.map(read))
    for (const source of SOURCES) {
      const label = this.querySelector(`[data-count="${source}"]`)
      if (label) label.textContent = String(shelvesMatching(found, { ...this.#filters, source }))
    }
    const filtering = this.#filtering()
    let shown = 0
    for (const [index, shelf] of shelves.entries()) {
      const members = rows[index] ?? []
      const searched = found[index] ?? []
      const visible = members.filter((_, at) => {
        const member = searched[at]
        return member !== undefined && matches(member, this.#filters)
      })
      for (const row of members) row.hidden = !visible.includes(row)
      const count = shelf.querySelector('[data-shelf-count]')
      if (count) count.textContent = filtering ? `${visible.length} of ${members.length}` : String(members.length)
      shelf.hidden = visible.length === 0
      shelf.open = filtering ? visible.length > 0 : this.#open.has(shelf.dataset.shelf ?? '')
      shown += visible.length
    }
    this.querySelector('[data-empty]')?.toggleAttribute('hidden', shown > 0)
    const title = this.querySelector('[data-empty-title]')
    const query = this.#filters.query.trim()
    if (title) title.textContent = `no palette matches${query ? ` “${query}”` : ' these filters'} ( ˘ω˘ )`
  }
}

customElements.define('marketplace-board', MarketplaceBoard)
