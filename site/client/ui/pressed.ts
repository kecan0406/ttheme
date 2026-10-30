export function press(toggle: Element, pressed: boolean) {
  toggle.setAttribute('aria-pressed', String(pressed))
  toggle.toggleAttribute('data-pressed', pressed)
}

export function pressIn(group: Element, value: string | undefined) {
  for (const toggle of group.querySelectorAll('[data-slot="toggle"]'))
    press(toggle, toggle.getAttribute('data-value') === value)
}
