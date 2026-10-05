import { official } from '@/lib/catalog'
import { type Theme, toTheme } from '@/lib/themes'
import { SITES } from '../../src/booru.ts'
import { readCode, shareLink } from '../../src/own.ts'
import { marketOf, type SharedPicture, slugOf } from '../../src/theme.ts'

export interface Picture {
  post: string
  href: string | null
  framing: string
}

export interface Shared {
  code: string
  link: string
  theme: Theme
  pictures: Picture[]
}

function framing({ size, position, opacity }: SharedPicture): string {
  return [
    size === undefined ? null : size === 'fill' ? 'fill' : `${size}%`,
    position ?? null,
    opacity === undefined ? null : `${Math.round(opacity * 100)}% opacity`,
  ]
    .filter((part) => part !== null)
    .join(' · ')
}

function picture(shared: SharedPicture): Picture {
  const site = SITES.find((s) => s.key === shared.site)
  return {
    post: `${site?.name ?? shared.site} #${shared.id}`,
    href: site ? site.pageUrl(shared.id) : null,
    framing: framing(shared),
  }
}

export function readShared(code: string): Shared {
  const entry = readCode(code, official)
  const market = marketOf(entry.name) ?? null
  return {
    code,
    link: shareLink(code),
    theme: toTheme({ ...entry, name: market ? slugOf(entry.name) : entry.name }, market),
    pictures: (entry.pictures ?? []).map(picture),
  }
}
