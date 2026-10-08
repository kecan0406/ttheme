import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Theme } from '../theme.ts'
import { owned } from '../theme.ts'
import type { Host, Unwired, Wiring } from './types.ts'

export function readText(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf8') : ''
}

export function tilde(path: string, home: string): string {
  return path.startsWith(`${home}/`) ? `~${path.slice(home.length)}` : path
}

export function blockKeys(body: string): string {
  const keys = body.split('\n').filter((line) => line !== '' && !line.startsWith('#'))
  return [...new Set(keys.map((line) => line.split(/[ =]/)[0]))].join(', ')
}

export function stripped(file: string, remove: (content: string) => string): Unwired['edits'] {
  const content = readText(file)
  const next = remove(content)
  return next === content ? [] : [{ file, content: next }]
}

export function dataHome(home: string): string {
  return process.env.XDG_DATA_HOME ?? join(home, '.local', 'share')
}

export function ownedIn(dir: string): string[] {
  return existsSync(dir)
    ? readdirSync(dir).flatMap((file) => (file.startsWith(owned('')) ? [join(dir, file)] : []))
    : []
}

export function themeFiles(wiring: Wiring, theme: Theme): { file: string; content: string }[] {
  if (!wiring.shelf) {
    return []
  }
  const prefix = `${[wiring.id, wiring.shelf.from].filter(Boolean).join('/')}/`
  return (wiring.emitter.emit?.(theme) ?? []).flatMap((out) => {
    const file = out.path.startsWith(prefix) ? out.path.slice(prefix.length) : ''
    return file !== '' && !file.includes('/') ? [{ file, content: out.content }] : []
  })
}

export function systemHost(): Host {
  return {
    platform: process.platform,
    env: process.env,
    run: (command, args) => {
      try {
        return execFileSync(command, [...args], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore'],
          timeout: 5000,
        }).trim()
      } catch {
        return undefined
      }
    },
  }
}
