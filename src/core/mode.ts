import { isLight } from './contrast.ts'
import type { Theme } from './theme.ts'

export type Mode = 'dark' | 'light'

export const MODES: readonly Mode[] = ['light', 'dark']

export type Setting = Mode | 'auto'

export const SETTINGS: readonly Setting[] = ['auto', 'light', 'dark']

export const modeOf = (colors: Pick<Theme, 'background' | 'foreground'>): Mode => (isLight(colors) ? 'light' : 'dark')

export const otherOf = (mode: Mode): Mode => (mode === 'dark' ? 'light' : 'dark')
