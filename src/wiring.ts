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

export function ghosttyBlock(tthemeDir: string, palette: string, tabPalette: 'seq' | 'off'): string {
  const lines = tabPalette === 'seq' ? [`command = ${tthemeDir}/launch-tab.zsh`, 'shell-integration = zsh'] : []
  lines.push(`theme = ${palette}`, `config-file = ${tthemeDir}/ttheme.conf`)
  return lines.join('\n')
}

export function zshrcBlock(tthemeDir: string, opts: { tabPalette: 'seq' | 'off'; announce: boolean }): string {
  const lines = []
  if (opts.tabPalette === 'off') {
    lines.push('export TTHEME_TAB_PALETTE=off')
  }
  if (!opts.announce) {
    lines.push('export TTHEME_ANNOUNCE=0')
  }
  lines.push(`source ${tthemeDir}/ttheme.zsh`)
  return lines.join('\n')
}

export function kittyBlock(palette: string): string {
  return `include themes/${palette}.conf`
}

export function alacrittyBlock(themePath: string): string {
  return `[general]\nimport = ["${themePath}"]`
}

export function weztermSnippet(palette: string): string {
  return `config.color_scheme = "${palette}"`
}
