export const INIT_TERMINALS = [
  'ghostty',
  'kitty',
  'alacritty',
  'wezterm',
  'iterm2',
  'windows-terminal',
  'warp',
] as const
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
  if (env.TERM_PROGRAM === 'WarpTerminal') {
    return 'warp'
  }
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
  if (env.TERM_PROGRAM === 'Apple_Terminal') {
    return 'terminal-app'
  }
  if (env.WT_SESSION && !env.TERM_PROGRAM) {
    return 'windows-terminal'
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

export function kittyBlock(palette: string | undefined, watcher: string): string {
  return [
    ...(palette ? [`include themes/${palette}.conf`] : []),
    `watcher ${watcher}`,
    'window_logo_scale 100',
    'window_logo_alpha 1',
  ].join('\n')
}

const TOML_GENERAL = /^[ \t]*\[general\][ \t]*(?:#.*)?$/m
const TOML_TABLE = /^[ \t]*\[/m
const TOML_IMPORT = /^[ \t]*import[ \t]*=/m
const TOML_GENERAL_KEY = /^[ \t]*general[ \t]*[.=]/m

function alacrittyBlock(themePath: string | undefined): string {
  return themePath ? `[general]\nimport = ["${themePath}"]` : ''
}

export function upsertAlacrittyImport(content: string, themePath: string | undefined): string | undefined {
  const outside = content.replace(BLOCK, '')
  const general = TOML_GENERAL.exec(outside)
  if (!general) {
    const first = outside.search(TOML_TABLE)
    const root = first < 0 ? outside : outside.slice(0, first)
    if (TOML_GENERAL_KEY.test(outside) || TOML_IMPORT.test(root)) {
      return undefined
    }
    return upsertBlock(content, alacrittyBlock(themePath))
  }
  const at = general.index + general[0].length
  const rest = outside.slice(at)
  const next = rest.search(TOML_TABLE)
  if (TOML_IMPORT.test(next < 0 ? rest : rest.slice(0, next))) {
    return undefined
  }
  const line = themePath ? `import = ["${themePath}"]\n` : ''
  return `${outside.slice(0, at)}\n${BEGIN}\n${line}${END}${rest}`
}

const LUA_BLOCK = /-- ttheme begin\n[\s\S]*?-- ttheme end\n?/
const LUA_RETURN = /^return config[ \t]*$/gm

export function weztermBlock(module: string): string {
  return `dofile(${JSON.stringify(module)})(config)`
}

export function upsertLuaBlock(content: string, body: string): string | undefined {
  const block = `-- ttheme begin\n${body}\n-- ttheme end\n`
  if (LUA_BLOCK.test(content)) {
    return content.replace(LUA_BLOCK, block)
  }
  if (content === '') {
    return `local wezterm = require 'wezterm'\nlocal config = wezterm.config_builder()\n\n${block}\nreturn config\n`
  }
  const last = [...content.matchAll(LUA_RETURN)].at(-1)
  if (last?.index === undefined) {
    return undefined
  }
  return `${content.slice(0, last.index)}${block}\n${content.slice(last.index)}`
}

const WARP_SECTION = '[appearance.themes]'

function warpSection(lines: string[]): [number, number] | undefined {
  const start = lines.findIndex((line) => line.trim() === WARP_SECTION)
  if (start < 0) {
    return undefined
  }
  const next = lines.findIndex((line, i) => i > start && line.trimStart().startsWith('['))
  return [start, next < 0 ? lines.length : next]
}

export function warpThemeOf(content: string): string | undefined {
  const lines = content.split('\n')
  const section = warpSection(lines)
  if (!section) {
    return undefined
  }
  const line = lines.slice(section[0] + 1, section[1]).find((l) => /^theme\s*=/.test(l))
  return line?.replace(/^theme\s*=\s*/, '').trim()
}

export function warpThemeValue(palette: string): string {
  return `{ custom = { name = "${palette}", path = "ttheme-${palette}.yaml" } }`
}

export function withWarpTheme(content: string, value: string | undefined): string {
  const lines = content.split('\n')
  const section = warpSection(lines)
  if (!section) {
    return value === undefined ? content : `${content.replace(/\n*$/, '\n')}\n${WARP_SECTION}\ntheme = ${value}\n`
  }
  const at = lines.findIndex((l, i) => i > section[0] && i < section[1] && /^theme\s*=/.test(l))
  if (at >= 0) {
    lines.splice(at, 1, ...(value === undefined ? [] : [`theme = ${value}`]))
  } else if (value !== undefined) {
    lines.splice(section[0] + 1, 0, `theme = ${value}`)
  }
  return lines.join('\n')
}
