export const INIT_TERMINALS = ['ghostty', 'kitty', 'alacritty', 'iterm2'] as const
export type InitTerminal = (typeof INIT_TERMINALS)[number]

const BEGIN = '# ttheme begin'
const END = '# ttheme end'
const BLOCK = /# ttheme begin\n[\s\S]*?# ttheme end\n?/

export function upsertBlock(content: string, body: string): string {
  const block = `${BEGIN}\n${body}\n${END}\n`
  if (BLOCK.test(content)) {
    return content.replace(BLOCK, block)
  }
  if (content === '') {
    return block
  }
  return `${content.replace(/\n*$/, '\n')}\n${block}`
}

export function detectTerminal(env: Record<string, string | undefined>): string {
  if (env.GHOSTTY_RESOURCES_DIR || env.TERM_PROGRAM === 'ghostty') {
    return 'ghostty'
  }
  if (env.KITTY_WINDOW_ID) {
    return 'kitty'
  }
  if (env.WEZTERM_PANE) {
    return 'wezterm'
  }
  if (env.ALACRITTY_WINDOW_ID) {
    return 'alacritty'
  }
  if (env.ITERM_SESSION_ID || env.TERM_PROGRAM === 'iTerm.app') {
    return 'iterm2'
  }
  if (env.TERM?.startsWith('foot')) {
    return 'foot'
  }
  return 'unknown'
}

export function ghosttyBlock(tthemeDir: string, palette: string | undefined): string {
  const lines = [`command = ${tthemeDir}/launch-tab.zsh`, 'shell-integration = zsh']
  if (palette) {
    lines.push(`theme = ${palette}`)
  }
  lines.push(`config-file = ${tthemeDir}/ttheme.conf`, `config-file = ?${tthemeDir}/backgrounds/shown.conf`)
  return lines.join('\n')
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
    doc: '# on keeps the danbooru posts tagged solo, the character alone; off lists every post (default on)',
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
  TTHEME_FIND_UNBLOCK: {
    doc: '# when a network blocks a booru by name, 1 sends find through a local proxy that splits the TLS handshake — find offers to turn it on (default 0)',
    default: '0',
  },
  TTHEME_FIND_HOSTS: {
    doc: '# send a find site somewhere else, as key=https://host pairs — e.g. "danbooru=https://safebooru.donmai.us" (default none)',
    default: '',
  },
} as const

function settingLine(name: string, value: string): string {
  const line = `: \${${name}:=${value}}`
  const setting = CONFIG_SETTINGS[name as keyof typeof CONFIG_SETTINGS]
  return setting?.default === value ? `# ${line}` : line
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

export function kittyBlock(palette: string | undefined): string {
  return palette ? `include themes/${palette}.conf` : ''
}

export function alacrittyBlock(themePath: string | undefined): string {
  return themePath ? `[general]\nimport = ["${themePath}"]` : ''
}

export function weztermSnippet(palette: string): string {
  return `config.color_scheme = "${palette}"`
}
