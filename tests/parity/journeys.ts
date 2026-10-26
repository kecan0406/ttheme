import type { Mode } from '../../src/core/mode.ts'
import type { Tab } from './model.ts'
import type { Capability } from './terms.ts'

export interface Want {
  want: string
  picture?: string
  opacity?: string
  at?: Tab
}

export interface LookOptions extends Want {
  mode?: Mode
  unpainted?: true
  repaints?: number
  text?: true | Capability
  wears?: boolean
  busy?: boolean
}

export interface Elsewhere {
  open(): Promise<Tab>
  type(tab: Tab, line: string): Promise<void>
  launch(tab: Tab, line: string, marker: string): Promise<void>
  focus(tab: Tab): Promise<void>
  leave(): void
  appear(mode: Mode): Promise<void>
  look(label: string, want: Want & { busy?: boolean }): Promise<void>
}

export interface Probe {
  open(): Promise<Tab>
  type(tab: Tab, line: string): Promise<void>
  launch(tab: Tab, line: string, marker?: string): Promise<void>
  keys(tab: Tab, ...keys: string[]): Promise<void>
  expect(tab: Tab, marker: string): Promise<void>
  back(tab: Tab): Promise<void>
  answer(tab: Tab, line: string, question: string, keys: readonly string[]): Promise<void>
  quit(tab: Tab): Promise<void>
  focus(tab: Tab): Promise<void>
  look(label: string, options: LookOptions): Promise<void>
  config(line: string): void
  pin(dir: string, palette: string): void
  pinHost(host: string, palette: string): void
  wire(terminal: 'ghostty'): Promise<Elsewhere>
  appear(mode: Mode): Promise<void>
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
      await p.look('open', { want: 'ttheme/konata', repaints: 0, text: true })
    },
  },
  {
    id: 'new-tab-seq',
    about: 'with new tabs rotating, a new tab opens on the next palette',
    async run(p) {
      p.config(': ${TTHEME_TAB_PALETTE:=seq}')
      await p.open()
      await p.look('open', { want: 'ttheme/kita', text: true })
    },
  },
  {
    id: 'use',
    about: 'ttheme use paints the tab whole and puts up the palette’s picture',
    async run(p) {
      const a = await p.open()
      await p.type(a, 'clear; ttheme use kita')
      await p.look('used', { want: 'ttheme/kita', text: true })
    },
  },
  {
    id: 'use-plain',
    about: 'a palette without a picture takes the picture down',
    async run(p) {
      const a = await p.open()
      await p.type(a, 'ttheme use miku')
      await p.look('used', { want: 'ttheme/miku' })
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
      await p.look('preview', { want: 'ttheme/konata', text: true, wears: false })
      await p.keys(a, 'shift-tab', 'k', 'i', 't', 'a')
      await p.look('browse', { want: 'ttheme/kita', text: true, wears: false })
      await p.keys(a, 'tab')
      await p.look('back', { want: 'ttheme/konata', text: true, wears: false })
      await p.quit(a)
      await p.look('closed', { want: 'ttheme/kita' })
    },
  },
  {
    id: 'default-here',
    about:
      'ttheme default in a tab that never painted: the tab shows what the terminal shows its new tabs, and knows it',
    async run(p) {
      const a = await p.open()
      await p.type(a, 'ttheme default miku')
      await p.look('here', { want: 'ttheme/miku', unpainted: true })
    },
  },
  {
    id: 'default-keeps',
    about: 'a tab painted with a palette that has no picture keeps it through ttheme default',
    async run(p) {
      const a = await p.open()
      await p.type(a, 'ttheme use rei')
      await p.type(a, 'ttheme default miku')
      await p.look('here', { want: 'ttheme/rei' })
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
      await p.look('painted', { want: 'ttheme/kita' })
      await p.focus(a)
      await p.look('unpainted', { want: 'ttheme/miku', unpainted: true })
      await p.open()
      await p.look('new', { want: 'ttheme/miku', unpainted: true })
    },
  },
  {
    id: 'off',
    about:
      'ttheme off gives this tab the terminal’s own colors, then every other tab — at once where it sits idle at its prompt, else at its next prompt or focus — and new tabs',
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
    id: 'off-seq',
    about: 'with new tabs rotating, a new tab opened after ttheme off opens in the terminal’s own colors too',
    async run(p) {
      p.config(': ${TTHEME_TAB_PALETTE:=seq}')
      const a = await p.open()
      await p.type(a, 'ttheme off')
      await p.open()
      await p.look('new', { want: 'own' })
    },
  },
  {
    id: 'off-behind',
    about: 'ttheme off typed in a tab that is not in front takes its picture off too',
    async run(p) {
      const a = await p.open()
      const b = await p.open()
      await p.type(b, 'ttheme use kita')
      await p.focus(a)
      await p.type(b, 'ttheme off')
      await p.focus(b)
      await p.look('back', { want: 'own' })
    },
  },
  {
    id: 'off-idle',
    about:
      'ttheme off reaches a tab idle at its prompt behind the one that ran it at once, before it comes to the front',
    async run(p) {
      const a = await p.open()
      await p.type(a, 'ttheme use kita')
      const b = await p.open()
      await p.type(b, 'ttheme off')
      await p.look('behind', { want: 'own', at: a })
    },
  },
  {
    id: 'off-busy',
    about: 'ttheme off typed in another tab takes the colors off a tab running a program once it comes to the front',
    async run(p) {
      const a = await p.open()
      await p.type(a, 'ttheme use kita')
      await p.launch(a, BUSY, 'busy>')
      const b = await p.open()
      await p.type(b, 'ttheme off')
      await p.focus(a)
      await p.look('busy', { want: 'own', busy: true })
    },
  },
  {
    id: 'off-pin',
    about: 'while ttheme is off, a pinned directory and a pinned host leave the tab in the terminal’s own colors',
    async run(p) {
      p.pin('work', 'ttheme/kita')
      p.pinHost('tusa', 'ttheme/kita')
      const a = await p.open()
      await p.type(a, 'ttheme off')
      await p.type(a, 'cd ~/work')
      await p.look('dir', { want: 'own' })
      await p.type(a, 'cd ~')
      await p.launch(a, 'ssh tusa', 'remote>')
      await p.look('host', { want: 'own', busy: true })
      await p.keys(a, 'q')
      await p.back(a)
      await p.look('back', { want: 'own' })
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
      await p.look('here', { want: 'ttheme/konata' })
      await p.focus(a)
      await p.look('other', { want: 'ttheme/konata', unpainted: true })
      await p.open()
      await p.look('new', { want: 'ttheme/konata', unpainted: true })
    },
  },
  {
    id: 'on-pin',
    about: 'ttheme on in a pinned directory wears the pin and not the default, and leaving the pin wears the default',
    async run(p) {
      p.pin('work', 'ttheme/kita')
      const a = await p.open()
      await p.type(a, 'cd ~/work')
      await p.type(a, 'ttheme off')
      await p.type(a, 'ttheme on')
      await p.look('in', { want: 'ttheme/kita' })
      await p.type(a, 'cd ~')
      await p.look('out', { want: 'ttheme/konata' })
    },
  },
  {
    id: 'on-pin-plain',
    about:
      'ttheme on in a directory pinned to a palette without a picture wears the pin with no picture, as a tab that never went off does',
    async run(p) {
      p.pin('work', 'ttheme/miku')
      const a = await p.open()
      await p.type(a, 'ttheme off')
      await p.type(a, 'cd ~/work')
      await p.type(a, 'ttheme on')
      await p.look('in', { want: 'ttheme/miku' })
    },
  },
  {
    id: 'on-pin-other',
    about:
      'a tab in a pinned directory that went off with ttheme off wears the pin again, not the default, once ttheme on reaches it',
    async run(p) {
      p.pin('work', 'ttheme/kita')
      const a = await p.open()
      const b = await p.open()
      await p.type(b, 'cd ~/work')
      await p.focus(a)
      await p.type(a, 'ttheme off')
      await p.focus(b)
      await p.look('off', { want: 'own' })
      await p.focus(a)
      await p.type(a, 'ttheme on')
      await p.focus(b)
      await p.look('on', { want: 'ttheme/kita' })
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
      await p.look('a', { want: 'ttheme/kita' })
      await p.focus(b)
      await p.look('b', { want: 'ttheme/konata' })
    },
  },
  {
    id: 'focus-busy',
    about: 'the picture follows the tab in front while a program that takes focus reports runs in it',
    async run(p) {
      p.pin('work', 'ttheme/kita')
      const a = await p.open()
      await p.type(a, 'cd ~/work')
      await p.launch(a, BUSY, 'busy>')
      const b = await p.open()
      await p.focus(a)
      await p.look('busy', { want: 'ttheme/kita', busy: true })
      await p.focus(b)
      await p.look('back', { want: 'ttheme/konata', unpainted: true })
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
      await p.look('front', { want: 'ttheme/konata', unpainted: true })
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
      await p.look('after', { want: 'ttheme/miku' })
    },
  },
  {
    id: 'default-after-reset',
    about:
      'a tab painted with the default palette keeps all of it when another tab changes the default, after a program reset colors the tab could not tell from the default’s',
    async run(p) {
      const a = await p.open()
      await p.type(a, 'ttheme use konata')
      await p.type(a, "print -n '\\e]112\\e\\\\\\e]111\\e\\\\'")
      const b = await p.open()
      await p.type(b, 'ttheme default rei')
      await p.focus(a)
      await p.look('kept', { want: 'ttheme/konata' })
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
      await p.look('after', { want: 'ttheme/kita', text: true })
    },
  },
  {
    id: 'preview-hover',
    about: 'preview repaints the tab as the cursor moves, and esc puts everything back',
    async run(p) {
      const a = await p.open()
      await p.launch(a, 'ttheme')
      await p.keys(a, 'k', 'i', 't', 'a')
      await p.look('hover', { want: 'ttheme/kita', text: true, wears: false })
      await p.quit(a)
      await p.look('back', { want: 'ttheme/konata', unpainted: true })
    },
  },
  {
    id: 'preview-esc',
    about: 'a tab that never painted still follows the default after preview opened in it and esc closed it',
    async run(p) {
      const a = await p.open()
      await p.launch(a, 'ttheme')
      await p.keys(a, 'k', 'i', 't', 'a')
      await p.quit(a)
      const b = await p.open()
      await p.type(b, 'ttheme default rei')
      await p.focus(a)
      await p.look('followed', { want: 'ttheme/rei', unpainted: true })
    },
  },
  {
    id: 'preview-default-same',
    about:
      'a tab that never painted still follows the default after preview’s Default picks the palette it already shows, hovers or not',
    async run(p) {
      const a = await p.open()
      await p.launch(a, 'ttheme')
      await p.keys(a, 'k', 'i', 't', 'a', 'ctrl-u', 'k', 'o', 'n', 'a', 't', 'a', 'enter', 'enter')
      await p.back(a)
      const b = await p.open()
      await p.type(b, 'ttheme default rei')
      await p.focus(a)
      await p.look('followed', { want: 'ttheme/rei', unpainted: true })
    },
  },
  {
    id: 'preview-tab',
    about: 'enter in preview asks where to keep the palette, and This tab keeps it for this tab',
    async run(p) {
      const a = await p.open()
      await p.launch(a, 'ttheme')
      await p.keys(a, 'k', 'i', 't', 'a', 'enter')
      await p.look('pick', { want: 'ttheme/kita', text: true, wears: false })
      await p.keys(a, 'right', 'enter')
      await p.back(a)
      await p.look('kept', { want: 'ttheme/kita' })
    },
  },
  {
    id: 'preview-tab-same',
    about:
      'This tab keeps for this tab the palette a tab that never painted already shows, so a new default leaves it, as ttheme use would',
    async run(p) {
      const a = await p.open()
      await p.launch(a, 'ttheme')
      await p.keys(a, 'k', 'o', 'n', 'a', 't', 'a', 'enter')
      await p.keys(a, 'right', 'enter')
      await p.back(a)
      await p.type(a, 'ttheme default miku')
      await p.look('kept', { want: 'ttheme/konata' })
    },
  },
  {
    id: 'preview-default',
    about: 'preview’s Default makes the palette the one new tabs open with',
    async run(p) {
      const a = await p.open()
      await p.launch(a, 'ttheme')
      await p.keys(a, 'm', 'i', 'k', 'u', 'enter', 'enter')
      await p.back(a)
      await p.look('here', { want: 'ttheme/miku' })
      await p.open()
      await p.look('new', { want: 'ttheme/miku', unpainted: true })
    },
  },
  {
    id: 'preview-tune',
    about:
      'right in preview opens the palette and its picture’s tuning beside the list, and esc leaves it all as it was',
    async run(p) {
      const a = await p.open()
      await p.launch(a, 'ttheme')
      await p.keys(a, 'k', 'i', 't', 'a', 'right')
      await p.expect(a, 'Palette')
      await p.look('tune', { want: 'ttheme/kita', text: 'pictures', wears: false })
      await p.quit(a)
      await p.look('back', { want: 'ttheme/konata', unpainted: true })
    },
  },
  {
    id: 'preview-config',
    about: 'alt-c in preview opens the settings panel',
    async run(p) {
      const a = await p.open()
      await p.launch(a, 'ttheme')
      await p.keys(a, 'alt-c')
      await p.look('panel', { want: 'ttheme/konata', unpainted: true, text: true, wears: false })
      await p.quit(a)
      await p.look('back', { want: 'ttheme/konata', unpainted: true })
    },
  },
  {
    id: 'picture-drop',
    about: 'a picture dropped in one tab leaves every tab wearing that palette',
    async run(p) {
      const a = await p.open()
      await p.type(a, 'ttheme use kita')
      const b = await p.open()
      await p.launch(b, 'ttheme')
      await p.keys(b, 'k', 'i', 't', 'a', 'right')
      await p.expect(b, 'Palette')
      await p.keys(b, 'D', '1s')
      await p.quit(b)
      await p.look('here', { want: 'ttheme/konata', unpainted: true })
      await p.focus(a)
      await p.look('other', { want: 'ttheme/kita', picture: 'none' })
    },
  },
  {
    id: 'picture-tune',
    about: 'a picture tuned in one tab reaches every tab wearing that palette',
    async run(p) {
      const a = await p.open()
      await p.type(a, 'ttheme use kita')
      const b = await p.open()
      await p.launch(b, 'ttheme')
      await p.keys(b, 'k', 'i', 't', 'a', 'right')
      await p.expect(b, 'Palette')
      await p.keys(b, 'down', 'down', 'down', 'down', 'right', 'right', 'right', 's', '1s')
      await p.quit(b)
      await p.focus(a)
      await p.look('other', { want: 'ttheme/kita', opacity: '0.22' })
    },
  },
  {
    id: 'pin',
    about: 'cd into a pinned directory repaints the tab, cd out puts the palette it wore back',
    async run(p) {
      p.pin('work', 'ttheme/kita')
      const a = await p.open()
      await p.type(a, 'cd ~/work')
      await p.look('in', { want: 'ttheme/kita' })
      await p.type(a, 'cd ~')
      await p.look('out', { want: 'ttheme/konata', unpainted: true })
    },
  },
  {
    id: 'pin-default',
    about:
      'ttheme default typed in a directory pinned to the old default keeps the pin on the tab, and the tab knows it',
    async run(p) {
      p.pin('work', 'ttheme/konata')
      const a = await p.open()
      await p.type(a, 'cd ~/work')
      await p.type(a, 'ttheme default rei')
      await p.look('kept', { want: 'ttheme/konata' })
    },
  },
  {
    id: 'pin-preview',
    about:
      'a tab that never painted, pinning its directory from preview and then leaving it, follows the default again',
    async run(p) {
      const a = await p.open()
      await p.type(a, 'mkdir -p ~/work && cd ~/work')
      await p.launch(a, 'ttheme pin')
      await p.keys(a, 'k', 'i', 't', 'a', 'enter', 'enter')
      await p.back(a)
      await p.look('pinned', { want: 'ttheme/kita' })
      await p.type(a, 'cd ~')
      const b = await p.open()
      await p.type(b, 'ttheme default rei')
      await p.focus(a)
      await p.look('followed', { want: 'ttheme/rei', unpainted: true })
    },
  },
  {
    id: 'pin-reach',
    about: 'a pin set or moved in another tab reaches a tab already in its directory once it comes to the front',
    async run(p) {
      const a = await p.open()
      await p.type(a, 'mkdir -p ~/work && cd ~/work')
      const b = await p.open()
      p.pin('work', 'ttheme/kita')
      await p.focus(a)
      await p.look('pinned', { want: 'ttheme/kita' })
      await p.focus(b)
      p.pin('work', 'ttheme/miku')
      await p.focus(a)
      await p.look('moved', { want: 'ttheme/miku' })
    },
  },
  {
    id: 'ssh',
    about:
      'ssh to a pinned host repaints the tab while it runs, follows it to the front, and its prompt puts the palette back',
    async run(p) {
      p.pinHost('tusa', 'ttheme/kita')
      const a = await p.open()
      await p.launch(a, 'ssh tusa', 'remote>')
      await p.look('in', { want: 'ttheme/kita', busy: true })
      await p.open()
      await p.focus(a)
      await p.look('front', { want: 'ttheme/kita', busy: true })
      await p.keys(a, 'q')
      await p.back(a)
      await p.look('out', { want: 'ttheme/konata', unpainted: true })
    },
  },
  {
    id: 'browse',
    about:
      'browse repaints the tab’s colors as the cursor moves over palettes, leaving its picture, and puts the tab back when it closes',
    async run(p) {
      const a = await p.open()
      await p.launch(a, 'ttheme', 'Browse')
      await p.keys(a, 'shift-tab')
      await p.expect(a, 'GitHub')
      await p.keys(a, 'k', 'i', 't', 'a')
      await p.look('hover', { want: 'ttheme/kita', picture: 'ttheme/konata', text: true, wears: false })
      await p.quit(a)
      await p.look('back', { want: 'ttheme/konata', unpainted: true })
    },
  },
  {
    id: 'browse-follow',
    about: 'a tab that never painted still follows the default after the bare ttheme closed from its Browse tab',
    async run(p) {
      const a = await p.open()
      await p.launch(a, 'ttheme', 'Browse')
      await p.keys(a, 'k', 'i', 't', 'a', 'shift-tab')
      await p.expect(a, 'GitHub')
      await p.keys(a, 'm', 'i', 'k', 'u')
      await p.quit(a)
      const b = await p.open()
      await p.type(b, 'ttheme default rei')
      await p.focus(a)
      await p.look('followed', { want: 'ttheme/rei', unpainted: true })
    },
  },
  {
    id: 'browse-reset',
    about:
      'a palette worn after browse repainted the tab survives a program that resets the tab’s colors, as one worn in a fresh tab does',
    async run(p) {
      const a = await p.open()
      await p.launch(a, 'ttheme', 'Browse')
      await p.keys(a, 'shift-tab')
      await p.expect(a, 'GitHub')
      await p.keys(a, 'k', 'i', 't', 'a')
      await p.quit(a)
      await p.type(a, 'ttheme use miku')
      await p.type(a, "print -n '\\e]112\\e\\\\\\e]111\\e\\\\'")
      await p.look('after', { want: 'ttheme/miku' })
    },
  },
  {
    id: 'hub-back',
    about:
      'the bare ttheme hands Browse the tab’s own palette whatever Preview shows, and Preview takes back the palette it showed, its picture with it, even when the switch left from a work’s row',
    async run(p) {
      const a = await p.open()
      await p.type(a, 'ttheme use kita')
      await p.launch(a, 'ttheme', 'Browse')
      await p.keys(a, 'k', 'o', 'n', 'up')
      await p.look('work', { want: 'ttheme/konata', wears: false })
      await p.keys(a, 'tab')
      await p.expect(a, 'GitHub')
      await p.look('browse', { want: 'ttheme/kita', wears: false })
      await p.keys(a, 'tab')
      await p.look('back', { want: 'ttheme/konata', wears: false })
      await p.keys(a, 'down')
      await p.look('row', { want: 'ttheme/konata', wears: false })
      await p.keys(a, 'bs', 'bs', 'bs', 'r', 'e', 'i')
      await p.look('moved', { want: 'ttheme/rei', wears: false })
      await p.quit(a)
      await p.look('closed', { want: 'ttheme/kita' })
    },
  },
  {
    id: 'browse-back',
    about:
      'a palette hovered in the bare ttheme’s Browse tab leaves the tab once Preview takes the screen back, so a tab that never painted still follows the default after esc',
    async run(p) {
      const a = await p.open()
      await p.launch(a, 'ttheme', 'Browse')
      await p.keys(a, 'shift-tab')
      await p.expect(a, 'GitHub')
      await p.keys(a, 'm', 'i', 'k', 'u')
      await p.keys(a, 'tab')
      await p.look('back', { want: 'ttheme/konata', wears: false })
      await p.quit(a)
      await p.look('closed', { want: 'ttheme/konata', unpainted: true })
    },
  },
  {
    id: 'unwired',
    about:
      'in a terminal init never wired, a tab opens in its own colors and ttheme use still paints it — asking to wire it first where only the wiring can paint — with no picture, which only the wiring shows',
    unwired: true,
    async run(p) {
      const a = await p.open()
      await p.look('open', { want: 'own' })
      await p.answer(a, 'clear; ttheme use kita', 'now?', ['y'])
      await p.look('used', { want: 'ttheme/kita', picture: 'none', text: true })
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
      await ghostty.look('ghostty', { want: 'ttheme/miku' })
    },
  },
  {
    id: 'reach-picture',
    about: 'a picture tuned in this terminal reaches Ghostty when both are wired',
    async run(p) {
      const ghostty = await p.wire('ghostty')
      const a = await p.open()
      await p.launch(a, 'ttheme')
      await p.keys(a, 'k', 'i', 't', 'a', 'right')
      await p.expect(a, 'Palette')
      await p.keys(a, 'down', 'down', 'down', 'down', 'right', 'right', 'right', 's', '1s')
      await p.quit(a)
      const g = await ghostty.open()
      await ghostty.type(g, 'ttheme use kita')
      await ghostty.look('ghostty', { want: 'ttheme/kita', opacity: '0.22' })
    },
  },
  {
    id: 'off-beside',
    about:
      'ttheme off in this terminal takes the colors and the picture off a Ghostty tab idle at its prompt in a window beside it at once, before it comes to the front',
    async run(p) {
      const ghostty = await p.wire('ghostty')
      const g = await ghostty.open()
      ghostty.leave()
      const a = await p.open()
      await p.type(a, 'ttheme off')
      await ghostty.look('ghostty', { want: 'own', at: g })
    },
  },
  {
    id: 'default-beside',
    about:
      'ttheme default in this terminal reaches a Ghostty tab that never painted, in a window beside it, colors and picture, before it comes to the front',
    async run(p) {
      const ghostty = await p.wire('ghostty')
      const g = await ghostty.open()
      ghostty.leave()
      const a = await p.open()
      await p.type(a, 'ttheme default kita')
      await Bun.sleep(1000)
      await ghostty.look('ghostty', { want: 'ttheme/kita', at: g })
    },
  },
  {
    id: 'off-reach-busy',
    about:
      'ttheme off in this terminal takes the colors and the picture off a Ghostty tab running a program once it comes to the front',
    async run(p) {
      const ghostty = await p.wire('ghostty')
      const g = await ghostty.open()
      await ghostty.launch(g, BUSY, 'busy>')
      const h = await ghostty.open()
      await ghostty.type(h, 'exit')
      await ghostty.focus(g)
      ghostty.leave()
      const a = await p.open()
      await p.type(a, 'ttheme off')
      await ghostty.focus(g)
      await Bun.sleep(1000)
      await ghostty.look('ghostty', { want: 'own', busy: true })
    },
  },
  {
    id: 'tone-reach',
    about: 'a palette tuned in another tab repaints a tab already wearing it once that tab comes to the front',
    async run(p) {
      const a = await p.open()
      await p.type(a, 'ttheme use kita')
      const b = await p.open()
      await p.launch(b, 'ttheme edit kita', 'Edit palette')
      await p.keys(b, 'enter', 'up', 'up', 'up', 'enter', 's')
      await p.back(b)
      await p.focus(a)
      await p.look('tuned', { want: 'ttheme/kita' })
    },
  },
  {
    id: 'mode',
    about: "light mode set in preview's settings reaches every tab, painted or not, and new tabs",
    async run(p) {
      const a = await p.open()
      const b = await p.open()
      await p.type(b, 'ttheme use kita')
      const c = await p.open()
      await p.type(c, 'ttheme use miku')
      await p.launch(c, 'ttheme')
      await p.keys(c, 'alt-c', 'left', 'enter', '1s')
      await p.quit(c)
      await p.look('here', { want: 'ttheme/miku' })
      await p.focus(b)
      await p.look('painted', { want: 'ttheme/kita' })
      await p.focus(a)
      await p.look('unpainted', { want: 'ttheme/konata', unpainted: true })
      await p.open()
      await p.look('new', { want: 'ttheme/konata', repaints: 0 })
    },
  },
  {
    id: 'auto',
    about:
      'with the mode on auto, the appearance a Ghostty tab hears at its prompt reaches every tab, painted or not, and new tabs, in every wired terminal',
    async run(p) {
      const ghostty = await p.wire('ghostty')
      const a = await p.open()
      const b = await p.open()
      await p.type(b, 'ttheme use kita')
      await p.launch(b, 'ttheme')
      await p.keys(b, 'alt-c', 'left', 'left', 'enter', '1s')
      await p.quit(b)
      const g = await ghostty.open()
      await ghostty.appear('light')
      await p.focus(b)
      await p.look('painted', { want: 'ttheme/kita', mode: 'light' })
      await p.focus(a)
      await p.look('unpainted', { want: 'ttheme/konata', unpainted: true })
      await p.open()
      await p.look('new', { want: 'ttheme/konata', repaints: 0 })
      await ghostty.look('ghostty', { want: 'ttheme/konata', at: g })
      await p.focus(b)
      await ghostty.appear('dark')
      await ghostty.appear('light')
      await p.look('back', { want: 'ttheme/kita', mode: 'light' })
    },
  },
  {
    id: 'auto-own',
    about:
      'with the mode on auto and no Ghostty wired, the appearance the terminal itself hears reaches every tab, painted or not, and new tabs',
    async run(p) {
      const a = await p.open()
      const b = await p.open()
      await p.type(b, 'ttheme use kita')
      await p.launch(b, 'ttheme')
      await p.keys(b, 'alt-c', 'left', 'left', 'enter', '1s')
      await p.quit(b)
      await p.appear('light')
      await p.focus(b)
      await p.look('painted', { want: 'ttheme/kita', mode: 'light' })
      await p.focus(a)
      await p.look('unpainted', { want: 'ttheme/konata', unpainted: true })
      await p.open()
      await p.look('new', { want: 'ttheme/konata', repaints: 0 })
      await p.focus(b)
      await p.appear('dark')
      await p.look('back', { want: 'ttheme/kita', mode: 'dark' })
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
      await p.look('added', { want: 'ttheme/asuka' })
    },
  },
]
