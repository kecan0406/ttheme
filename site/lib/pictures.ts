import type { Picture } from '@/lib/view-types'
import { SITES } from '../../src/core/booru.ts'
import type { SharedPicture } from '../../src/core/theme.ts'

function framing({ size, position, strength }: SharedPicture): string {
  return [
    size === undefined ? null : size === 'fill' ? 'fill' : `${size}%`,
    position ?? null,
    strength === undefined ? null : `${strength}× opacity`,
  ]
    .filter((part) => part !== null)
    .join(' · ')
}

export function pictureOf(shared: SharedPicture): Picture {
  const site = SITES.find((s) => s.key === shared.site)

  return {
    post: `${site?.name ?? shared.site} #${shared.id}`,
    href: site ? site.pageUrl(shared.id) : null,
    framing: framing(shared),
    credit: null,
  }
}
