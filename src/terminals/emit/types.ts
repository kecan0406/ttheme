import type { Theme } from '../../core/theme.ts'

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
  return [`# ${theme.name}${theme.subject ? ` — ${theme.subject}` : ''}`]
}
