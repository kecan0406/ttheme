import { dropImage, switchImage } from './backdrop.ts'
import { find, readCatalog } from './catalog.ts'
import { configHome, refreshProfiles } from './palettes.ts'

export function runImage(name: string, action: string): number {
  const home = configHome()
  find(readCatalog(home).palettes, name)
  if (action === 'next' || action === 'prev') {
    const { key, at, of } = switchImage(home, name, action === 'next' ? 1 : -1)
    refreshProfiles(home)
    process.stderr.write(`background · ${name} ${at}/${of} ${key}\n`)
    return 0
  }
  if (action === 'drop') {
    const { key, left } = dropImage(home, name)
    refreshProfiles(home)
    process.stderr.write(`background · ${name} removed ${key} · ${left} left\n`)
    return 0
  }
  if (action === 'tuned') {
    refreshProfiles(home)
    return 0
  }
  throw new Error(`unknown image action ${action} — next, prev, drop or tuned`)
}
