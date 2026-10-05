import { type Hex, mix } from '../color.ts'

export const ROLES = {
  dim: ['2', '22'],
  bold: ['1', '22'],
  under: ['4', '24'],
  reverse: ['7', '27'],
  accent: ['36', '39'],
  pill: ['7;1;36', '22;27;39'],
  match: ['1;4;36', '22;24;39'],
  ok: ['32', '39'],
  warn: ['33', '39'],
  error: ['31', '39'],
} as const satisfies Record<string, readonly [string, string]>

export type Role = keyof typeof ROLES

export const SURFACES = { stage: 0.08, bar: 0.14, selection: 0.2, tab: 0.3, line: 0.45 } as const

export type Surface = keyof typeof SURFACES

export const MARKS = {
  gutter: '▌',
  current: '◆',
  signature: '✦',
  closed: '▸',
  opened: '▾',
  on: '●',
  off: '○',
  ok: '✓',
  miss: '✗',
  above: '↑',
  below: '↓',
  update: '⇡',
  auto: '↻',
  star: '★',
  link: '⧉',
  search: '⌕',
  linked: '⇠',
  contrast: '◐',
  swatch: '■',
  pictures: '▣',
  sep: '·',
  cut: '…',
} as const

export const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

function csi(params: string): string {
  return `\x1b[${params}m`
}

export function open(role: Role): string {
  return csi(ROLES[role][0])
}

export function close(role: Role): string {
  return csi(ROLES[role][1])
}

export const RESET = csi('0')
export const FG_RESET = csi('39')
export const BG_RESET = csi('49')
export const INK_RESET = csi('39;49')

export function slotFg(slot: number): string {
  return csi(String(slot < 8 ? 30 + slot : 82 + slot))
}

export function slotBg(slot: number): string {
  return csi(String(slot < 8 ? 40 + slot : 92 + slot))
}

export function indexed(fg: number, bg: number): string {
  return csi(`38;5;${fg};48;5;${bg}`)
}

function channels(hex: string): string {
  const h = hex.replace('#', '')
  return [h.slice(0, 2), h.slice(2, 4), h.slice(4, 6)].map((c) => Number.parseInt(c, 16)).join(';')
}

export function ansiFg(hex: string): string {
  return csi(`38;2;${channels(hex)}`)
}

export function ansiBg(hex: string): string {
  return csi(`48;2;${channels(hex)}`)
}

export function ansiBar(bg: string, fg: string): string {
  return csi(`48;2;${channels(bg)};38;2;${channels(fg)}`)
}

export function ansiSquares(colors: string[], after = FG_RESET): string {
  return `${colors.map((c) => `${ansiFg(c)}${MARKS.swatch}`).join(' ')}${after}`
}

export function surfaceOf(ground: Hex, ink: Hex, name: Surface): Hex {
  return mix(ground, ink, SURFACES[name])
}

export function closing(text: string): string {
  let weight = false
  let italic = false
  let under = false
  let reverse = false
  let fg = false
  let bg = false
  for (const chunk of text.split('\x1b[').slice(1)) {
    const params = /^([0-9;]*)m/.exec(chunk)?.[1]
    if (params === undefined) {
      continue
    }
    const codes = (params || '0').split(';').map(Number)
    for (let i = 0; i < codes.length; i++) {
      const code = codes[i] as number
      if (code === 0) {
        weight = italic = under = reverse = fg = bg = false
      } else if (code === 1 || code === 2) {
        weight = true
      } else if (code === 22) {
        weight = false
      } else if (code === 3 || code === 23) {
        italic = code === 3
      } else if (code === 4 || code === 24) {
        under = code === 4
      } else if (code === 7 || code === 27) {
        reverse = code === 7
      } else if (code === 38 || code === 48) {
        fg ||= code === 38
        bg ||= code === 48
        i += codes[i + 1] === 5 ? 2 : 4
      } else if (code === 39) {
        fg = false
      } else if (code === 49) {
        bg = false
      } else if ((code >= 30 && code <= 37) || (code >= 90 && code <= 97)) {
        fg = true
      } else if ((code >= 40 && code <= 47) || (code >= 100 && code <= 107)) {
        bg = true
      }
    }
  }
  const off = [weight && '22', italic && '23', under && '24', reverse && '27', fg && '39', bg && '49'].filter(Boolean)
  return off.length > 0 ? csi(off.join(';')) : ''
}

export interface Paint {
  color: boolean
  dim(text: string): string
  bold(text: string): string
  accent(text: string): string
  pill(text: string): string
  ok(text: string): string
  warn(text: string): string
  error(text: string): string
  fg(hex: Hex): string
  bg(hex: Hex): string
}

export function painter(color: boolean): Paint {
  const role = (name: Role) => (text: string) => (color ? `${open(name)}${text}${close(name)}` : text)
  return {
    color,
    dim: role('dim'),
    bold: role('bold'),
    accent: role('accent'),
    pill: role('pill'),
    ok: role('ok'),
    warn: role('warn'),
    error: role('error'),
    fg: (hex) => (color ? ansiFg(hex) : ''),
    bg: (hex) => (color ? ansiBg(hex) : ''),
  }
}
