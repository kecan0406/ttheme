export const FORMATS = ['hex', 'rgb', 'oklch'] as const

export type SlotFormat = (typeof FORMATS)[number]

export interface SlotCheck {
  ok: boolean | null
  text: string
}

export interface SlotView {
  key: string
  name: string
  hex: string
  formats: Record<SlotFormat, string>
  lch: [string, string, string]
  hue: number
  edges: number[]
  x: number
  y: number
  along: number
  checks: SlotCheck[]
  use: string
  uses: number[]
  signature: boolean
  miss: boolean
}

export interface PictureLink {
  label: string
  url: string
}

export interface PictureArtist {
  name: string
  links: PictureLink[]
}

export interface PictureCredit {
  artists: PictureArtist[]
  page: PictureLink | null
}

export interface Picture {
  post: string
  href: string | null
  framing: string
  credit: PictureCredit | null
}

export interface ShareView {
  panes: string[]
  top: number
  bottom: number
  track: string
  faint: string
  slots: SlotView[]
}

export function planeRows(view: ShareView, slot: SlotView): string[] {
  const last = Math.max(1, slot.edges.length - 1)
  return slot.edges.map((edge, row) => {
    const l = view.top - (row / last) * (view.top - view.bottom)
    const stops = [0, 0.25, 0.5, 0.75, 1].map(
      (t) => `oklch(${l.toFixed(3)} ${(edge * t).toFixed(4)} ${slot.hue}) ${t * 100}%`,
    )
    return `linear-gradient(90deg, ${stops.join(', ')})`
  })
}
