const WHO = 'who-card'

class FeatureCards extends HTMLElement {
  #changed = (event: Event) => {
    const input = event.target

    if (!(input instanceof HTMLInputElement)) return

    if (input.name === WHO) this.#who(input)
    else if (input.matches('[data-strength]')) this.#strength(input)
  }

  connectedCallback() {
    this.addEventListener('input', this.#changed)
    const who = this.querySelector<HTMLInputElement>(`input[name="${WHO}"]:checked`)
    const strength = this.querySelector<HTMLInputElement>('[data-strength]')

    if (who) this.#who(who)

    if (strength) this.#strength(strength)
  }

  disconnectedCallback() {
    this.removeEventListener('input', this.#changed)
  }

  #who(input: HTMLInputElement) {
    const card = input.closest('[data-who-card]')

    if (!card) return
    card.setAttribute('style', input.dataset.look ?? '')

    for (const art of card.querySelectorAll<HTMLElement>('[data-who-art]'))
      art.toggleAttribute('data-off', art.dataset.whoArt !== input.value)
  }

  #strength(input: HTMLInputElement) {
    input
      .closest<HTMLElement>('[data-strength-card]')
      ?.style.setProperty('--strength', String(Number(input.value) / 100))
  }
}

customElements.define('feature-cards', FeatureCards)
