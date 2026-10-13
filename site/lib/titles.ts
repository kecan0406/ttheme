import type { Marketplace, Theme } from '@/lib/themes'

export interface Meta {
  title: string
  description: string
}

const TERMINALS = 'Ghostty, iTerm2, WezTerm, kitty, Alacritty, Windows Terminal, Warp, Konsole and Terminal.app'

export function siteMeta(palettes: number): Meta {
  return {
    title: 'ttheme — character color themes for your terminal',
    description: `${palettes} character color palettes for your terminal. Works in ${TERMINALS}.`,
  }
}

export function sheetsMeta(palettes: number): Meta {
  return {
    title: `sheets — all ${palettes} palettes in a terminal · ttheme`,
    description: `Browse all ${palettes} ttheme palettes one at a time in a terminal window, with their twenty slots and contrast readings.`,
  }
}

export function marketplacesMeta(palettes: number): Meta {
  return {
    title: 'marketplace — official and community terminal themes · ttheme',
    description: `The ${palettes} official ttheme palettes and the marketplaces anyone publishes from a GitHub repository.`,
  }
}

export function marketplaceMeta(marketplace: Marketplace | null, palettes: number, catalogs: number): Meta {
  if (!marketplace)
    return {
      title: `official marketplace — ${palettes} character terminal themes · ttheme`,
      description: `${palettes} terminal color schemes that come with ttheme: one per character in ${catalogs} series, each measured from the character's official art.`,
    }
  return {
    title: `${marketplace.id} — ${palettes} terminal themes · ttheme`,
    description: `${marketplace.about} — ${palettes} color schemes in ${catalogs} catalogs. Add it with ttheme marketplace add ${marketplace.add}.`,
  }
}

export function paletteMeta({ id, name, catalog, background, foreground }: Theme): Meta {
  return {
    title: `${name} terminal theme${catalog ? ` — ${catalog}` : ''} · ttheme`,
    description: `${name} — ${catalog ? `${catalog} ` : ''}color scheme for your terminal: ${background} background, ${foreground} text, 16 ANSI colors. Install with ttheme use ${id}.`,
  }
}

function some(names: readonly string[], most: number): string {
  return names.length <= most
    ? names.join(', ')
    : `${names.slice(0, most - 1).join(', ')} and ${names.length - most + 1} more`
}

export function sharedMeta(palettes: readonly Theme[]): Meta {
  const [first] = palettes
  if (first && palettes.length === 1) {
    const { name, background, foreground } = first
    return {
      title: `${name} — shared terminal theme · ttheme`,
      description: `${name} — a color scheme someone shared: ${background} background, ${foreground} text, 16 ANSI colors. Add it with ttheme add and this link.`,
    }
  }
  const names = palettes.map((theme) => theme.name)
  return {
    title: `${some(names, 3)} — ${names.length} shared terminal themes · ttheme`,
    description: `${names.length} color schemes someone shared: ${some(names, 8)}. Add them all with ttheme add and this link.`,
  }
}
