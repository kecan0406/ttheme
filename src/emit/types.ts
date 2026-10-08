import { shelfOf, type Theme } from '../theme.ts'

export interface Output {
  path: string
  content: string
}

export interface Emitter {
  id: string
  limits?: string
  emit?(theme: Theme): Output[]
  emitShared?(themes: Theme[]): Output[]
}

export function banner(theme: Theme): string[] {
  return [
    `# ${theme.name} — ${shelfOf(theme)}${theme.native ? ` (${theme.native})` : ''}`,
    `# ANSI: ${theme.ansiSource}`,
  ]
}
