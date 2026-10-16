import { isLight } from './contrast.ts'
import type { Theme } from './theme.ts'

export type Mode = 'dark' | 'light'

export const MODES: readonly Mode[] = ['dark', 'light']

export const modeOf = (colors: Pick<Theme, 'background' | 'foreground'>): Mode => (isLight(colors) ? 'light' : 'dark')

export const otherOf = (mode: Mode): Mode => (mode === 'dark' ? 'light' : 'dark')

export type Wear = Mode | 'own'

export const WEARS: readonly Wear[] = ['own', 'dark', 'light']
