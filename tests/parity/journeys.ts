import type { Tab } from './model.ts'

export interface LookOptions {
  text?: boolean
  wears?: boolean
  repaints?: boolean
  opacity?: boolean
}

export interface Elsewhere {
  open(): Promise<Tab>
  type(tab: Tab, line: string): Promise<void>
  look(label: string): Promise<void>
}

export interface Probe {
  open(): Promise<Tab>
  type(tab: Tab, line: string): Promise<void>
  launch(tab: Tab, line: string, marker?: string): Promise<void>
  keys(tab: Tab, ...keys: string[]): Promise<void>
  back(tab: Tab): Promise<void>
  quit(tab: Tab): Promise<void>
  focus(tab: Tab): Promise<void>
  look(label: string, options?: LookOptions): Promise<void>
  config(line: string): void
  pin(dir: string, palette: string): void
  wire(terminal: 'ghostty'): Promise<Elsewhere>
}

export interface Journey {
  id: string
  about: string
  unwired?: true
  run(p: Probe): Promise<void>
}

export const JOURNEYS: Journey[] = [
  {
    id: 'new-tab',
    about: 'a new tab opens wearing the default palette and its picture, and knows what it wears',
    async run(p) {
      await p.open()
      await p.look('open', { text: true, repaints: true })
    },
  },
  {
    id: 'new-tab-seq',
    about: 'with new tabs rotating, a new tab opens on the next palette',
    async run(p) {
      p.config(': ${TTHEME_TAB_PALETTE:=seq}')
      await p.open()
      await p.look('open', { text: true })
    },
  },
  {
    id: 'use',
    about: 'ttheme use paints the tab whole and puts up the palette’s picture',
    async run(p) {
      const a = await p.open()
      await p.type(a, 'clear; ttheme use kita')
      await p.look('used', { text: true })
    },
  },
  {
    id: 'use-plain',
    about: 'a palette without a picture takes the picture down',
    async run(p) {
      const a = await p.open()
      await p.type(a, 'ttheme use miku')
      await p.look('used')
    },
  },
  {
    id: 'next',
    about: 'ttheme next moves the tab along the rotation',
    async run(p) {
      const a = await p.open()
      await p.type(a, 'ttheme next')
      await p.look('next')
    },
  },
  {
    id: 'menu',
    about: 'the bare ttheme lists the palettes and marks the one the tab wears',
    async run(p) {
      const a = await p.open()
      await p.type(a, 'ttheme use kita')
      await p.type(a, 'clear; ttheme')
      await p.look('menu', { text: true })
    },
  },
  {
    id: 'default-here',
    about:
      'ttheme default in a tab that never painted: the tab shows what the terminal shows its new tabs, and knows it',
    async run(p) {
      const a = await p.open()
      await p.type(a, 'ttheme default miku')
      await p.look('here')
    },
  },
  {
    id: 'default-keeps',
    about: 'a tab painted with a palette that has no picture keeps it through ttheme default',
    async run(p) {
      const a = await p.open()
      await p.type(a, 'ttheme use rei')
      await p.type(a, 'ttheme default miku')
      await p.look('here')
    },
  },
  {
    id: 'default',
    about: 'ttheme default reaches new tabs; a painted tab keeps its palette, and an unpainted one follows or stays',
    async run(p) {
      const a = await p.open()
      const b = await p.open()
      await p.type(b, 'ttheme use kita')
      await p.type(b, 'ttheme default miku')
      await p.look('painted')
      await p.focus(a)
      await p.look('unpainted')
      await p.open()
      await p.look('new')
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
      await p.look('here')
      await p.focus(a)
      await p.look('other')
      await p.open()
      await p.look('new')
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
      await p.look('here')
      await p.focus(a)
      await p.look('other')
      await p.open()
      await p.look('new')
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
      await p.look('a')
      await p.focus(b)
      await p.look('b')
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
      await p.look('front')
    },
  },
  {
    id: 'preview-hover',
    about: 'preview repaints the tab as the cursor moves, and esc puts everything back',
    async run(p) {
      const a = await p.open()
      await p.launch(a, 'ttheme preview')
      await p.keys(a, 'k', 'i', 't', 'a')
      await p.look('hover', { text: true, wears: false })
      await p.quit(a)
      await p.look('back')
    },
  },
  {
    id: 'preview-tab',
    about: 'enter in preview keeps the palette for this tab',
    async run(p) {
      const a = await p.open()
      await p.launch(a, 'ttheme preview')
      await p.keys(a, 'k', 'i', 't', 'a', 'enter')
      await p.look('pick', { text: true, wears: false })
      await p.keys(a, 'enter')
      await p.back(a)
      await p.look('kept')
    },
  },
  {
    id: 'preview-default',
    about: 'preview’s Default makes the palette the one new tabs open with',
    async run(p) {
      const a = await p.open()
      await p.launch(a, 'ttheme preview')
      await p.keys(a, 'm', 'i', 'k', 'u', 'enter', 'right', 'enter')
      await p.back(a)
      await p.look('here')
      await p.open()
      await p.look('new')
    },
  },
  {
    id: 'preview-tune',
    about: 'tab in preview opens the picture’s tuning panel, and esc leaves it all as it was',
    async run(p) {
      const a = await p.open()
      await p.launch(a, 'ttheme preview')
      await p.keys(a, 'k', 'i', 't', 'a', 'tab')
      await p.look('tune', { text: true, wears: false })
      await p.quit(a)
      await p.look('back')
    },
  },
  {
    id: 'preview-config',
    about: 'alt-c in preview opens the settings panel',
    async run(p) {
      const a = await p.open()
      await p.launch(a, 'ttheme preview')
      await p.keys(a, 'alt-c')
      await p.look('panel', { text: true, wears: false })
      await p.quit(a)
      await p.look('back')
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
      await p.keys(b, 'k', 'i', 't', 'a', 'tab', 'D', '1s')
      await p.quit(b)
      await p.look('here')
      await p.focus(a)
      await p.look('other')
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
      await p.keys(b, 'k', 'i', 't', 'a', 'tab', 'down', 'down', 'right', 'right', 'right', 'enter')
      await p.quit(b)
      await p.focus(a)
      await p.look('other', { opacity: true })
    },
  },
  {
    id: 'pin',
    about: 'cd into a pinned directory repaints the tab, cd out puts the palette it wore back',
    async run(p) {
      p.pin('work', 'kita')
      const a = await p.open()
      await p.type(a, 'cd ~/work')
      await p.look('in')
      await p.type(a, 'cd ~')
      await p.look('out')
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
      await p.look('pinned')
      await p.focus(b)
      p.pin('work', 'miku')
      await p.focus(a)
      await p.look('moved')
    },
  },
  {
    id: 'browse',
    about: 'browse repaints the tab as the cursor moves over palettes, and puts the tab back when it closes',
    async run(p) {
      const a = await p.open()
      await p.launch(a, 'ttheme browse', 'Catalog')
      await p.keys(a, 'k', 'i', 't', 'a')
      await p.look('hover', { text: true, wears: false })
      await p.quit(a)
      await p.look('back')
    },
  },
  {
    id: 'unwired',
    about: 'in a terminal init never wired, a tab opens in its own colors and ttheme use still paints it',
    unwired: true,
    async run(p) {
      const a = await p.open()
      await p.look('open')
      await p.type(a, 'clear; ttheme use kita')
      await p.look('used', { text: true })
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
      await ghostty.look('ghostty')
    },
  },
  {
    id: 'reach-picture',
    about: 'a picture tuned in this terminal reaches Ghostty when both are wired',
    async run(p) {
      const ghostty = await p.wire('ghostty')
      const a = await p.open()
      await p.launch(a, 'ttheme preview')
      await p.keys(a, 'k', 'i', 't', 'a', 'tab', 'down', 'down', 'right', 'right', 'right', 'enter')
      await p.quit(a)
      const g = await ghostty.open()
      await ghostty.type(g, 'ttheme use kita')
      await ghostty.look('ghostty')
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
      await p.look('added')
    },
  },
]
