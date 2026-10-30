import { type Marketplace, shortName, type Theme, type WorkRef } from '@/lib/themes'

export interface Meta {
  title: string
  description: string
}

const TERMINALS =
  'Ghostty, iTerm2, WezTerm, kitty, Alacritty, Rio, Contour, Windows Terminal, Warp, Konsole and Terminal.app'

export function siteMeta(): Meta {
  return {
    title: 'ttheme — character color themes for your terminal',
    description: `Character color palettes for your terminal. Works in ${TERMINALS}.`,
  }
}

export function builderMeta(): Meta {
  return {
    title: 'builder — make a terminal palette of your own · ttheme',
    description:
      'Tune twenty terminal colors against the contrast checks, in dark and light, then take the palette as a .toml file, a share link or a marketplace of your own.',
  }
}

export function docsMeta(): Meta {
  return {
    title: 'docs — install, use and make terminal palettes · ttheme',
    description: 'How to install ttheme, use and pin palettes, and make palettes of your own.',
  }
}

export function docMeta(title: string, group: string, description: string): Meta {
  return {
    title: `${title} — ${group} · ttheme docs`,
    description,
  }
}

export function creditsMeta(): Meta {
  return {
    title: 'credits — where the pictures come from · ttheme',
    description: 'Where the key art and the character pictures on ttheme.dev come from: TMDB and AniList.',
  }
}

export function marketplacesMeta(): Meta {
  return {
    title: 'marketplace — built-in and community terminal themes · ttheme',
    description: 'The palettes built into ttheme and the marketplaces anyone publishes from a GitHub repository.',
  }
}

export function marketplaceMeta(marketplace: Marketplace | null): Meta {
  if (!marketplace)
    return {
      title: 'built-in marketplace — character terminal themes · ttheme',
      description:
        "The terminal color schemes that come with ttheme: one per character, each measured from the character's official art.",
    }

  return {
    title: `${marketplace.id} — terminal themes · ttheme`,
    description: `${marketplace.about} — color schemes for your terminal. Add it with ttheme marketplace add ${marketplace.add}.`,
  }
}

export function workMeta(work: WorkRef, palettes: readonly Theme[], marketplaces: number): Meta {
  const names = [...new Set(palettes.map((theme) => theme.name))]

  return {
    title: `${work.name} terminal themes · ttheme`,
    description: `${work.name}${work.native ? ` (${work.native})` : ''} color schemes for your terminal: ${some(names, 6)} — ${palettes.length} ${palettes.length === 1 ? 'palette' : 'palettes'} from ${marketplaces} ${marketplaces === 1 ? 'marketplace' : 'marketplaces'}.`,
  }
}

export function paletteMeta(theme: Theme): Meta {
  const { name, work, background, foreground } = theme

  return {
    title: `${name} terminal theme${work ? ` — ${work.name}` : ''} · ttheme`,
    description: `${name} — ${work ? `${work.name} ` : ''}color scheme for your terminal: ${background} background, ${foreground} text, 16 ANSI colors. Install with ttheme use ${shortName(theme.id)}.`,
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
