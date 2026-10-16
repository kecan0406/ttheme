import { execFileSync } from 'node:child_process'

export interface Host {
  platform: NodeJS.Platform
  env: Record<string, string | undefined>
  run(command: string, args: readonly string[]): string | undefined
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
