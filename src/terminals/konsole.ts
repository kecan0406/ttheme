import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { basename, isAbsolute, join } from 'node:path'
import { backgroundsDir, readBackdrop } from '../backdrop.ts'
import { type Hex, isHex, rgb } from '../color.ts'
import { editUserFile } from '../edits.ts'
import { konsole as emitter } from '../emit/index.ts'
import { konsoleScheme } from '../emit/konsole.ts'
import { listed } from '../manifest.ts'
import type { Theme } from '../theme.ts'
import { owned } from '../theme.ts'
import { dataHome, ownedIn, readText, tilde } from './common.ts'
import type { At, Ctx, Defaults, Host, Moment, Out, Wiring } from './types.ts'

export function konsoleData(home: string): string {
  return join(dataHome(home), 'konsole')
}

export function konsolerc(configHome: string): string {
  return join(configHome, 'konsolerc')
}

export function profileFile(palette: string): string {
  return `${owned(palette)}.profile`
}

export function profileName(palette: string): string {
  return `ttheme · ${palette}`
}

function group(lines: string[], name: string): [number, number] | undefined {
  const start = lines.findIndex((line) => line.trim() === `[${name}]`)
  if (start < 0) {
    return undefined
  }
  const next = lines.findIndex((line, i) => i > start && line.trimStart().startsWith('['))
  return [start, next < 0 ? lines.length : next]
}

function keyed(key: string): RegExp {
  return new RegExp(String.raw`^\s*${key}\s*=`)
}

export function iniValue(content: string, name: string, key: string): string | undefined {
  const lines = content.split('\n')
  const range = group(lines, name)
  const line = range && lines.slice(range[0] + 1, range[1]).find((l) => keyed(key).test(l))
  return line?.replace(keyed(key), '').trim()
}

export function withDefaultProfile(content: string, file: string | undefined): string {
  const lines = content.split('\n')
  const range = group(lines, 'Desktop Entry')
  const line = file === undefined ? [] : [`DefaultProfile=${file}`]
  if (!range) {
    return file === undefined
      ? content
      : `${content === '' ? '' : content.replace(/\n*$/, '\n\n')}[Desktop Entry]\n${line[0]}\n`
  }
  const at = lines.findIndex((l, i) => i > range[0] && i < range[1] && keyed('DefaultProfile').test(l))
  if (at >= 0) {
    lines.splice(at, 1, ...line)
  } else {
    lines.splice(range[0] + 1, 0, ...line)
  }
  const end = range[1] + line.length - (at >= 0 ? 1 : 0)
  if (lines.slice(range[0] + 1, end).every((l) => l.trim() === '')) {
    const from = range[0] > 0 && lines[range[0] - 1]?.trim() === '' ? range[0] - 1 : range[0]
    const stop = end === lines.length && lines[end - 1] === '' ? end - 1 : end
    lines.splice(from, stop - from)
  }
  return lines.join('\n')
}

function hexOf(value: string | undefined): Hex | undefined {
  if (value && isHex(value.toLowerCase())) {
    return value.toLowerCase()
  }
  const parts = value?.split(',').map((part) => Number(part.trim()))
  if (!parts || parts.length < 3 || parts.slice(0, 3).some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return undefined
  }
  return `#${parts
    .slice(0, 3)
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('')}`
}

function profilePath(at: At, file: string): string | undefined {
  const named = file.endsWith('.profile') ? file : `${file}.profile`
  if (isAbsolute(named)) {
    return existsSync(named) ? named : undefined
  }
  const inside = named.includes('/') ? named : join('konsole', named)
  const dirs = [dataHome(at.home), ...(process.env.XDG_DATA_DIRS || '/usr/local/share:/usr/share').split(':')]
  return dirs.map((dir) => join(dir, inside)).find((path) => existsSync(path))
}

interface Look {
  scheme?: string
  use?: string
  cursor?: string
}

function lookOf(at: At, file: string | undefined, depth = 0): Look {
  const path = file && file !== 'FALLBACK/' && depth < 8 ? profilePath(at, file) : undefined
  if (!path) {
    return {}
  }
  const text = readText(path)
  const parent = lookOf(at, iniValue(text, 'General', 'Parent'), depth + 1)
  return {
    scheme: iniValue(text, 'Appearance', 'ColorScheme') || parent.scheme,
    use: iniValue(text, 'Cursor Options', 'UseCustomCursorColor') ?? parent.use,
    cursor: iniValue(text, 'Cursor Options', 'CustomCursorColor') ?? parent.cursor,
  }
}

export function baseLook(at: At, base: string | undefined): string {
  const look = lookOf(at, base)
  const cursor = look.use === 'true' ? hexOf(look.cursor) : undefined
  return [
    `ColorScheme=${look.scheme ?? 'Breeze'}`,
    `UseCustomCursorColor=${cursor ? 'true' : 'false'}`,
    ...(cursor ? [`customCursorColor=${cursor}`] : []),
  ].join(';')
}

export function konsoleProfile(theme: Theme, parent: string): string {
  return [
    '[Appearance]',
    `ColorScheme=${owned(theme.name)}`,
    '',
    '[Cursor Options]',
    `CustomCursorColor=${rgb(theme.cursor).join(',')}`,
    `CustomCursorTextColor=${rgb(theme.background).join(',')}`,
    'UseCustomCursorColor=true',
    '',
    '[General]',
    `Name=${profileName(theme.name)}`,
    `Parent=${parent}`,
    '',
  ].join('\n')
}

const VERSIONED = /^ttheme-(.+)\.([0-9a-f]{8})\.colorscheme$/

export function versionOf(text: string): string {
  return createHash('sha1').update(text).digest('hex').slice(0, 8)
}

function schemes(ctx: Ctx, out: Out): void {
  const dir = konsoleData(ctx.home)
  const pictures = backgroundsDir(ctx.configHome)
  const keep = new Set<string>()
  for (const theme of ctx.themes) {
    const text = konsoleScheme(theme, readBackdrop(pictures, theme.name, ctx.home))
    const versioned = join(dir, `${owned(theme.name)}.${versionOf(text)}.colorscheme`)
    keep.add(versioned)
    out.write(join(dir, `${owned(theme.name)}.colorscheme`), text)
    out.write(versioned, text)
  }
  for (const file of ownedIn(dir)) {
    if (VERSIONED.test(basename(file)) && !keep.has(file)) {
      out.remove(file)
    }
  }
}

export function schemeVersions(dir: string): string {
  return ownedIn(dir)
    .flatMap((file) => {
      const [, stem, version] = VERSIONED.exec(basename(file)) ?? []
      return stem && version ? [`${stem} ${version}`] : []
    })
    .sort()
    .join(' ')
}

function profiled(ctx: Ctx): Theme[] {
  const shown = new Set(listed(ctx.entries).map((entry) => entry.name))
  return ctx.themes.filter((theme) => shown.has(theme.name) || theme.name === ctx.startup)
}

const BUS = ['--session', '--print-reply', '--reply-timeout=2000']

function konsoles(host: Host): { service: string; window: string }[] {
  const names = host.run('dbus-send', [
    ...BUS,
    '--dest=org.freedesktop.DBus',
    '/org/freedesktop/DBus',
    'org.freedesktop.DBus.ListNames',
  ])
  return [...(names ?? '').matchAll(/string "(org\.kde\.konsole(?:-\d+)?)"/g)].flatMap(([, service = '']) => {
    const tree = host.run('dbus-send', [
      ...BUS,
      `--dest=${service}`,
      '/Windows',
      'org.freedesktop.DBus.Introspectable.Introspect',
    ])
    const window = tree?.match(/<node name="(\d+)"/)?.[1]
    return window ? [{ service, window: `/Windows/${window}` }] : []
  })
}

function wears(host: Host, { service, window }: { service: string; window: string }, name: string): boolean {
  const call = (method: string, ...args: string[]) =>
    host.run('dbus-send', [...BUS, `--dest=${service}`, window, `org.kde.konsole.Window.${method}`, ...args])
  call('setDefaultProfile', `string:${name}`)
  return call('defaultProfile')?.includes(`string "${name}"`) === true
}

function nameOf(at: At, file: string): string | undefined {
  const path = profilePath(at, file)
  return path ? iniValue(readText(path), 'General', 'Name') : undefined
}

function defaultProfile(configHome: string): string | undefined {
  return iniValue(readText(konsolerc(configHome)), 'Desktop Entry', 'DefaultProfile')
}

const defaults: Defaults = {
  key: 'konsoleBase',
  profile: profileName,
  base(moment: Moment) {
    const now = defaultProfile(moment.configHome)
    return now && !now.startsWith(owned('')) ? { ...moment.state, konsoleBase: now } : moment.state
  },
  point(moment: Moment, take: boolean) {
    const file = konsolerc(moment.configHome)
    const content = readText(file)
    const now = iniValue(content, 'Desktop Entry', 'DefaultProfile')
    const ours = now?.startsWith(owned('')) === true
    const want = moment.startup
      ? take || ours
        ? profileFile(moment.startup)
        : undefined
      : ours
        ? (moment.state.konsoleBase ?? '')
        : undefined
    if (want === undefined || (want === (now ?? '') && !take)) {
      return undefined
    }
    if (want !== (now ?? '')) {
      editUserFile(file, withDefaultProfile(content, want || undefined))
    }
    const name = moment.startup ? profileName(moment.startup) : want ? nameOf(moment, want) : undefined
    const running = konsoles(moment.host)
    const took = name !== undefined && running.every((konsole) => wears(moment.host, konsole, name))
    return { restart: running.length > 0 && !took }
  },
}

export const konsole: Wiring = {
  id: 'konsole',
  name: 'Konsole',
  emitter,
  shelf: { from: '', dir: (at) => konsoleData(at.home) },
  offered: (_, host) => host.platform !== 'darwin' && host.platform !== 'win32',
  present: (setup) => existsSync(konsoleData(setup.home)) || existsSync(konsolerc(setup.configHome)),
  sync(ctx, out) {
    schemes(ctx, out)
    const dir = konsoleData(ctx.home)
    const parent = ctx.state.konsoleBase ?? 'FALLBACK/'
    const keep = new Set<string>()
    for (const theme of profiled(ctx)) {
      const file = join(dir, profileFile(theme.name))
      keep.add(file)
      out.write(file, konsoleProfile(theme, parent))
    }
    for (const file of ownedIn(dir)) {
      if (file.endsWith('.profile') && !keep.has(file)) {
        out.remove(file)
      }
    }
  },
  pictures: schemes,
  layer: (ctx) => ({
    TTHEME_KONSOLE_BASE: baseLook(ctx, ctx.state.konsoleBase),
    TTHEME_KONSOLE_SCHEMES: schemeVersions(konsoleData(ctx.home)),
  }),
  plan(ctx) {
    return [
      `Write ${tilde(konsoleData(ctx.home), ctx.home)}/${owned('*')}.profile — a "ttheme · <palette>" profile per palette, on top of your own`,
      ...(ctx.startup
        ? [`Edit ${tilde(konsolerc(ctx.configHome), ctx.home)} — DefaultProfile; \`ttheme off\` puts yours back`]
        : []),
    ]
  },
  notes: () => [],
  next(ctx, pointed) {
    const lines = ['Konsole profiles  A "ttheme · <palette>" per palette in its profile list']
    if (ctx.startup) {
      lines.push(
        pointed?.restart
          ? `Restart Konsole   New tabs open on "${profileName(ctx.startup)}"`
          : `Konsole default   "${profileName(ctx.startup)}", which follows \`ttheme default\``,
      )
    }
    return lines
  },
  unwire(at, state) {
    const file = konsolerc(at.configHome)
    const content = readText(file)
    const now = iniValue(content, 'Desktop Entry', 'DefaultProfile')
    return {
      edits: now?.startsWith(owned('')) ? [{ file, content: withDefaultProfile(content, state?.konsoleBase) }] : [],
      removals: [],
      touches: [],
    }
  },
  defaults,
}
