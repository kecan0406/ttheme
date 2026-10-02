import type { Tab } from './model.ts'

export interface Want {
  want: string
  picture?: string
  opacity?: string
}

export interface LookOptions extends Want {
  unpainted?: true
  repaints?: number
  text?: boolean
  wears?: boolean
  busy?: boolean
}

export interface Elsewhere {
  open(): Promise<Tab>
  type(tab: Tab, line: string): Promise<void>
  look(label: string, want: Want): Promise<void>
}

export interface Probe {
  open(): Promise<Tab>
  type(tab: Tab, line: string): Promise<void>
  launch(tab: Tab, line: string, marker?: string): Promise<void>
  keys(tab: Tab, ...keys: string[]): Promise<void>
  expect(tab: Tab, marker: string): Promise<void>
  back(tab: Tab): Promise<void>
  quit(tab: Tab): Promise<void>
  focus(tab: Tab): Promise<void>
  look(label: string, options: LookOptions): Promise<void>
  config(line: string): void
  pin(dir: string, palette: string): void
  pinHost(host: string, palette: string): void
  wire(terminal: 'ghostty'): Promise<Elsewhere>
}

export interface Journey {
  id: string
  about: string
  unwired?: true
  run(p: Probe): Promise<void>
}

const BUSY = `zsh -fc 'stty raw -echo; printf "\\e[?1004hbusy>"; exec cat >/dev/null'`

export const JOURNEYS: Journey[] = [
  {
    id: 'new-tab',
    about: 'a new tab opens wearing the default palette and its picture, and knows what it wears',
    async run(p) {
      await p.open()
      await p.look('open', { want: 'konata', repaints: 0, text: true })
    },
  },
  {
    id: 'new-tab-seq',
    about: 'with new tabs rotating, a new tab opens on the next palette',
    async run(p) {
      p.config(': ${TTHEME_TAB_PALETTE:=seq}')
      await p.open()
      await p.look('open', { want: 'miku', text: true })
    },
  },
  {
    id: 'use',
    about: 'ttheme use paints the tab whole and puts up the palette’s picture',
    async run(p) {
      const a = await p.open()
      await p.type(a, 'clear; ttheme use kita')
      await p.look('used', { want: 'kita', text: true })
    },
  },
  {
    id: 'use-plain',
    about: 'a palette without a picture takes the picture down',
    async run(p) {
      const a = await p.open()
      await p.type(a, 'ttheme use miku')
      await p.look('used', { want: 'miku' })
    },
  },
  {
    id: 'next',
    about: 'ttheme next moves the tab along the rotation',
    async run(p) {
      const a = await p.open()
      await p.type(a, 'ttheme next')
      await p.look('next', { want: 'miku' })
    },
  },
  {
    id: 'hub',
    about:
      'the bare ttheme opens preview and browse as tabs: tab moves between them, each repaints the tab as its cursor moves, and esc puts the tab back',
    async run(p) {
      const a = await p.open()
      await p.type(a, 'ttheme use kita')
      await p.launch(a, 'ttheme', 'Browse')
      await p.keys(a, 'k', 'o', 'n')
      await p.look('preview', { want: 'konata', text: true, wears: false })
      await p.keys(a, 'shift-tab', 'k', 'i', 't', 'a')
      await p.look('browse', { want: 'kita', text: true, wears: false })
      await p.keys(a, 'tab')
      await p.look('back', { want: 'konata', text: true, wears: false })
      await p.quit(a)
      await p.look('closed', { want: 'kita' })
    },
  },
  {
    id: 'default-here',
    about:
      'ttheme default in a tab that never painted: the tab shows what the terminal shows its new tabs, and knows it',
    async run(p) {
      const a = await p.open()
      await p.type(a, 'ttheme default miku')
      await p.look('here', { want: 'miku', unpainted: true })
    },
  },
  {
    id: 'default-keeps',
    about: 'a tab painted with a palette that has no picture keeps it through ttheme default',
    async run(p) {
      const a = await p.open()
      await p.type(a, 'ttheme use rei')
      await p.type(a, 'ttheme default miku')
      await p.look('here', { want: 'rei' })
    },
  },
  {
    id: 'default',
    about: 'ttheme default reaches new tabs; a painted tab keeps its palette, and one that never painted follows it',
    async run(p) {
      const a = await p.open()
      const b = await p.open()
      await p.type(b, 'ttheme use kita')
      await p.type(b, 'ttheme default miku')
      await p.look('painted', { want: 'kita' })
      await p.focus(a)
      await p.look('unpainted', { want: 'miku', unpainted: true })
      await p.open()
      await p.look('new', { want: 'miku', unpainted: true })
    },
  },
  {
    id: 'off',
    about: 'ttheme off gives this tab the terminal’s own colors, then every other tab at its next focus, and new tabs',
    async run(p) {
      const a = await p.open()
      const b = await p.open()
      await p.type(b, 'ttheme use kita')
      await p.type(b, 'ttheme off')
      await p.look('here', { want: 'own' })
      await p.focus(a)
      await p.look('other', { want: 'own' })
      await p.open()
      await p.look('new', { want: 'own' })
    },
  },
  {
    id: 'on',
    about: 'ttheme on wears the default in this tab and new tabs, and a tab that went off takes it back at its focus',
    async run(p) {
      const a = await p.open()
      await p.type(a, 'ttheme off')
      const b = await p.open()
      await p.type(b, 'ttheme on')
      await p.look('here', { want: 'konata' })
      await p.focus(a)
      await p.look('other', { want: 'konata', unpainted: true })
      await p.open()
      await p.look('new', { want: 'konata', unpainted: true })
    },
  },
  {
    id: 'focus',
    about: 'the picture follows the tab in front',
    async run(p) {
      const a = await p.open()
      await p.type(a, 'ttheme use kita')
      const b = await p.open()
      await p.type(b, 'ttheme use konata')
      await p.focus(a)
      await p.look('a', { want: 'kita' })
      await p.focus(b)
      await p.look('b', { want: 'konata' })
    },
  },
  {
    id: 'focus-busy',
    about: 'the picture follows the tab in front while a program that takes focus reports runs in it',
    async run(p) {
      p.pin('work', 'kita')
      const a = await p.open()
      await p.type(a, 'cd ~/work')
      await p.launch(a, BUSY, 'busy>')
      const b = await p.open()
      await p.focus(a)
      await p.look('busy', { want: 'kita', busy: true })
      await p.focus(b)
      await p.look('back', { want: 'konata', unpainted: true })
    },
  },
  {
    id: 'prompt-behind',
    about: 'a command that ends in a tab behind leaves the picture of the tab in front alone',
    async run(p) {
      const a = await p.open()
      await p.type(a, 'ttheme use kita')
      await p.launch(a, "printf 'wait>'; sleep 2", 'wait>')
      await p.open()
      await p.back(a)
      await p.look('front', { want: 'konata', unpainted: true })
    },
  },
  {
    id: 'program-reset',
    about:
      'a program that resets the tab’s colors on its way out, as nvim does its cursor, leaves the tab in its palette at the next prompt',
    async run(p) {
      const a = await p.open()
      await p.type(a, 'ttheme use rei')
      await p.type(a, 'ttheme use miku')
      await p.type(a, "print -n '\\e]112\\e\\\\\\e]111\\e\\\\'")
      await p.look('after', { want: 'miku' })
    },
  },
  {
    id: 'editor-terminal',
    about:
      'a shell in an editor’s terminal leaves the tab and its picture alone, and says why ttheme use does nothing there',
    async run(p) {
      const a = await p.open()
      await p.type(a, 'ttheme use kita')
      await p.type(a, 'clear; NVIM=/tmp/nvim.sock zsh -ic "ttheme use konata"')
      await p.look('after', { want: 'kita', text: true })
    },
  },
  {
    id: 'preview-hover',
    about: 'preview repaints the tab as the cursor moves, and esc puts everything back',
    async run(p) {
      const a = await p.open()
      await p.launch(a, 'ttheme preview')
      await p.keys(a, 'k', 'i', 't', 'a')
      await p.look('hover', { want: 'kita', text: true, wears: false })
      await p.quit(a)
      await p.look('back', { want: 'konata', unpainted: true })
    },
  },
  {
    id: 'preview-tab',
    about: 'enter in preview asks where to keep the palette, and This tab keeps it for this tab',
    async run(p) {
      const a = await p.open()
      await p.launch(a, 'ttheme preview')
      await p.keys(a, 'k', 'i', 't', 'a', 'enter')
      await p.look('pick', { want: 'kita', text: true, wears: false })
      await p.keys(a, 'right', 'enter')
      await p.back(a)
      await p.look('kept', { want: 'kita' })
    },
  },
  {
    id: 'preview-default',
    about: 'preview’s Default makes the palette the one new tabs open with',
    async run(p) {
      const a = await p.open()
      await p.launch(a, 'ttheme preview')
      await p.keys(a, 'm', 'i', 'k', 'u', 'enter', 'enter')
      await p.back(a)
      await p.look('here', { want: 'miku' })
      await p.open()
      await p.look('new', { want: 'miku', unpainted: true })
    },
  },
  {
    id: 'preview-tune',
    about:
      'right in preview opens the palette and its picture’s tuning beside the list, and esc leaves it all as it was',
    async run(p) {
      const a = await p.open()
      await p.launch(a, 'ttheme preview')
      await p.keys(a, 'k', 'i', 't', 'a', 'right')
      await p.expect(a, 'Palette')
      await p.look('tune', { want: 'kita', text: true, wears: false })
      await p.quit(a)
      await p.look('back', { want: 'konata', unpainted: true })
    },
  },
  {
    id: 'preview-config',
    about: 'alt-c in preview opens the settings panel',
    async run(p) {
      const a = await p.open()
      await p.launch(a, 'ttheme preview')
      await p.keys(a, 'alt-c')
      await p.look('panel', { want: 'konata', unpainted: true, text: true, wears: false })
      await p.quit(a)
      await p.look('back', { want: 'konata', unpainted: true })
    },
  },
  {
    id: 'picture-drop',
    about: 'a picture dropped in one tab leaves every tab wearing that palette',
    async run(p) {
      const a = await p.open()
      await p.type(a, 'ttheme use kita')
      const b = await p.open()
      await p.launch(b, 'ttheme preview')
      await p.keys(b, 'k', 'i', 't', 'a', 'right')
      await p.expect(b, 'Palette')
      await p.keys(b, 'D', '1s')
      await p.quit(b)
      await p.look('here', { want: 'konata', unpainted: true })
      await p.focus(a)
      await p.look('other', { want: 'kita', picture: 'none' })
    },
  },
  {
    id: 'picture-tune',
    about: 'a picture tuned in one tab reaches every tab wearing that palette',
    async run(p) {
      const a = await p.open()
      await p.type(a, 'ttheme use kita')
      const b = await p.open()
      await p.launch(b, 'ttheme preview')
      await p.keys(b, 'k', 'i', 't', 'a', 'right')
      await p.expect(b, 'Palette')
      await p.keys(b, 'down', 'down', 'down', 'down', 'right', 'right', 'right', 's', '1s')
      await p.quit(b)
      await p.focus(a)
      await p.look('other', { want: 'kita', opacity: '0.23' })
    },
  },
  {
    id: 'pin',
    about: 'cd into a pinned directory repaints the tab, cd out puts the palette it wore back',
    async run(p) {
      p.pin('work', 'kita')
      const a = await p.open()
      await p.type(a, 'cd ~/work')
      await p.look('in', { want: 'kita' })
      await p.type(a, 'cd ~')
      await p.look('out', { want: 'konata', unpainted: true })
    },
  },
  {
    id: 'pin-reach',
    about: 'a pin set or moved in another tab reaches a tab already in its directory once it comes to the front',
    async run(p) {
      const a = await p.open()
      await p.type(a, 'mkdir -p ~/work && cd ~/work')
      const b = await p.open()
      p.pin('work', 'kita')
      await p.focus(a)
      await p.look('pinned', { want: 'kita' })
      await p.focus(b)
      p.pin('work', 'miku')
      await p.focus(a)
      await p.look('moved', { want: 'miku' })
    },
  },
  {
    id: 'ssh',
    about:
      'ssh to a pinned host repaints the tab while it runs, follows it to the front, and its prompt puts the palette back',
    async run(p) {
      p.pinHost('tusa', 'kita')
      const a = await p.open()
      await p.launch(a, 'ssh tusa', 'remote>')
      await p.look('in', { want: 'kita', busy: true })
      await p.open()
      await p.focus(a)
      await p.look('front', { want: 'kita', busy: true })
      await p.keys(a, 'q')
      await p.back(a)
      await p.look('out', { want: 'konata', unpainted: true })
    },
  },
  {
    id: 'browse',
    about:
      'browse repaints the tab’s colors as the cursor moves over palettes, leaving its picture, and puts the tab back when it closes',
    async run(p) {
      const a = await p.open()
      await p.launch(a, 'ttheme browse', 'Catalog')
      await p.keys(a, 'k', 'i', 't', 'a')
      await p.look('hover', { want: 'kita', picture: 'konata', text: true, wears: false })
      await p.quit(a)
      await p.look('back', { want: 'konata', unpainted: true })
    },
  },
  {
    id: 'unwired',
    about:
      'in a terminal init never wired, a tab opens in its own colors and ttheme use still paints it, with no picture, which only the wiring shows',
    unwired: true,
    async run(p) {
      const a = await p.open()
      await p.look('open', { want: 'own' })
      await p.type(a, 'clear; ttheme use kita')
      await p.look('used', { want: 'kita', picture: 'none', text: true })
    },
  },
  {
    id: 'reach',
    about: 'a default set in this terminal reaches Ghostty when both are wired',
    async run(p) {
      const ghostty = await p.wire('ghostty')
      const a = await p.open()
      await p.type(a, 'ttheme default miku')
      await ghostty.open()
      await ghostty.look('ghostty', { want: 'miku' })
    },
  },
  {
    id: 'reach-picture',
    about: 'a picture tuned in this terminal reaches Ghostty when both are wired',
    async run(p) {
      const ghostty = await p.wire('ghostty')
      const a = await p.open()
      await p.launch(a, 'ttheme preview')
      await p.keys(a, 'k', 'i', 't', 'a', 'right')
      await p.expect(a, 'Palette')
      await p.keys(a, 'down', 'down', 'down', 'down', 'right', 'right', 'right', 's', '1s')
      await p.quit(a)
      const g = await ghostty.open()
      await ghostty.type(g, 'ttheme use kita')
      await ghostty.look('ghostty', { want: 'kita', opacity: '0.23' })
    },
  },
  {
    id: 'palettes',
    about: 'a palette added in one tab can be worn in another',
    async run(p) {
      const a = await p.open()
      const b = await p.open()
      await p.type(b, 'ttheme add asuka')
      await p.focus(a)
      await p.type(a, 'ttheme use asuka')
      await p.look('added', { want: 'asuka' })
    },
  },
]
