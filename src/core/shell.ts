export const SHELLS = ['zsh', 'bash', 'fish'] as const

export type Shell = (typeof SHELLS)[number]
