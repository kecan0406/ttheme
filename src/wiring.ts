export const INIT_TERMINALS = ['ghostty', 'kitty', 'alacritty'] as const
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
  lines.push(`config-file = ${tthemeDir}/ttheme.conf`)
  if (palette) {
    lines.push(`config-file = ?${tthemeDir}/backgrounds/${palette}.conf`)
  }
  return lines.join('\n')
}

export function zshrcBlock(tthemeDir: string): string {
  return `source ${tthemeDir}/ttheme.zsh`
}

const CONFIG_HEADER = '# ttheme settings — exported variables win over this file'

const CONFIG_SETTINGS = {
  TTHEME_TAB_PALETTE: {
    doc: '# new tabs: seq rotates through the palettes, off keeps the configured terminal theme (default seq)',
    default: 'seq',
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
} as const

function settingLine(name: string, value: string): string {
  return `: \${${name}:=${value}}`
}

function settingPattern(name: string): RegExp {
  return new RegExp(String.raw`^#? ?: \$\{${name}[^\n]*$`, 'm')
}

function appendSetting(content: string, name: keyof typeof CONFIG_SETTINGS, value: string): string {
  return `${content.replace(/\n*$/, '\n')}\n${CONFIG_SETTINGS[name].doc}\n${settingLine(name, value)}\n`
}

function applySetting(content: string, name: keyof typeof CONFIG_SETTINGS, value: string): string {
  const pattern = settingPattern(name)
  if (pattern.test(content)) {
    return content.replace(pattern, () => settingLine(name, value))
  }
  return appendSetting(content, name, value)
}

function ensureSetting(content: string, name: keyof typeof CONFIG_SETTINGS): string {
  return settingPattern(name).test(content) ? content : appendSetting(content, name, CONFIG_SETTINGS[name].default)
}

export function configTemplate(): string {
  const sections = Object.entries(CONFIG_SETTINGS).map(([name, s]) => `${s.doc}\n${settingLine(name, s.default)}`)
  return `${[CONFIG_HEADER, ...sections].join('\n\n')}\n`
}

export function configFile(content: string, opts: { tabPalette: 'seq' | 'off'; announce: boolean }): string {
  const seeded = content === '' ? configTemplate() : content
  const tabbed = applySetting(seeded, 'TTHEME_TAB_PALETTE', opts.tabPalette)
  const announced = applySetting(tabbed, 'TTHEME_ANNOUNCE', opts.announce ? '1' : '0')
  return ensureSetting(ensureSetting(announced, 'TTHEME_FX'), 'TTHEME_SORT')
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
