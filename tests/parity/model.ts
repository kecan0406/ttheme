import { Database } from 'bun:sqlite'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Terminal } from '@xterm/headless'
import {
  alacrittyColors,
  alacrittyFiles,
  fileStem,
  type GhosttyLoad,
  ghosttyLoad,
  hex,
  type ItermProfile,
  imageName,
  itermProfiles,
  kittyColors,
  kittyTheme,
  konsoleProfile,
  konsoleScheme,
  named,
  palettesOf,
  pictureOf,
  read,
  rgbSpec,
  specName,
  stamp,
  strengthOf,
  warpLook,
  weztermColors,
  wtColors,
} from './looks.ts'
import { ANSI, BEHAVIOR, type Behavior, type Colors, identity, OWN, type Term, WT_PROFILE } from './terms.ts'

export const COLS = 100
export const ROWS = 30
export const PROMPT = 'pt> '
const DUMP = '\x1b[5555~'

export interface Place {
  root: string
  home: string
  configHome: string
  stateHome: string
  dataHome: string
  cacheHome: string
  wtHome: string
  env: Record<string, string>
}

export function backgrounds(place: Place): string {
  return join(place.configHome, 'ttheme', 'backgrounds')
}

export function warpPaths(place: Place): { settings: string; themes: string; db: string } {
  return process.platform === 'darwin'
    ? {
        settings: join(place.home, '.warp', 'settings.toml'),
        themes: join(place.home, '.warp', 'themes'),
        db: join(place.home, 'Library', 'Application Support', 'dev.warp.Warp-Stable', 'warp.sqlite'),
      }
    : {
        settings: join(place.configHome, 'warp-terminal', 'settings.toml'),
        themes: join(place.dataHome, 'warp-terminal', 'themes'),
        db: join(place.stateHome, 'warp-terminal', 'warp.sqlite'),
      }
}

export const ITERM_SUITE = 'parity.iterm2'

interface Slot {
  base: string
  over?: string
  kept?: string
}

export class Tab {
  readonly xterm = new Terminal({ cols: COLS, rows: ROWS, scrollback: 200, allowProposedApi: true })
  readonly slots = new Map<string, Slot>()
  readonly vars = new Map<string, string>()
  readonly decoder = new TextDecoder()
  raw = ''
  state: 'text' | 'esc' | 'csi' | 'osc' | 'osc-esc' | 'str' | 'str-esc' = 'text'
  buf = ''
  focusing = false
  sync = false
  held = ''
  pending = 0
  profile = ''
  logo = 'none'
  logoOpacity = '-'
  readonly images = new Map<string, string>()
  readonly placements = new Map<string, { image: string; z: number }>()
  exited = false
  bgs: string[] = []
  tty = ''
  proc: ReturnType<typeof Bun.spawn> | undefined
  readonly n: number
  readonly session: string

  constructor(n: number, session: string, colors: Colors) {
    this.n = n
    this.session = session
    for (const [code, color] of colors) {
      this.slots.set(code, { base: color })
    }
  }

  prompts(): number {
    return this.raw.split(PROMPT).length - 1
  }

  write(data: string): void {
    if (this.exited) {
      return
    }
    this.proc?.terminal?.write(data)
    if (this.tty && process.platform !== 'darwin') {
      try {
        utimesSync(this.tty, new Date(), statSync(this.tty).mtime)
      } catch {}
    }
  }

  screen(home: string): string {
    const buffer = this.xterm.buffer.active
    const lines: string[] = []
    for (let y = 0; y < ROWS; y++) {
      lines.push((buffer.getLine(buffer.viewportY + y)?.translateToString(true) ?? '').replaceAll(home, '~'))
    }
    while (lines.length > 0 && lines.at(-1)?.trim() === '') {
      lines.pop()
    }
    return lines.join('\n')
  }
}

interface Opening {
  argv: string[]
  env: Record<string, string>
  colors: Colors
  profile?: string
}

interface Kind {
  delay?: number
  launch(app: App): void
  opening(app: App): Opening
  watched?(app: App): string[]
  changed?(app: App): void
  osc?(app: App, tab: Tab, code: number, data: string): void
  focused?(app: App, tab: Tab): void
  picture(app: App, tab: Tab): string
  opacity?(app: App, tab: Tab): string
  opened?(app: App, tab: Tab): void
  closed?(): void
}

function login(app: App): string[] {
  return [app.place.env.SHELL ?? 'zsh', '-l']
}

function vars(app: App, tab: Tab, data: string): void {
  const set = /^SetUserVar=([^=]+)=(.*)$/.exec(data)
  if (!set?.[1]) {
    return
  }
  tab.vars.set(set[1], Buffer.from(set[2] ?? '', 'base64').toString('utf8'))
  if (set[1] === 'ttheme_shown') {
    app.kind.focused?.(app, tab)
  }
}

const ghostty = (): Kind => {
  let loaded: GhosttyLoad = { colors: OWN, picture: 'none', opacity: '-' }
  let seen = 0
  const reloads = (app: App) => join(app.place.home, '.parity', 'reloads')
  return {
    launch(app) {
      loaded = ghosttyLoad(app.place.configHome)
      seen = read(reloads(app)).split('\n').filter(Boolean).length
    },
    opening(app) {
      return { argv: loaded.command ? [loaded.command] : login(app), env: {}, colors: loaded.colors }
    },
    watched: (app) => [reloads(app)],
    changed(app) {
      const count = read(reloads(app)).split('\n').filter(Boolean).length
      if (count === seen) {
        return
      }
      seen = count
      loaded = ghosttyLoad(app.place.configHome)
      for (const tab of app.tabs) {
        app.rebase(tab, loaded.colors)
      }
      app.log('reload')
    },
    picture: () => loaded.picture,
    opacity: () => loaded.opacity,
  }
}

const iterm2 = (): Kind => {
  let profiles = new Map<string, ItermProfile>()
  let fallback = 'own'
  const cards = new WeakMap<Tab, ItermProfile>()
  const wear = (app: App, tab: Tab, guid: string) => {
    const card = profiles.get(guid)
    tab.profile = guid
    if (card) {
      cards.set(tab, card)
    } else {
      cards.delete(tab)
    }
    for (const [code, slot] of tab.slots) {
      slot.base = (card?.colors ?? OWN).get(code) ?? slot.base
      delete slot.over
      delete slot.kept
    }
    app.log(`profile ${card?.name ?? 'own'}`)
  }
  return {
    launch(app) {
      profiles = itermProfiles(app.place.home)
      fallback = read(join(app.place.home, '.parity', 'defaults', ITERM_SUITE, 'Default Bookmark Guid')).trim() || 'own'
    },
    opening(app) {
      const card = profiles.get(fallback)
      return {
        argv: login(app),
        env: { ITERM_PROFILE: card?.name ?? 'Default' },
        colors: card?.colors ?? OWN,
        profile: fallback,
      }
    },
    opened(_, tab) {
      const card = profiles.get(tab.profile)
      if (card) {
        cards.set(tab, card)
      }
    },
    watched: (app) => [
      join(app.place.home, 'Library', 'Application Support', 'iTerm2', 'DynamicProfiles', 'ttheme.json'),
    ],
    changed(app) {
      profiles = itermProfiles(app.place.home)
      for (const tab of app.tabs) {
        const card = profiles.get(tab.profile)
        if (card) {
          cards.set(tab, card)
          app.rebase(tab, card.colors)
        }
      }
    },
    osc(app, tab, code, data) {
      if (code !== 1337) {
        return
      }
      if (data.startsWith('SetProfile=')) {
        const name = data.slice('SetProfile='.length)
        const guid = name ? [...profiles.values()].find((p) => p.name === name)?.guid : fallback
        if (guid) {
          wear(app, tab, guid)
        }
      } else if (data === 'ReportCellSize') {
        if (app.behavior.cells.includes('iterm')) {
          app.reply(tab, '\x1b]1337;ReportCellSize=17.0;8.0;1.0\x07')
        }
      } else {
        vars(app, tab, data)
      }
    },
    picture(_, tab) {
      const card = cards.get(tab)
      return card && card.image !== '' && card.blend > 0 ? imageName(card.image) : 'none'
    },
    opacity(_, tab) {
      const card = cards.get(tab)
      return card && card.image !== '' && card.blend > 0 ? String(card.blend) : '-'
    },
  }
}

const kitty = (): Kind => {
  let config = OWN
  let files: string[] = []
  let watching = false
  const conf = (app: App) => read(join(app.place.configHome, 'kitty', 'kitty.conf'))
  const include = (app: App) =>
    [...conf(app).matchAll(/^include (.+)$/gm)].map(([, file]) => join(app.place.configHome, 'kitty', file ?? ''))
  return {
    launch(app) {
      config = kittyColors(app.place.configHome)
      files = include(app)
      watching = /^watcher /m.test(conf(app))
    },
    opening: (app) => ({ argv: login(app), env: {}, colors: config }),
    watched: (app) => [join(app.place.configHome, 'kitty', 'kitty.conf'), ...files],
    changed(app) {
      config = kittyColors(app.place.configHome)
      files = include(app)
      watching = /^watcher /m.test(conf(app))
      for (const tab of app.tabs) {
        for (const [code, slot] of tab.slots) {
          slot.base = config.get(code) ?? slot.base
          delete slot.over
        }
        const worn = watching ? kittyTheme(app.place.configHome, tab.vars.get('ttheme_worn') ?? '') : undefined
        if (worn) {
          for (const [code, slot] of tab.slots) {
            slot.over = worn.get(code)
          }
        }
      }
      app.log('reload')
    },
    osc(app, tab, code, data) {
      if (code === 1337) {
        vars(app, tab, data)
      }
    },
    focused(app, tab) {
      if (watching) {
        tab.logo = pictureOf(backgrounds(app.place), tab.vars.get('ttheme_shown'))
        tab.logoOpacity = strengthOf(backgrounds(app.place), tab.vars.get('ttheme_shown'))
      }
    },
    picture: (_, tab) => tab.logo,
    opacity: (_, tab) => tab.logoOpacity,
  }
}

const alacritty = (): Kind => {
  let config = OWN
  return {
    launch(app) {
      config = alacrittyColors(app.place.configHome)
    },
    opening: (app) => ({ argv: login(app), env: {}, colors: config }),
    watched: (app) => alacrittyFiles(app.place.configHome),
    changed(app) {
      config = alacrittyColors(app.place.configHome)
      for (const tab of app.tabs) {
        app.rebase(tab, config)
      }
    },
    picture: () => 'none',
  }
}

const wezterm = (): Kind => {
  let config = OWN
  let wired = false
  const module = (app: App) =>
    read(join(app.place.configHome, 'wezterm', 'wezterm.lua')).includes('dofile(') ||
    read(join(app.place.home, '.wezterm.lua')).includes('dofile(')
  return {
    launch(app) {
      config = weztermColors(app.place.configHome)
      wired = module(app)
    },
    opening: (app) => ({ argv: login(app), env: {}, colors: config }),
    watched: (app) => [
      join(app.place.configHome, 'wezterm', 'wezterm.lua'),
      join(app.place.configHome, 'ttheme', 'wezterm.lua'),
    ],
    changed(app) {
      config = weztermColors(app.place.configHome)
      wired = module(app)
      for (const tab of app.tabs) {
        app.rebase(tab, config)
      }
    },
    osc(app, tab, code, data) {
      if (code === 1337) {
        vars(app, tab, data)
      }
    },
    picture(app, tab) {
      if (!wired) {
        return 'none'
      }
      const view = tab.vars.get('ttheme_view')
      if (view) {
        const image = view.split('|')[1] ?? ''
        return image ? imageName(image) : 'none'
      }
      return pictureOf(backgrounds(app.place), tab.vars.get('ttheme_shown'))
    },
    opacity(app, tab) {
      if (!wired) {
        return '-'
      }
      const view = tab.vars.get('ttheme_view')
      if (view) {
        const [, image = '', opacity = '1'] = view.split('|')
        return image ? String(Number(opacity)) : '-'
      }
      return strengthOf(backgrounds(app.place), tab.vars.get('ttheme_shown'))
    },
  }
}

const windowsTerminal = (): Kind => {
  let config = OWN
  return {
    delay: 250,
    launch(app) {
      config = wtColors(app.place.wtHome, WT_PROFILE)
    },
    opening: (app) => ({ argv: login(app), env: {}, colors: config }),
    watched: (app) => [join(app.place.wtHome, 'Microsoft', 'Windows Terminal', 'settings.json')],
    changed(app) {
      config = wtColors(app.place.wtHome, WT_PROFILE)
      for (const tab of app.tabs) {
        for (const [code, slot] of tab.slots) {
          slot.base = config.get(code) ?? slot.base
          delete slot.over
        }
      }
      app.log('reload')
    },
    picture: () => 'none',
  }
}

const warp = (): Kind => {
  let theme = warpLook('', '')
  let db: Database | undefined
  const paths = (app: App) => warpPaths(app.place)
  const front = (app: App, tab: Tab) => {
    db?.run('update windows set active_tab_index = ? where id = 1', [app.tabs.indexOf(tab)])
  }
  return {
    launch(app) {
      theme = warpLook(paths(app).settings, paths(app).themes)
      db = existsSync(paths(app).db) ? new Database(paths(app).db) : undefined
    },
    opening: (app) => ({ argv: login(app), env: {}, colors: theme.colors }),
    opened(app, tab) {
      const id = app.tabs.indexOf(tab) + 1
      db?.run('insert into tabs (id, window_id) values (?, 1)', [id])
      db?.run('insert into pane_nodes (id, tab_id, is_leaf) values (?, ?, 1)', [id, id])
      db?.run('insert into pane_leaves (pane_node_id, is_focused) values (?, 1)', [id])
      db?.run('insert into terminal_panes (id, uuid) values (?, ?)', [
        id,
        Buffer.from(tab.session.replaceAll('-', ''), 'hex'),
      ])
      front(app, tab)
    },
    watched: (app) => [paths(app).settings],
    changed(app) {
      theme = warpLook(paths(app).settings, paths(app).themes)
      for (const tab of app.tabs) {
        app.rebase(tab, theme.colors)
      }
      app.log(`theme ${named(theme.colors, palettesOf(app.place.home))}`)
    },
    focused(app, tab) {
      if (app.front === tab) {
        front(app, tab)
      }
    },
    closed() {
      db?.close()
    },
    picture: () => theme.picture,
    opacity: () => theme.opacity,
  }
}

const konsole = (): Kind => {
  let profile = 'Own.profile'
  const wanted = (app: App) => join(app.place.home, '.parity', 'konsole.default')
  const look = (app: App, file: string): Colors => {
    const found = konsoleProfile(app.place.dataHome, file)
    const colors = new Map(konsoleScheme(app.place.dataHome, found?.scheme ?? 'Own') ?? OWN)
    if (found?.cursor) {
      colors.set('12', found.cursor)
    }
    return colors
  }
  return {
    launch(app) {
      const rc = read(join(app.place.configHome, 'konsolerc'))
      profile = /^DefaultProfile=(.*)$/m.exec(rc)?.[1]?.trim() || 'Own.profile'
      writeFileSync(join(app.place.home, '.parity', 'konsole.running'), 'org.kde.konsole-4242\n')
      rmSync(wanted(app), { force: true })
    },
    opening: (app) => ({ argv: login(app), env: {}, colors: look(app, profile), profile }),
    watched: (app) => [wanted(app)],
    changed(app) {
      const name = read(wanted(app)).trim()
      if (!name) {
        return
      }
      const file = name.startsWith('ttheme · ')
        ? `ttheme-${fileStem(name.slice('ttheme · '.length))}.profile`
        : 'Own.profile'
      profile = file
      app.log(`default profile ${file}`)
    },
    osc(app, tab, code, data) {
      if (code !== 50) {
        return
      }
      const fields = new Map(
        data.split(';').flatMap((part): [string, string][] => {
          const at = part.indexOf('=')
          return at > 0 ? [[part.slice(0, at), part.slice(at + 1)]] : []
        }),
      )
      const scheme = konsoleScheme(app.place.dataHome, fields.get('ColorScheme') ?? '')
      if (!scheme) {
        return
      }
      const cursor = fields.get('UseCustomCursorColor') === 'true' ? hex(fields.get('customCursorColor')) : undefined
      for (const [code, slot] of tab.slots) {
        slot.base = code === '12' && cursor ? cursor : (scheme.get(code) ?? slot.base)
        if (!code.startsWith('4;')) {
          delete slot.over
        }
      }
      app.log(`scheme ${fields.get('ColorScheme')}`)
    },
    picture: () => 'none',
  }
}

const terminalApp = (): Kind => ({
  launch() {},
  opening: (app) => ({ argv: login(app), env: {}, colors: OWN }),
  picture: () => 'none',
})

const KINDS: Record<Term, () => Kind> = {
  ghostty,
  iterm2,
  kitty,
  alacritty,
  wezterm,
  'windows-terminal': windowsTerminal,
  warp,
  konsole,
  'terminal-app': terminalApp,
}

export interface Look {
  colors: string
  picture: string
  opacity: string
}

export class App {
  readonly behavior: Behavior
  readonly kind: Kind
  readonly tabs: Tab[] = []
  readonly journal: string[] = []
  front: Tab | undefined
  activity = performance.now()
  private later = 0
  private stamps = new Map<string, string>()
  readonly term: Term
  readonly place: Place

  constructor(term: Term, place: Place) {
    this.term = term
    this.place = place
    this.behavior = BEHAVIOR[term]
    this.kind = KINDS[term]()
    this.kind.launch(this)
    this.restamp()
  }

  log(line: string): void {
    this.journal.push(line)
    this.activity = performance.now()
  }

  private restamp(): void {
    for (const file of this.kind.watched?.(this) ?? []) {
      this.stamps.set(file, stamp(file))
    }
  }

  poll(): void {
    const files = this.kind.watched?.(this) ?? []
    if (!files.some((file) => stamp(file) !== (this.stamps.get(file) ?? '-'))) {
      return
    }
    this.restamp()
    this.activity = performance.now()
    const delay = this.kind.delay ?? 0
    if (delay === 0) {
      this.kind.changed?.(this)
      return
    }
    this.later++
    setTimeout(() => {
      this.kind.changed?.(this)
      this.later--
      this.activity = performance.now()
    }, delay)
  }

  rebase(tab: Tab, colors: Colors): void {
    for (const [code, slot] of tab.slots) {
      slot.base = colors.get(code) ?? slot.base
    }
  }

  shown(tab: Tab, code: string): string {
    const slot = tab.slots.get(code) as Slot
    return this.behavior.draws.includes(code) ? (slot.over ?? slot.base) : slot.base
  }

  private told(tab: Tab, code: string): string {
    const slot = tab.slots.get(code) as Slot
    return slot.over ?? slot.base
  }

  displayed(tab: Tab): Colors {
    return new Map([...tab.slots.keys()].map((code) => [code, this.shown(tab, code)]))
  }

  reply(tab: Tab, data: string): void {
    if (!this.behavior.syncQuery && tab.sync) {
      tab.held += data
      return
    }
    tab.write(data)
  }

  private color(tab: Tab, code: string, value: string): void {
    const slot = tab.slots.get(code)
    if (!slot) {
      return
    }
    if (value === '?') {
      if (this.behavior.answers.includes(code)) {
        this.reply(tab, `\x1b]${code};${rgbSpec(this.told(tab, code))}\x1b\\`)
      }
      return
    }
    const color = hex(value)
    if (!color) {
      return
    }
    if (slot.kept === undefined) {
      slot.kept = slot.base
    }
    slot.over = color
    this.painted(tab)
  }

  private reset(tab: Tab, codes: readonly string[]): void {
    if (!this.behavior.resets) {
      return
    }
    for (const code of codes) {
      const slot = tab.slots.get(code)
      if (!slot) {
        continue
      }
      if (this.term === 'iterm2' && slot.kept !== undefined) {
        slot.over = slot.kept
      } else {
        delete slot.over
      }
    }
    this.painted(tab)
  }

  private painted(tab: Tab): void {
    const bg = this.shown(tab, '11')
    if (tab.bgs.at(-1) !== bg) {
      tab.bgs.push(bg)
    }
  }

  private graphics(tab: Tab, data: string): void {
    if (!this.behavior.graphics) {
      return
    }
    const at = data.indexOf(';')
    const keys = new Map(
      (at < 0 ? data : data.slice(0, at)).split(',').map((pair): [string, string] => {
        const [k = '', v = ''] = pair.split('=')
        return [k, v]
      }),
    )
    const payload = at < 0 ? '' : data.slice(at + 1)
    const quiet = Number(keys.get('q') ?? '0')
    const id = keys.get('i') ?? '0'
    const action = keys.get('a') ?? 't'
    if (action === 'q') {
      if (quiet < 1) {
        this.reply(tab, `\x1b_Gi=${id};OK\x1b\\`)
      }
      return
    }
    if (action === 't' || action === 'T') {
      if (keys.get('t') === 'f') {
        tab.images.set(id, Buffer.from(payload, 'base64').toString('utf8'))
      } else if (!tab.images.has(id) || keys.has('i')) {
        tab.images.set(id, tab.images.get(id) ?? '')
      }
    }
    if (action === 'p' || action === 'T') {
      if (keys.has('P')) {
        if (quiet < 2) {
          this.reply(
            tab,
            this.behavior.relative
              ? `\x1b_Gi=${id},p=${keys.get('p') ?? '0'};ENOPARENT:parent image not found\x1b\\`
              : `\x1b_Gi=${id},p=${keys.get('p') ?? '0'};EINVAL:relative placements\x1b\\`,
          )
        }
        if (!this.behavior.relative || !tab.images.has(keys.get('P') ?? '')) {
          return
        }
      }
      tab.placements.set(`${id}:${keys.get('p') ?? '0'}`, { image: id, z: Number(keys.get('z') ?? '0') })
    }
    if (action === 'd') {
      const what = keys.get('d') ?? 'a'
      for (const [key, placed] of tab.placements) {
        const all = what === 'a' || what === 'A'
        const mine =
          (what === 'i' || what === 'I') && placed.image === id && (!keys.has('p') || key === `${id}:${keys.get('p')}`)
        if (all || mine) {
          tab.placements.delete(key)
        }
      }
      if (what === 'A') {
        tab.images.clear()
      } else if (what === 'I') {
        tab.images.delete(id)
      }
    }
  }

  layered(tab: Tab): string | undefined {
    if (tab.placements.size === 0) {
      return undefined
    }
    const pictures = [...tab.placements.values()]
      .filter((placed) => (tab.images.get(placed.image) ?? '') !== '')
      .sort((a, b) => b.z - a.z)
    const top = pictures[0]
    return top ? imageName(tab.images.get(top.image) ?? '') : 'none'
  }

  private csi(tab: Tab, body: string): void {
    const match = /^([?>=]?)([\d;:]*)([ -/]*)([@-~])$/.exec(body)
    if (!match) {
      return
    }
    const [, prefix = '', raw = '', middle = '', final = ''] = match
    const params = raw === '' ? [] : raw.split(';').map((p) => Number(p.split(':')[0] || 0))
    if (prefix === '' && final === 'n') {
      if (params[0] === 5) {
        this.reply(tab, '\x1b[0n')
      }
      return
    }
    if (prefix === '' && final === 't') {
      const cells = this.behavior.cells
      if (params[0] === 16 && cells.includes('pixels')) {
        this.reply(tab, '\x1b[6;17;8t')
      } else if (params[0] === 14 && cells.includes('points')) {
        this.reply(tab, `\x1b[4;${(ROWS * 17) / 2};${(COLS * 8) / 2}t`)
      } else if (params[0] === 18 && cells.includes('points')) {
        this.reply(tab, `\x1b[8;${ROWS};${COLS}t`)
      }
      return
    }
    if (prefix === '?' && middle === '$' && final === 'p') {
      const mode = params[0] ?? 0
      const on = (flag: boolean) => (flag ? 1 : 2)
      const state =
        mode === 2026 ? on(tab.sync) : mode === 1004 && this.behavior.focus !== 'none' ? on(tab.focusing) : 0
      this.reply(tab, `\x1b[?${mode};${state}$y`)
      return
    }
    if (prefix === '?' && (final === 'h' || final === 'l')) {
      const set = final === 'h'
      if (params.includes(1004)) {
        tab.focusing = set
        if (set && this.behavior.focus === 'answer') {
          this.reply(tab, this.front === tab ? '\x1b[I' : '\x1b[O')
        }
      }
      if (params.includes(2026)) {
        tab.sync = set
        if (!set && tab.held) {
          const held = tab.held
          tab.held = ''
          tab.write(held)
        }
      }
    }
  }

  private osc(tab: Tab, body: string): void {
    const at = body.indexOf(';')
    const code = Number(at < 0 ? body : body.slice(0, at))
    const data = at < 0 ? '' : body.slice(at + 1)
    if (code === 10 || code === 11 || code === 12 || code === 17) {
      this.color(tab, String(code), data)
    } else if (code === 4) {
      const parts = data.split(';')
      for (let i = 0; i + 1 < parts.length; i += 2) {
        this.color(tab, `4;${parts[i]}`, parts[i + 1] as string)
      }
    } else if (code === 104) {
      this.reset(tab, data ? data.split(';').map((i) => `4;${i}`) : ANSI)
    } else if (code === 110 || code === 111 || code === 112 || code === 117) {
      this.reset(tab, [String(code - 100)])
    } else if (code === 50 || code === 1337) {
      this.kind.osc?.(this, tab, code, data)
    }
  }

  private scan(tab: Tab, chunk: string): void {
    let state = tab.state
    let buf = tab.buf
    for (const ch of chunk) {
      switch (state) {
        case 'text':
          if (ch === '\x1b') {
            state = 'esc'
          }
          break
        case 'esc':
          buf = ''
          state =
            ch === '['
              ? 'csi'
              : ch === ']'
                ? 'osc'
                : ch === '_' || ch === 'P' || ch === 'X' || ch === '^'
                  ? 'str'
                  : 'text'
          if (state === 'str') {
            buf = ch
          }
          break
        case 'csi':
          buf += ch
          if (ch >= '@' && ch <= '~') {
            this.csi(tab, buf)
            state = 'text'
          }
          break
        case 'osc':
          if (ch === '\x07') {
            this.osc(tab, buf)
            state = 'text'
          } else if (ch === '\x1b') {
            state = 'osc-esc'
          } else {
            buf += ch
          }
          break
        case 'osc-esc':
          this.osc(tab, buf)
          state = ch === '\\' ? 'text' : 'esc'
          if (state === 'esc') {
            state = ch === '[' ? 'csi' : ch === ']' ? 'osc' : 'text'
            buf = ''
          }
          break
        case 'str':
          if (ch === '\x1b') {
            state = 'str-esc'
          } else {
            buf += ch
          }
          break
        case 'str-esc':
          if (ch === '\\') {
            if (buf.startsWith('_G')) {
              this.graphics(tab, buf.slice(2))
            }
            state = 'text'
          } else {
            buf += `\x1b${ch}`
            state = 'str'
          }
          break
      }
    }
    tab.state = state
    tab.buf = buf
  }

  private feed(tab: Tab, chunk: string): void {
    this.scan(tab, chunk)
    tab.pending++
    tab.xterm.write(chunk, () => {
      tab.pending--
      this.activity = performance.now()
    })
  }

  async open(): Promise<Tab> {
    this.poll()
    const n = this.tabs.length
    const session = randomUUID()
    const opening = this.kind.opening(this)
    const tab = new Tab(n, session, opening.colors)
    tab.profile = opening.profile ?? ''
    tab.bgs.push(this.shown(tab, '11'))
    this.tabs.push(tab)
    const was = this.front
    this.front = tab
    this.kind.opened?.(this, tab)
    tab.proc = Bun.spawn(opening.argv, {
      cwd: this.place.home,
      env: { ...this.place.env, ...identity(this.term, n, session), ...opening.env, PT_TAB: String(n) },
      terminal: {
        cols: COLS,
        rows: ROWS,
        data: (_, bytes) => {
          const text = tab.decoder.decode(bytes, { stream: true })
          tab.raw += text
          this.activity = performance.now()
          this.feed(tab, text)
        },
      },
      onExit: () => {
        tab.exited = true
        this.activity = performance.now()
      },
    })
    if (was) {
      this.blur(was)
    }
    await this.until(() => tab.prompts() >= 1, 20000, `the ${this.term} tab never drew its first prompt`)
    tab.tty = read(join(this.place.home, '.parity', `tty.${n}`)).trim()
    this.aim(tab)
    await this.settle()
    return tab
  }

  private aim(tab: Tab): void {
    writeFileSync(join(this.place.home, '.parity', 'front'), `${tab.tty}\n`)
  }

  private blur(tab: Tab): void {
    if (this.behavior.focus !== 'none' && tab.focusing) {
      tab.write('\x1b[O')
    }
  }

  async focus(tab: Tab): Promise<void> {
    this.poll()
    if (this.front === tab) {
      return
    }
    const was = this.front
    this.front = tab
    this.aim(tab)
    if (was) {
      this.blur(was)
    }
    if (this.behavior.focus !== 'none' && tab.focusing) {
      tab.write('\x1b[I')
    }
    this.kind.focused?.(this, tab)
    await this.settle()
  }

  async type(tab: Tab, line: string): Promise<void> {
    const before = tab.prompts()
    tab.write(`${line}\r`)
    await this.until(() => tab.prompts() > before || tab.exited, 30000, `${line} never gave its prompt back`)
    await this.settle()
  }

  async keys(tab: Tab, keys: readonly string[], gap = 90): Promise<void> {
    for (const key of keys) {
      if (/^\d+(\.\d+)?s$/.test(key)) {
        await Bun.sleep(Number(key.slice(0, -1)) * 1000)
        continue
      }
      tab.write(KEYS[key] ?? key)
      await Bun.sleep(key === 'esc' ? 160 : gap)
    }
    await this.settle()
  }

  async wears(tab: Tab): Promise<string> {
    const file = join(this.place.home, '.parity', `wears.${tab.n}`)
    rmSync(file, { force: true })
    tab.write(DUMP)
    await this.until(() => existsSync(file), 5000, `the ${this.term} tab never answered what it wears`)
    await Bun.sleep(20)
    const [spec = ''] = readFileSync(file, 'utf8').trim().split('|')
    return specName(spec, palettesOf(this.place.home))
  }

  look(tab = this.front): Look {
    this.poll()
    if (!tab) {
      return { colors: 'none', picture: 'none', opacity: '-' }
    }
    const layered = this.layered(tab)
    return {
      colors: named(this.displayed(tab), palettesOf(this.place.home)),
      picture: layered ?? this.kind.picture(this, tab),
      opacity: layered === undefined ? (this.kind.opacity?.(this, tab) ?? '-') : '-',
    }
  }

  private async busy(): Promise<boolean> {
    const proc = Bun.spawn(['ps', '-A', '-ww', '-o', 'args='], { stdout: 'pipe', stderr: 'ignore' })
    const out = await new Response(proc.stdout).text()
    return out
      .split('\n')
      .some((line) => line.includes(this.place.home) && / -e /.test(line) && !line.startsWith('ps '))
  }

  async settle(quiet = this.term === 'warp' ? 450 : 250): Promise<void> {
    const end = performance.now() + 20000
    this.activity = performance.now()
    for (;;) {
      await Bun.sleep(20)
      this.poll()
      const now = performance.now()
      const idle = this.later === 0 && this.tabs.every((tab) => tab.pending === 0)
      if (idle && now - this.activity >= quiet) {
        if (!(await this.busy())) {
          return
        }
        this.activity = now
      }
      if (now > end) {
        throw new Error(`the ${this.term} tabs never settled`)
      }
    }
  }

  async until(ready: () => boolean, ms: number, what: string): Promise<void> {
    const end = performance.now() + ms
    while (!ready()) {
      if (performance.now() > end) {
        const tail = this.tabs.map((tab) => JSON.stringify(tab.raw.slice(-600))).join('\n')
        throw new Error(`${what}\n${tail}`)
      }
      await Bun.sleep(15)
      this.poll()
    }
  }

  async close(): Promise<void> {
    this.kind.closed?.()
    for (const tab of this.tabs) {
      tab.proc?.kill('SIGHUP')
    }
    await Bun.sleep(60)
    for (const tab of this.tabs) {
      if (!tab.exited) {
        tab.proc?.kill('SIGKILL')
      }
      tab.proc?.terminal?.close()
      tab.xterm.dispose()
    }
  }
}

const KEYS: Record<string, string> = {
  up: '\x1b[A',
  down: '\x1b[B',
  right: '\x1b[C',
  left: '\x1b[D',
  enter: '\r',
  esc: '\x1b',
  tab: '\t',
  space: ' ',
  bs: '\x7f',
  'ctrl-c': '\x03',
  'ctrl-u': '\x15',
  'alt-c': '\x1bc',
}
