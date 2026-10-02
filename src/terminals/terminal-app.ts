import { join } from 'node:path'
import { terminalApp as emitter } from '../emit/index.ts'
import { listed } from '../manifest.ts'
import type { Theme } from '../theme.ts'
import type { Ctx, Defaults, Host, Moment, Wiring } from './types.ts'

export const TERMINAL_DOMAIN = 'com.apple.Terminal'

const OURS = 'ttheme · '

export function terminalProfile(palette: string): string {
  return `${OURS}${palette}`
}

export function terminalScript(configHome: string): string {
  return join(configHome, 'ttheme', 'terminal-app.js')
}

export const TERMINAL_JS = `ObjC.import('AppKit')

const OURS = '${OURS}'
const KEYS = ['BackgroundColor', 'TextColor', 'CursorColor', 'SelectionColor', 'ANSIBlackColor', 'ANSIRedColor',
  'ANSIGreenColor', 'ANSIYellowColor', 'ANSIBlueColor', 'ANSIMagentaColor', 'ANSICyanColor', 'ANSIWhiteColor',
  'ANSIBrightBlackColor', 'ANSIBrightRedColor', 'ANSIBrightGreenColor', 'ANSIBrightYellowColor', 'ANSIBrightBlueColor',
  'ANSIBrightMagentaColor', 'ANSIBrightCyanColor', 'ANSIBrightWhiteColor']

function color(hex, alpha) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const c = $.NSColor.colorWithDeviceRedGreenBlueAlpha(r, g, b, alpha)
  return $.NSKeyedArchiver.archivedDataWithRootObjectRequiringSecureCodingError(c, false, null)
}

function alphaOf(profile) {
  const data = profile.objectForKey('BackgroundColor')
  if (data.isNil()) {
    return 1
  }
  const c = $.NSKeyedUnarchiver.unarchiveObjectWithData(data)
  return c.isNil() ? 1 : c.alphaComponent
}

function ours(ws) {
  return ObjC.deepUnwrap(ws.allKeys).filter((name) => name.startsWith(OURS))
}

function run(argv) {
  const [verb, ...rest] = argv
  const d = $.NSUserDefaults.alloc.initWithSuiteName('com.apple.Terminal')
  const found = d.dictionaryForKey('Window Settings')
  const ws = found.isNil() ? $.NSMutableDictionary.dictionary : found.mutableCopy
  if (verb === 'loaded') {
    const profile = ws.objectForKey(rest[0])
    if (profile.isNil()) {
      return '0'
    }
    const at = profile.objectForKey('TthemeAt')
    const start = d.objectForKey('LastTerminalStartTime')
    return at.isNil() || (!start.isNil() && at.compare(start) < 0) ? '1' : '0'
  }
  let changed = false
  const keep = []
  if (verb === 'write') {
    const named = ws.objectForKey(rest[0])
    const base = named.isNil() ? ws.objectForKey('Basic') : named
    const from = base.isNil() ? $.NSDictionary.dictionary : base
    const alpha = alphaOf(from)
    for (let i = 1; i + 20 < rest.length; i += 21) {
      const name = rest[i]
      const p = from.mutableCopy
      KEYS.forEach((key, k) => p.setObjectForKey(color(rest[i + 1 + k], key === 'BackgroundColor' ? alpha : 1), key))
      p.setObjectForKey(color(rest[i + 2], 1), 'TextBoldColor')
      p.setObjectForKey($(name), 'name')
      p.setObjectForKey($('Window Settings'), 'type')
      p.removeObjectForKey('TthemeAt')
      keep.push(name)
      const was = ws.objectForKey(name)
      const same = was.isNil() ? $.NSMutableDictionary.dictionary : was.mutableCopy
      same.removeObjectForKey('TthemeAt')
      if (!same.isEqualToDictionary(p)) {
        p.setObjectForKey($.NSDate.date, 'TthemeAt')
        ws.setObjectForKey(p, name)
        changed = true
      }
    }
  }
  if (verb === 'write' || verb === 'drop') {
    for (const name of ours(ws)) {
      if (!keep.includes(name)) {
        ws.removeObjectForKey(name)
        changed = true
      }
    }
  }
  if (changed) {
    d.setObjectForKey(ws, 'Window Settings')
    d.synchronize
  }
  return changed ? 'wrote' : 'same'
}
`

function script(host: Host, configHome: string, args: string[]): string | undefined {
  return host.run('osascript', ['-l', 'JavaScript', terminalScript(configHome), ...args])
}

function current(host: Host): string | undefined {
  return host.run('defaults', ['read', TERMINAL_DOMAIN, 'Default Window Settings']) || undefined
}

function slots(theme: Theme): string[] {
  return [theme.background, theme.foreground, theme.cursor, theme.selectionBackground, ...theme.ansi]
}

function profiled(ctx: Ctx): Theme[] {
  const shown = new Set(listed(ctx.entries).map((entry) => entry.name))
  return ctx.themes.filter((theme) => shown.has(theme.name) || theme.name === ctx.startup)
}

function baseOf(state: Moment['state'], host: Host): string {
  const now = current(host)
  return state.terminalBase ?? (now && !now.startsWith(OURS) ? now : 'Basic')
}

const defaults: Defaults = {
  key: 'terminalBase',
  profile: terminalProfile,
  base(moment: Moment) {
    const now = current(moment.host)
    return now && !now.startsWith(OURS) ? { ...moment.state, terminalBase: now } : moment.state
  },
  point(moment: Moment, take: boolean) {
    const now = current(moment.host)
    const ours = now?.startsWith(OURS) === true
    if (moment.state.palettes.length === 0) {
      script(moment.host, moment.configHome, ['drop'])
    }
    const want = moment.startup
      ? take || ours
        ? terminalProfile(moment.startup)
        : undefined
      : ours
        ? baseOf(moment.state, moment.host)
        : undefined
    if (want === undefined || (want === now && !take)) {
      return undefined
    }
    for (const key of ['Default Window Settings', 'Startup Window Settings']) {
      moment.host.run('defaults', ['write', TERMINAL_DOMAIN, key, '-string', want])
    }
    const running = Boolean(moment.host.run('pgrep', ['-x', 'Terminal']))
    return { restart: running && script(moment.host, moment.configHome, ['loaded', want]) !== '1' }
  },
}

export const terminalApp: Wiring = {
  id: 'terminal-app',
  name: 'Terminal.app',
  emitter,
  offered: (_, host) => host.platform === 'darwin',
  present: () => false,
  sync(ctx, out) {
    out.write(terminalScript(ctx.configHome), TERMINAL_JS)
    const base = baseOf(ctx.state, ctx.host)
    script(ctx.host, ctx.configHome, [
      'write',
      base,
      ...profiled(ctx).flatMap((theme) => [terminalProfile(theme.name), ...slots(theme)]),
    ])
  },
  layer: (now, host) => ({ TTHEME_TERMINAL_APP_BASE: baseOf(now.state, host) }),
  plan: (ctx) => [
    `Add a "${terminalProfile('<palette>')}" profile per palette to Terminal.app's settings — a copy of your own profile in the palette's colors`,
    ...(ctx.startup
      ? [`Make "${terminalProfile(ctx.startup)}" Terminal.app's default — \`ttheme off\` puts yours back`]
      : []),
  ],
  notes: () => [],
  next(ctx, pointed) {
    const lines = [`Terminal.app      A "${terminalProfile('<palette>')}" profile per palette in Settings › Profiles`]
    if (ctx.startup) {
      lines.push(
        pointed?.restart
          ? `Restart Terminal  New windows and tabs open on "${terminalProfile(ctx.startup)}"`
          : `Terminal default  "${terminalProfile(ctx.startup)}", which follows \`ttheme default\``,
      )
    }
    return lines
  },
  unwire: () => ({ edits: [], removals: [], touches: [] }),
  defaults,
}
