import { type SimpleIcon, siCreativecommons, siDeviantart, siX } from 'simple-icons'
import type { Theme } from '@/lib/themes'

export interface CastMember {
  name: string
  face: number
  scale: number
}

export const CAST: readonly CastMember[] = [
  { name: 'souryuu-asuka-langley', face: 930 / 756, scale: 1 },
  { name: 'ayanami-rei', face: 946 / 756, scale: 1 },
  { name: 'izumi-konata', face: 860 / 756, scale: 0.5 / 0.55 },
  { name: 'shinonome-nano', face: 1086 / 756, scale: 1 },
]

export interface StickerCredit {
  name: string
  who: string
  verb: string
  artist: string
  japanese: boolean
  site: string
  siteIcon: SimpleIcon
  post: string
  license: { brand: string; icon: SimpleIcon; terms: string; url: string } | null
  after: { work: string; artist: string; icon: SimpleIcon; site: string; url: string } | null
}

export const STICKER_CREDITS: readonly StickerCredit[] = [
  {
    name: 'souryuu-asuka-langley',
    who: 'Souryuu Asuka Langley',
    verb: 'Art by',
    artist: 'kmym',
    japanese: false,
    site: 'X',
    siteIcon: siX,
    post: 'https://x.com/kmym97457689/status/2099432694958719085',
    license: null,
    after: null,
  },
  {
    name: 'ayanami-rei',
    who: 'Ayanami Rei',
    verb: 'Art by',
    artist: 'ADA☆',
    japanese: false,
    site: 'X',
    siteIcon: siX,
    post: 'https://x.com/HikawaHomura/status/1987474871451091180',
    license: null,
    after: null,
  },
  {
    name: 'izumi-konata',
    who: 'Izumi Konata',
    verb: 'Vector by',
    artist: 'lllP3lll',
    japanese: false,
    site: 'DeviantArt',
    siteIcon: siDeviantart,
    post: 'https://www.deviantart.com/lllp3lll/art/Konata-53704375',
    license: {
      brand: 'CC',
      icon: siCreativecommons,
      terms: 'BY-NC-SA 3.0',
      url: 'https://creativecommons.org/licenses/by-nc-sa/3.0/',
    },
    after: { work: "Comp H's Vol.3", artist: '堀口悠紀子', icon: siX, site: 'X', url: 'https://x.com/dochibibi' },
  },
  {
    name: 'shinonome-nano',
    who: 'Shinonome Nano',
    verb: 'Art by',
    artist: 'あらゐけいいち',
    japanese: true,
    site: 'X',
    siteIcon: siX,
    post: 'https://x.com/himaraya/status/1829803478711177647',
    license: null,
    after: null,
  },
]

export const OTHER_ART = 'other-art'

export const STICKER_SIZES = '(min-width: 1180px) min(148.4vh, 104.4vw, 1679px), 199vw'

export function stickerSet(stickers: Record<string, string>, name: string): string {
  return `${stickers[name]} 1410w, ${stickers[`${name}-2x`]} 2820w`
}

export function castOf(themes: readonly Theme[]): Theme[] {
  return CAST.flatMap((member) => themes.find((theme) => theme.name === member.name) ?? [])
}

export function isCast(name: string): boolean {
  return CAST.some((member) => member.name === name)
}
