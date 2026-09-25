export const TERMINALS = ['ghostty', 'kitty', 'alacritty', 'wezterm', 'iterm2', 'windows-terminal', 'warp'] as const

export interface Flag {
  type: 'boolean' | 'string'
  short?: string
  multiple?: true
  value?: string
  choices?: readonly string[]
  about: string
}

export type Section = 'tab' | 'catalog' | 'own' | 'setup'

export interface VerbSpec {
  name: string
  args: string[]
  about: string
  section: Section
  shell?: true
  hidden?: true
  flags?: Record<string, Flag>
}

export const VERB_SPECS: VerbSpec[] = [
  {
    name: 'use',
    args: ['<palette>'],
    about: 'paint this tab — a unique prefix works: ttheme use ho',
    section: 'tab',
    shell: true,
  },
  {
    name: 'preview',
    args: [],
    about: 'browse live — focus repaints, enter keeps (this tab or default), esc restores, ? lists keys',
    section: 'tab',
    shell: true,
  },
  { name: 'next', args: [], about: 'advance this tab to the next palette', section: 'tab', shell: true },
  { name: 'default', args: ['<palette>'], about: 'make a palette the one new tabs open with', section: 'tab' },
  { name: 'on', args: [], about: 'wear the default palette in new tabs again', section: 'tab' },
  {
    name: 'off',
    args: [],
    about: "take the palette and picture off every tab — the terminal's own colors until `ttheme on`",
    section: 'tab',
  },
  {
    name: 'pin',
    args: [],
    about: 'pick a palette for this directory — cd into it repaints, cd out restores',
    section: 'tab',
    shell: true,
  },
  { name: 'unpin', args: [], about: 'drop the palette pinned to this directory', section: 'tab', shell: true },
  { name: 'config', args: [], about: 'edit settings in $EDITOR — they apply in new tabs', section: 'tab', shell: true },
  { name: 'browse', args: [], about: 'pick palettes from the catalog in a live picker', section: 'catalog' },
  {
    name: 'list',
    args: ['[query]'],
    about: 'show the catalog, marking what is installed',
    section: 'catalog',
    flags: { json: { type: 'boolean', about: 'print the matches as JSON: name, group, installed' } },
  },
  {
    name: 'add',
    args: ['<palette...>'],
    about: 'install palettes from the catalog, or from a share code: ttheme add tt1:…',
    section: 'catalog',
  },
  { name: 'remove', args: ['<palette...>'], about: 'uninstall palettes', section: 'catalog' },
  { name: 'update', args: [], about: 'refresh the catalog from the registry', section: 'catalog' },
  {
    name: 'new',
    args: ['<name>'],
    about: 'make a palette of your own, <you>/<name>, from another one — installed at once',
    section: 'own',
    flags: {
      from: { type: 'string', value: '<palette>', about: 'the palette to start from — the default one when left out' },
    },
  },
  {
    name: 'edit',
    args: ['<palette>'],
    about: 'change one of your palettes in $EDITOR — checked against the gate before it is kept',
    section: 'own',
  },
  {
    name: 'check',
    args: ['<palette>'],
    about: 'measure a palette against the contrast gate and suggest colors that pass',
    section: 'own',
    flags: { fix: { type: 'boolean', about: 'write the suggested colors into your palette' } },
  },
  {
    name: 'share',
    args: ['<palette>'],
    about: 'print a share code — ttheme add <code> installs it anywhere, pictures included',
    section: 'own',
  },
  {
    name: 'submit',
    args: ['<palette>'],
    about: 'offer one of your palettes to the catalog, through a GitHub issue',
    section: 'own',
  },
  {
    name: 'init',
    args: [],
    about: 'install the shell layer and wire your terminal configs',
    section: 'setup',
    flags: { yes: { type: 'boolean', short: 'y', about: 'accept every default without prompting' } },
  },
  {
    name: 'uninstall',
    args: [],
    about: 'take ttheme out of every terminal config and delete what it wrote',
    section: 'setup',
    flags: { yes: { type: 'boolean', short: 'y', about: 'remove without asking' } },
  },
  {
    name: 'build',
    args: [],
    about: 'emit dist/ for every terminal, plus the zsh palette table — from a checkout',
    section: 'setup',
    hidden: true,
    flags: {
      only: {
        type: 'string',
        multiple: true,
        value: '<terminal>',
        choices: TERMINALS,
        about: 'rebuild just this terminal — repeat it for more',
      },
    },
  },
  {
    name: 'find',
    args: ['<palette>'],
    about: 'pick a booru background for a palette — preview opens this on tab',
    section: 'setup',
    hidden: true,
  },
  {
    name: 'intake',
    args: ['<issue-body-file>', '<login>'],
    about: "turn a palette issue into a community palette file — the submission bot's step, from a checkout",
    section: 'setup',
    hidden: true,
  },
  {
    name: 'image',
    args: ['<palette>', '<action>'],
    about:
      'switch a palette between its saved backgrounds, remove the one shown, or pass on tuning — preview calls this',
    section: 'setup',
    hidden: true,
  },
]
