import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Coloring } from './backdrop.ts'

export const BLOCK_BEGIN = '# ttheme begin'
export const BLOCK_END = '# ttheme end'
export const BLOCK = /# ttheme begin\n[\s\S]*?# ttheme end\n?/

export function upsertBlock(content: string, body: string): string {
  const block = `${BLOCK_BEGIN}\n${body}\n${BLOCK_END}\n`
  if (BLOCK.test(content)) {
    return content.replace(BLOCK, block)
  }
  if (content === '') {
    return block
  }
  return `${content.replace(/\n*$/, '\n')}\n${block}`
}

export function removeBlock(content: string): string {
  const out = content.replace(/\n?# ttheme begin\n[\s\S]*?# ttheme end(?=\n|$)/, '')
  if (out === content) {
    return content
  }
  return out.trim() === '' ? '' : out.replace(/\n*$/, '\n')
}

export function userSets(content: string, key: string): boolean {
  const outside = content.replace(BLOCK, '')
  return new RegExp(String.raw`^[ \t]*${key}(?:[ \t]*=|[ \t]+\S)`, 'm').test(outside)
}

export function zshrcBlock(tthemeDir: string): string {
  return `source ${tthemeDir}/ttheme.zsh`
}

const CONFIG_HEADER = '# ttheme settings — uncomment a line to change it; exported variables win over this file'

const CONFIG_SETTINGS = {
  TTHEME_TAB_PALETTE: {
    doc: '# new tabs: off keeps the configured terminal theme, seq rotates through the palettes (default off)',
    default: 'off',
  },
  TTHEME_ANNOUNCE: {
    doc: '# the palette notice under "Last login:": 1 shows it, 0 silences it (default 1)',
    default: '1',
  },
  TTHEME_FX: {
    doc: '# search hint animation: typewriter, decode or glitch (default typewriter)',
    default: 'typewriter',
  },
  TTHEME_SORT: {
    doc: '# series and palettes in ttheme and preview: abc sorts them by name, series keeps the order they were added (default abc)',
    default: 'abc',
  },
  TTHEME_MOUSE: {
    doc: '# clicks, the wheel and drags in preview, browse, the palette editor and find: on, or off to leave the mouse to the terminal, so a drag selects text again without a modifier (default on)',
    default: 'on',
  },
  TTHEME_BG_BLUR: {
    doc: '# soften the background pictures behind the text: a blur radius in screen pixels, 0 keeps them sharp — changing it draws every picture again (default 0)',
    default: '0',
  },
  TTHEME_BG_COLORS: {
    doc: '# the colors new background pictures are drawn in: tone tints a picture in one color of its palette, original keeps its own — preview switches each picture later (default tone)',
    default: 'tone',
  },
  TTHEME_WARP_FAST: {
    doc: '# Warp tab switches: on keeps Warp rereading its settings while it is in front with tabs of different palettes, so the tab you switch to shows its palette in about 0.2 s instead of 0.6 s — about 8% CPU meanwhile; off leaves it to Warp (default on)',
    default: 'on',
  },
  TTHEME_NAMES: {
    doc: "# character names in every language for searching palettes and find's search box, from aninames' weekly release: on downloads them (about 7 MB) and checks once a day in the background; off leaves them as they are (default on)",
    default: 'on',
  },
  TTHEME_MARKET_LOOKUP: {
    doc: '# the Markets tab in browse: on looks GitHub up by itself — the markets carrying the ttheme-market topic when the tab opens or you type, and the palettes of a repository you type or move onto; off waits for space (default on)',
    default: 'on',
  },
  TTHEME_FIND_RATING: {
    doc: '# the ratings find lists, any of safe, questionable and explicit, each booru read in its own rating vocabulary (default safe)',
    default: 'safe',
  },
  TTHEME_FIND_BLOCK: {
    doc: '# the posts find drops by tag: nudity, underwear, both, or none to keep them all (default "nudity underwear")',
    default: 'nudity underwear',
  },
  TTHEME_FIND_POSTS: {
    doc: '# what find lists first: all is every post of the character, cutouts are the transparent ones (default all)',
    default: 'all',
  },
  TTHEME_FIND_SOLO: {
    doc: '# on keeps the posts tagged solo, the character alone, by danbooru or zerochan; off lists every post (default on)',
    default: 'on',
  },
  TTHEME_FIND_CUTOUTS: {
    doc: '# the tags find calls a transparent cutout, per site as key=tag,tag pairs — e.g. "konachan=transparent,vector yande=transparent_png" (default the built-in tags)',
    default: '',
  },
  TTHEME_FIND_ORDER: {
    doc: '# the order find lists posts in: fit ranks each page by how well it makes a backdrop, newest or score (default fit)',
    default: 'fit',
  },
  TTHEME_FIND_SETS: {
    doc: '# runs of the same picture at the same size from one uploader: fold shows them as one tile, show lists each (default fold)',
    default: 'fold',
  },
  TTHEME_FIND_REMOVE_BG: {
    doc: '# an opaque picture tried on in find: on cuts the character out with macOS Vision, off leaves it as it is (default on)',
    default: 'on',
  },
  TTHEME_FIND_MIN_SCORE: {
    doc: '# the lowest score find lists: off, or a number such as 5, 10, 25, 50 or 100 — danbooru, konachan and yande.re filter by it, zerochan keeps no score (default off)',
    default: 'off',
  },
  TTHEME_FIND_MIN_SIZE: {
    doc: '# the shortest side a picture find lists must reach, in pixels: off, or a number such as 720, 1080, 1440, 1800 or 2560 (default off)',
    default: 'off',
  },
  TTHEME_FIND_SITES: {
    doc: '# the sites find mixes in its all tab: any of danbooru, konachan, yande.re and zerochan (default all four)',
    default: 'danbooru konachan yande.re zerochan',
  },
  TTHEME_FIND_HIDE: {
    doc: '# the kinds of picture find leaves out by tag: comic, monochrome, sketch, chibi, or none to keep them all (default none)',
    default: 'none',
  },
  TTHEME_FIND_HIDE_TAGS: {
    doc: '# more tags find leaves out, spaced — e.g. "cosplay multiple_girls" (default none)',
    default: '',
  },
  TTHEME_FIND_PNG: {
    doc: '# on lists PNG originals only — a zerochan post counts only where danbooru holds the same file (default off)',
    default: 'off',
  },
  TTHEME_FIND_HOSTS: {
    doc: '# send a find site somewhere else, as key=https://host pairs — e.g. "danbooru=https://danbooru.donmai.us" (default none)',
    default: '',
  },
} as const

export function settingDefault(name: string): string | undefined {
  return CONFIG_SETTINGS[name as keyof typeof CONFIG_SETTINGS]?.default
}

function settingLine(name: string, value: string): string {
  const line = `: \${${name}:=${value}}`
  return settingDefault(name) === value ? `# ${line}` : line
}

function settingPattern(name: string): RegExp {
  return new RegExp(String.raw`^#? ?: \$\{${name}[^\n]*$`, 'm')
}

function ensureSetting(content: string, name: keyof typeof CONFIG_SETTINGS): string {
  if (settingPattern(name).test(content)) {
    return content
  }
  const setting = CONFIG_SETTINGS[name]
  return `${content.replace(/\n*$/, '\n')}\n${setting.doc}\n${settingLine(name, setting.default)}\n`
}

export const SETTING_NAMES = Object.keys(CONFIG_SETTINGS)

export const BLUR_MOST = 8

export function settingValue(configHome: string, name: keyof typeof CONFIG_SETTINGS): string {
  let text = ''
  try {
    text = readFileSync(join(configHome, 'ttheme', 'config.zsh'), 'utf8')
  } catch {}
  const raw = new RegExp(String.raw`^: \$\{${name}:=([^}\n]*)\}`, 'm').exec(text)?.[1] ?? CONFIG_SETTINGS[name].default
  return raw.replace(/^(["'])(.*)\1$/, '$2')
}

export function blurOf(configHome: string): number {
  const value = Number(settingValue(configHome, 'TTHEME_BG_BLUR'))
  return Number.isFinite(value) ? Math.min(BLUR_MOST, Math.max(0, value)) : 0
}

export function coloringFor(configHome: string): Coloring {
  return settingValue(configHome, 'TTHEME_BG_COLORS') === 'original' ? 'original' : 'tone'
}

export function configTemplate(): string {
  const sections = Object.entries(CONFIG_SETTINGS).map(([name, s]) => `${s.doc}\n${settingLine(name, s.default)}`)
  return `${[CONFIG_HEADER, ...sections].join('\n\n')}\n`
}

export function withSetting(content: string, name: string, value: string): string {
  const line = settingLine(name, value)
  const pattern = settingPattern(name)
  if (pattern.test(content)) {
    return content.replace(pattern, line)
  }
  return `${content.replace(/\n*$/, '\n')}\n${line}\n`
}

export function configFile(content: string): string {
  if (content === '') {
    return configTemplate()
  }
  return (Object.keys(CONFIG_SETTINGS) as (keyof typeof CONFIG_SETTINGS)[]).reduce(ensureSetting, content)
}
