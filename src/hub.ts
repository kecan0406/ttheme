import { tabOf } from './tui/parts.ts'
import { painter } from './tui/style.ts'
import { zone } from './tui/zones.ts'

export const HUB_TABS = [
  { name: 'preview', title: 'Preview' },
  { name: 'browse', title: 'Browse' },
] as const

export type HubTab = (typeof HUB_TABS)[number]['name']

export const HUB_CLOSED = 10
export const HUB_SWITCH = 20

export function hubOf(env: Record<string, string | undefined>): HubTab | undefined {
  return HUB_TABS.find((tab) => tab.name === env.TTHEME_HUB)?.name
}

export interface HubSpot {
  kind: 'hub'
  tab: HubTab
}

export function hubGoto(active: HubTab, step: number): number {
  const at = HUB_TABS.findIndex((tab) => tab.name === active)
  return HUB_SWITCH + ((at + step + HUB_TABS.length) % HUB_TABS.length) + 1
}

export function hubTo(tab: HubTab): number {
  return HUB_SWITCH + HUB_TABS.findIndex((one) => one.name === tab) + 1
}

export function hubTarget(code: number): HubTab | undefined {
  return HUB_TABS[code - HUB_SWITCH - 1]?.name
}

export function hubBar(active: HubTab, color: boolean): string {
  const p = painter(color)
  const tabs = HUB_TABS.map(({ name, title }) => {
    const spot: HubSpot = { kind: 'hub', tab: name }
    return tabOf(p, title, name === active, (text) => zone(spot, text))
  })
  return ` ${tabs.join(' ')}  ${p.dim('tab next')}`
}
