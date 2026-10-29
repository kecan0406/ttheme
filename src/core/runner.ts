export const RUNNERS = ['npx', 'bunx'] as const

export type Runner = (typeof RUNNERS)[number]

export function runnerOf(agent: string | undefined): Runner {
  return agent?.startsWith('bun/') ? 'bunx' : 'npx'
}
