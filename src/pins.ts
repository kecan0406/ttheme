import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { writeAtomic } from './edits.ts'

export function pinsPath(configHome: string): string {
  return join(configHome, 'ttheme', 'pins')
}

export function movePins(configHome: string, renamed: ReadonlyMap<string, string>, removed: readonly string[]): void {
  const path = pinsPath(configHome)
  if (!existsSync(path)) {
    return
  }
  const text = readFileSync(path, 'utf8')
  const lines = text.split('\n').flatMap((line) => {
    const pin = /^((?:[~/]|ssh:).*\s)(\S+)(\s*)$/.exec(line)
    if (!pin) {
      return [line]
    }
    const [, key, name, end] = pin as unknown as [string, string, string, string]
    if (removed.includes(name)) {
      return []
    }
    const to = renamed.get(name)
    return [to ? `${key}${to}${end}` : line]
  })
  const next = lines.join('\n')
  if (next !== text) {
    writeAtomic(path, next)
  }
}
