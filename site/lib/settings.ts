import { slugOf } from '@/lib/markdown'
import { CONFIG_SETTINGS } from '../../src/store/wiring.ts'

export interface Setting {
  name: string
  id: string
  about: string
  fallback: string
}

export interface SettingGroup {
  title: string
  id: string
  settings: Setting[]
}

const ONLINE = new Set(['TTHEME_NAMES', 'TTHEME_AUTO_UPDATE', 'TTHEME_MARKETPLACE_LOOKUP'])

const GROUPS = ['Wearing palettes', 'Pictures', 'Downloads and updates', 'find'] as const

function groupOf(name: string): (typeof GROUPS)[number] {
  if (name.startsWith('TTHEME_FIND_')) return 'find'

  if (name.startsWith('TTHEME_BG_')) return 'Pictures'

  return ONLINE.has(name) ? 'Downloads and updates' : 'Wearing palettes'
}

function settingOf(name: string, doc: string): Setting {
  const found = /^#\s*(.*?)\s*\(default (.+)\)$/.exec(doc)

  if (!found) throw new Error(`${name}: its doc line ends in (default …)`)
  const about = found[1] as string

  return {
    name,
    id: name.toLowerCase(),
    about: `${about.charAt(0).toUpperCase()}${about.slice(1)}.`,
    fallback: found[2] as string,
  }
}

export const SETTING_GROUPS: SettingGroup[] = GROUPS.map((title) => ({
  title,
  id: slugOf(title),
  settings: Object.entries(CONFIG_SETTINGS).flatMap(([name, { doc }]) =>
    groupOf(name) === title ? [settingOf(name, doc)] : [],
  ),
}))
