import { DIM, RESET } from './ansi.ts'

export const HUB_TABS = [
  { name: 'preview', title: 'Preview' },
  { name: 'browse', title: 'Browse' },
] as const

export type HubTab = (typeof HUB_TABS)[number]['name']

export const HUB_CLOSED = 10
export const HUB_SWITCH = 20

const PILL = '\x1b[7;1m\x1b[36m'

export function hubOf(env: Record<string, string | undefined>): HubTab | undefined {
  return HUB_TABS.find((tab) => tab.name === env.TTHEME_HUB)?.name
}

export function hubGoto(active: HubTab, step: number): number {
  const at = HUB_TABS.findIndex((tab) => tab.name === active)
  return HUB_SWITCH + ((at + step + HUB_TABS.length) % HUB_TABS.length) + 1
}

export function hubTarget(code: number): HubTab | undefined {
  return HUB_TABS[code - HUB_SWITCH - 1]?.name
}

export function hubBar(active: HubTab, color: boolean): string {
  const tabs = HUB_TABS.map(({ name, title }) => {
    if (!color) {
      return name === active ? `[${title}]` : ` ${title} `
    }
    return name === active ? `${PILL} ${title} ${RESET}` : `${DIM} ${title} ${RESET}`
  })
  const hint = 'tab next'
  return ` ${tabs.join(' ')}  ${color ? `${DIM}${hint}${RESET}` : hint}`
}
