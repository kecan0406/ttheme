import { existsSync } from 'node:fs'
import { basename, join } from 'node:path'
import type { Host } from './terminals/types.ts'
import { LAYER, MANAGED } from './wiring.ts'

export const SHELLS = ['zsh', 'bash', 'fish'] as const
export type Shell = (typeof SHELLS)[number]

export function shellNamed(path: string | undefined): Shell | undefined {
  const name = basename(path ?? '').replace(/^-/, '')
  return (SHELLS as readonly string[]).includes(name) ? (name as Shell) : undefined
}

export function invokingShell(run: Host['run'], pid: number): Shell | undefined {
  for (let at = pid, hops = 0; at > 1 && hops < 12; hops++) {
    const [parent, ...name] =
      run('ps', ['-o', 'ppid=,comm=', '-p', String(at)])
        ?.trim()
        .split(/\s+/) ?? []
    const shell = shellNamed(name.join(' '))
    if (shell) {
      return shell
    }
    at = Number(parent)
  }
  return undefined
}

export function shellsOf(host: Host, pid: number): Shell[] {
  const found = new Set<Shell>(['zsh'])
  for (const shell of [shellNamed(host.env.SHELL), invokingShell(host.run, pid)]) {
    if (shell) {
      found.add(shell)
    }
  }
  return SHELLS.filter((shell) => found.has(shell))
}

const ZDOTDIR_MARK = 'ttheme-zdotdir:'

export function zdotdirOf(host: Host, home: string): string {
  if (host.env.ZDOTDIR) {
    return host.env.ZDOTDIR
  }
  const asked = host.run('zsh', ['-c', `print -rn -- "${ZDOTDIR_MARK}\${ZDOTDIR:-$HOME}"`]) ?? ''
  const at = asked.lastIndexOf(ZDOTDIR_MARK)
  return (at >= 0 && asked.slice(at + ZDOTDIR_MARK.length)) || home
}

export function hasZsh(host: Host): boolean {
  return host.run('zsh', ['-fc', 'print ok']) === 'ok'
}

const BASH_LOGIN = ['.bash_profile', '.bash_login', '.profile']

export function bashFiles(home: string, platform: NodeJS.Platform): string[] {
  const rc = join(home, '.bashrc')
  const login = BASH_LOGIN.map((file) => join(home, file)).find((file) => existsSync(file))
  const files = [...(existsSync(rc) ? [rc] : []), ...(login ? [login] : [])]
  if (platform === 'darwin' && !login) {
    files.push(join(home, '.bash_profile'))
  }
  return files.length > 0 ? files : [rc]
}

export function bashCandidates(home: string): string[] {
  return ['.bashrc', ...BASH_LOGIN].map((file) => join(home, file))
}

const THROUGH_ZSH = `zsh -c 'source ${LAYER} && ttheme "$@"' ttheme`

export function bashBlock(): string {
  return `# ${MANAGED}\nttheme() { ${THROUGH_ZSH} "$@"; }`
}

export function fishFunction(configHome: string): string {
  return join(configHome, 'fish', 'functions', 'ttheme.fish')
}

export function fishText(): string {
  return [
    `# ${MANAGED}`,
    "function ttheme --description 'Run ttheme through zsh'",
    `    ${THROUGH_ZSH} $argv`,
    'end',
    '',
  ].join('\n')
}

export function ownsFish(content: string): boolean {
  return content.startsWith(`# ${MANAGED}\n`)
}
