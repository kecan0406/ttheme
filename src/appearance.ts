import { readFileSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { writeAtomic } from './edits.ts'
import type { Host } from './host.ts'
import { MODES, type Mode } from './mode.ts'

export function appearancePath(): string {
  return join(process.env.XDG_STATE_HOME ?? join(homedir(), '.local', 'state'), 'ttheme', 'appearance')
}

export function readAppearance(): Mode | undefined {
  try {
    const text = readFileSync(appearancePath(), 'utf8').trim()

    return MODES.find((mode) => mode === text)
  } catch {
    return undefined
  }
}

export function systemAppearance(host: Host): Mode | undefined {
  if (host.platform === 'darwin') {
    return host.run('defaults', ['read', '-g', 'AppleInterfaceStyle']) === 'Dark' ? 'dark' : 'light'
  }

  const scheme =
    host.platform === 'linux'
      ? host.run('gsettings', ['get', 'org.gnome.desktop.interface', 'color-scheme'])
      : undefined

  if (scheme === undefined) {
    return undefined
  }

  return scheme.includes('prefer-dark') ? 'dark' : 'light'
}

export function forgetAppearance(): void {
  rmSync(appearancePath(), { force: true })
}

export function knowAppearance(host: Host, again = false): Mode | undefined {
  const known = again ? undefined : readAppearance()

  if (known) {
    return known
  }

  const seen = systemAppearance(host)

  if (seen) {
    writeAtomic(appearancePath(), `${seen}\n`)
  }

  return seen
}
