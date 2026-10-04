const MOVES: Record<string, (index: number, count: number) => number> = {
  ArrowRight: (index) => index + 1,
  ArrowLeft: (index) => index - 1,
  Home: () => 0,
  End: (_, count) => count - 1,
}

export function tabKey(event: KeyboardEvent, select: (tab: HTMLElement) => void) {
  const tab = (event.target as Element | null)?.closest<HTMLElement>('[role="tab"]')
  const move = MOVES[event.key]
  const list = tab?.closest('[role="tablist"]')
  if (!tab || !move || !list) return
  event.preventDefault()
  const tabs = [...list.querySelectorAll<HTMLElement>('[role="tab"]')]
  const next = tabs[(move(tabs.indexOf(tab), tabs.length) + tabs.length) % tabs.length]
  if (next) select(next)
}
