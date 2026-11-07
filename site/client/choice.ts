import { CHOICES, type Choice } from '@/lib/choice'
import { respeculate } from './speculation'
import { pressIn } from './ui/pressed'

const root = document.documentElement

const NAMES = Object.keys(CHOICES) as Choice[]

function isChoice(name: string | null): name is Choice {
  return name !== null && Object.hasOwn(CHOICES, name)
}

function picked(name: Choice, value: string | null): string {
  const { values } = CHOICES[name]
  const known: readonly string[] = values

  return value !== null && known.includes(value) ? value : values[0]
}

function stored(name: Choice): string | null {
  try {
    return localStorage.getItem(CHOICES[name].key)
  } catch {
    return null
  }
}

function show(name: Choice, value: string | null) {
  const shown = picked(name, value)

  if (shown === CHOICES[name].values[0]) delete root.dataset[name]
  else root.dataset[name] = shown

  for (const group of document.querySelectorAll(`[data-choice="${name}"]`)) pressIn(group, shown)
}

function showAll() {
  for (const name of NAMES) show(name, stored(name))
}

document.addEventListener('valuechange', (event) => {
  if (!(event.target instanceof Element)) return
  const name = event.target.getAttribute('data-choice')

  if (!isChoice(name)) return
  const shown = picked(name, event.detail.value)
  show(name, shown)

  try {
    if (shown === CHOICES[name].values[0]) localStorage.removeItem(CHOICES[name].key)
    else localStorage.setItem(CHOICES[name].key, shown)
  } catch {}

  respeculate()
})

window.addEventListener('storage', (event) => {
  if (event.key === null || NAMES.some((name) => CHOICES[name].key === event.key)) showAll()
})

window.addEventListener('pageshow', showAll)

showAll()
