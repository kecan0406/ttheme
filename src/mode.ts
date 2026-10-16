import { isLight } from './contrast.ts'
import type { Theme } from './theme.ts'

export type Mode = 'dark' | 'light'

export const MODES: readonly Mode[] = ['dark', 'light']

export type Setting = Mode | 'auto'

export const SETTINGS: readonly Setting[] = ['dark', 'light', 'auto']

export const modeOf = (colors: Pick<Theme, 'background' | 'foreground'>): Mode => (isLight(colors) ? 'light' : 'dark')

export const otherOf = (mode: Mode): Mode => (mode === 'dark' ? 'light' : 'dark')
