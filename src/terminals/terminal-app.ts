import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { backgroundsDir, frameAt, readBackdrop } from '../backdrop.ts'
import { rewrite, writeAtomic } from '../edits.ts'
import { terminalApp as emitter } from '../emit/index.ts'
import type { ProfileBackground } from '../emit/iterm2.ts'
import { listed } from '../manifest.ts'
import { type Canvas, decodePng, encodeRgb, flatten, pngHead } from '../png.ts'
import type { Theme } from '../theme.ts'
import { owned, POSITIONS, stem } from '../theme.ts'
import { readText } from './common.ts'
import type { Ctx, Defaults, Host, Moment, Wiring } from './types.ts'

export const TERMINAL_DOMAIN = 'com.apple.Terminal'

const OURS = 'ttheme · '

export function terminalProfile(palette: string): string {
  return `${OURS}${palette}`
}

export function terminalScript(configHome: string): string {
  return join(configHome, 'ttheme', 'terminal-app.js')
}

export function terminalPictures(configHome: string): string {
  return join(configHome, 'ttheme', 'terminal-app')
}

export function terminalWindow(env: Host['env'], home: string): string {
  return join(env.XDG_STATE_HOME ?? join(home, '.local', 'state'), 'ttheme', 'terminal-app.window')
}

export const TERMINAL_JS = `ObjC.import('AppKit')

const OURS = '${OURS}'
const IMAGE = 'BackgroundImageBookmark'
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

function real(path) {
  return $.NSURL.fileURLWithPath(path).URLByResolvingSymlinksInPath.path.js
}

function bookmark(path, was) {
  if (!was.isNil()) {
    const data = $.NSKeyedUnarchiver.unarchiveObjectWithData(was)
    const url = data.isNil() ? data : $.NSURL.URLByResolvingBookmarkDataOptionsRelativeToURLBookmarkDataIsStaleError(data, 768, $(), null, null)
    if (!url.isNil() && url.URLByResolvingSymlinksInPath.path.js === real(path)) {
      return was
    }
  }
  const data = $.NSURL.fileURLWithPath(path).bookmarkDataWithOptionsIncludingResourceValuesForKeysRelativeToURLError(0, $(), $(), $())
  return data.isNil() ? undefined : $.NSKeyedArchiver.archivedDataWithRootObjectRequiringSecureCodingError(data, false, null)
}

function plain(profile) {
  const copy = profile.mutableCopy
  copy.removeObjectForKey(IMAGE)
  return copy
}

function settings() {
  const d = $.NSUserDefaults.alloc.initWithSuiteName('com.apple.Terminal')
  const found = d.dictionaryForKey('Window Settings')
  return { d, ws: found.isNil() ? $.NSMutableDictionary.dictionary : found.mutableCopy }
}

function current(d, ws, name) {
  const profile = ws.objectForKey(name)
  if (profile.isNil()) {
    return false
  }
  const at = profile.objectForKey('TthemeAt')
  const start = d.objectForKey('LastTerminalStartTime')
  return at.isNil() || (!start.isNil() && at.compare(start) < 0)
}

function tabOf(T, tty) {
  for (const w of T.windows()) {
    for (const t of w.tabs()) {
      if (t.tty() === tty) {
        return t
      }
    }
  }
  return null
}

function wear(T, tab, name, fallback) {
  if (tab === null) {
    return 'kept'
  }
  const { d, ws } = settings()
  if (current(d, ws, name) && T.settingsSets.byName(name).exists()) {
    tab.currentSettings = T.settingsSets.byName(name)
    return 'worn'
  }
  if (tab.currentSettings.name().startsWith(OURS) && fallback && T.settingsSets.byName(fallback).exists()) {
    tab.currentSettings = T.settingsSets.byName(fallback)
    return 'base'
  }
  return 'kept'
}

function serve(T) {
  const input = $.NSFileHandle.fileHandleWithStandardInput
  const output = $.NSFileHandle.fileHandleWithStandardOutput
  const tabs = {}
  let buf = ''
  for (;;) {
    const data = input.availableData
    if (+data.length === 0) {
      return ''
    }
    buf += $.NSString.alloc.initWithDataEncoding(data, $.NSUTF8StringEncoding).js
    let at
    while ((at = buf.indexOf('\\n')) >= 0) {
      const [verb, tty, name, fallback] = buf.slice(0, at).split('\\t')
      buf = buf.slice(at + 1)
      let answer = 'kept'
      try {
        if (verb === 'tab') {
          if (!(tty in tabs)) {
            tabs[tty] = tabOf(T, tty)
          }
          answer = wear(T, tabs[tty], name, fallback)
        }
      } catch (e) {
        delete tabs[tty]
      }
      output.writeData($(answer + '\\n').dataUsingEncoding($.NSUTF8StringEncoding))
    }
  }
}

function run(argv) {
  const [verb, ...rest] = argv
  if (verb === 'tab') {
    const T = Application('Terminal')
    return wear(T, tabOf(T, rest[0]), rest[1], rest[2])
  }
  if (verb === 'serve') {
    return serve(Application('Terminal'))
  }
  const { d, ws } = settings()
  if (verb === 'loaded') {
    return current(d, ws, rest[0]) ? '1' : '0'
  }
  let changed = false
  const keep = []
  if (verb === 'write') {
    const named = ws.objectForKey(rest[0])
    const base = named.isNil() ? ws.objectForKey('Basic') : named
    const from = base.isNil() ? $.NSDictionary.dictionary : base
    const alpha = alphaOf(from)
    for (let i = 1; i + 21 < rest.length; i += 22) {
      const name = rest[i]
      const p = from.mutableCopy
      KEYS.forEach((key, k) => p.setObjectForKey(color(rest[i + 1 + k], key === 'BackgroundColor' ? alpha : 1), key))
      p.setObjectForKey(color(rest[i + 2], 1), 'TextBoldColor')
      p.setObjectForKey($(name), 'name')
      p.setObjectForKey($('Window Settings'), 'type')
      p.removeObjectForKey('TthemeAt')
      const was = ws.objectForKey(name)
      if (rest[i + 21] !== '-') {
        const mark = bookmark(rest[i + 21], was.isNil() ? was : was.objectForKey(IMAGE))
        if (mark) {
          p.setObjectForKey(mark, IMAGE)
        }
      }
      keep.push(name)
      const same = was.isNil() ? $.NSMutableDictionary.dictionary : was.mutableCopy
      same.removeObjectForKey('TthemeAt')
      if (!same.isEqualToDictionary(p)) {
        const at = was.isNil() || !plain(same).isEqualToDictionary(plain(p)) ? $.NSDate.date : was.objectForKey('TthemeAt')
        if (!at.isNil()) {
          p.setObjectForKey(at, 'TthemeAt')
        }
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

export interface Shape {
  width: number
  height: number
}

export function shapeOf(env: Host['env'], home: string): Shape | undefined {
  const size = /^(\d+)x(\d+)$/.exec(readText(terminalWindow(env, home)).trim())
  return size ? { width: Number(size[1]) * 2, height: Number(size[2]) * 2 } : undefined
}

export function canvasFor(width: number, height: number, picture: ProfileBackground, shape: Shape | undefined): Canvas {
  const W = shape?.width ?? width
  const H = shape?.height ?? height
  const at = (POSITIONS as readonly string[]).indexOf(picture.position) + 1 || 5
  const box = frameAt(width, height, W, H, 100, at, picture.cover)
  const k = Math.min(1, width / Math.max(1, box.w))
  return {
    width: Math.max(1, Math.round(W * k)),
    height: Math.max(1, Math.round(H * k)),
    at: { x: Math.round(box.x * k), y: Math.round(box.y * k), w: Math.round(box.w * k), h: Math.round(box.h * k) },
  }
}

const LAID = /^ttheme-(.+)\.([0-9a-z-]+)\.png$/

export function heldIn(dir: string): Map<string, string[]> {
  const held = new Map<string, string[]>()
  for (const file of existsSync(dir) ? readdirSync(dir) : []) {
    const [, of] = LAID.exec(file) ?? []
    if (of) {
      held.set(of, [...(held.get(of) ?? []), file])
    }
  }
  return held
}

export function pictureVersions(dir: string): string {
  return [...heldIn(dir)]
    .map(([of, files]) => `${of} ${(LAID.exec(files[0] as string) ?? [])[2]}`)
    .sort()
    .join(' ')
}

function lay(ctx: Ctx): Map<string, string> {
  const dir = terminalPictures(ctx.configHome)
  const held = heldIn(dir)
  const shape = shapeOf(ctx.host.env, ctx.home)
  const laid = new Map<string, string>()
  const drop = (files: readonly string[]) => {
    for (const file of files) {
      rmSync(join(dir, file), { force: true })
    }
  }
  for (const theme of profiled(ctx)) {
    const files = held.get(stem(theme.name)) ?? []
    held.delete(stem(theme.name))
    const picture = readBackdrop(backgroundsDir(ctx.configHome), theme.name, ctx.home)
    const bytes = picture && existsSync(picture.image) ? new Uint8Array(readFileSync(picture.image)) : undefined
    const head = bytes && pngHead(bytes)
    if (!picture || !bytes || !head || picture.opacity <= 0) {
      drop(files)
      continue
    }
    const canvas = canvasFor(head.width, head.height, picture, shape)
    const version = createHash('sha1')
      .update(bytes)
      .update(JSON.stringify([theme.background.toLowerCase(), picture.opacity, canvas]))
      .digest('hex')
      .slice(0, 8)
    const file = `${owned(theme.name)}.${version}.png`
    const path = join(dir, file)
    if (!files.includes(file)) {
      let content: Buffer
      try {
        content = encodeRgb(flatten(decodePng(bytes), theme.background, picture.opacity, canvas))
      } catch {
        drop(files)
        continue
      }
      const [keep, ...rest] = files
      if (keep) {
        rewrite(join(dir, keep), path, content)
      } else {
        writeAtomic(path, content)
      }
      drop(rest)
    } else {
      drop(files.filter((other) => other !== file))
    }
    laid.set(theme.name, path)
  }
  for (const files of held.values()) {
    drop(files)
  }
  return laid
}

function write(ctx: Ctx, laid: ReadonlyMap<string, string>): void {
  script(ctx.host, ctx.configHome, [
    'write',
    baseOf(ctx.state, ctx.host),
    ...profiled(ctx).flatMap((theme) => [terminalProfile(theme.name), ...slots(theme), laid.get(theme.name) ?? '-']),
  ])
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
    write(ctx, lay(ctx))
  },
  pictures(ctx) {
    write(ctx, lay(ctx))
  },
  layer: (now, host) => ({
    TTHEME_TERMINAL_APP_BASE: baseOf(now.state, host),
    TTHEME_TERMINAL_PICTURES: pictureVersions(terminalPictures(now.configHome)),
  }),
  plan: (ctx) => [
    `Add a "${terminalProfile('<palette>')}" profile per palette to Terminal.app's settings — a copy of your own profile in the palette's colors, with its picture`,
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
