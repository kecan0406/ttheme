import { homedir } from 'node:os'
import { join } from 'node:path'

export function configHome(): string {
  return process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config')
}

export function cacheRoot(): string {
  return join(process.env.XDG_CACHE_HOME ?? join(homedir(), '.cache'), 'ttheme')
}
