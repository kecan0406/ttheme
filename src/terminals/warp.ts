import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, join } from 'node:path'
import type { Hex } from '../core/color.ts'
import { decodePng, encodeRgb, flatIndexed, flatten } from '../core/png.ts'
import type { Theme } from '../core/theme.ts'
import { inOther, owned, stem } from '../core/theme.ts'
import { backgroundsDir } from '../pictures/backdrop.ts'
import { type ProfileBackground, readBackdrop } from '../pictures/conf.ts'
import { backupOnce, editUserFile, relink, spareBackup, symlinked, writeAtomic } from '../store/edits.ts'
import { dataHome, readText, tilde } from './common.ts'
import { warp as emitter, WARP_PART, type WarpPicture, warpPictureFile, warpTheme, warpThemeFile } from './emit/warp.ts'
import type { At, Ctx, Out, Unwired, Wiring } from './types.ts'

export const WARP_CHANNELS = ['stable', 'preview', 'dev', 'oss'] as const

export type WarpChannel = (typeof WARP_CHANNELS)[number]

const WARP_APPS: Record<WarpChannel, string> = {
  stable: 'dev.warp.Warp-Stable',
  preview: 'dev.warp.Warp-Preview',
  dev: 'dev.warp.Warp-Dev',
  oss: 'dev.warp.WarpOss',
}

export function warpChannelOf(env: Record<string, string | undefined>): WarpChannel {
  const app = WARP_CHANNELS.find((channel) => WARP_APPS[channel] === env.__CFBundleIdentifier)

  if (app) {
    return app
  }

  const tag = /\.(preview|dev)_\d/.exec(env.TERM_PROGRAM_VERSION ?? '')?.[1]

  return tag === 'preview' || tag === 'dev' ? tag : 'stable'
}

const WARP_FOLDERS: Record<WarpChannel, string> = {
  stable: 'warp-terminal',
  preview: 'warp-terminal-preview',
  dev: 'warp-terminal-dev',
  oss: 'warp-oss',
}

function warpFolder(channel: WarpChannel): string {
  if (process.platform === 'darwin') {
    return channel === 'stable' ? '.warp' : `.warp-${channel}`
  }

  return WARP_FOLDERS[channel]
}

export function warpThemes(home: string, channel: WarpChannel = 'stable'): string {
  return process.platform === 'darwin'
    ? join(home, warpFolder(channel), 'themes')
    : join(dataHome(home), warpFolder(channel), 'themes')
}

export function warpSettings(home: string, configHome: string, channel: WarpChannel = 'stable'): string {
  return process.platform === 'darwin'
    ? join(home, warpFolder(channel), 'settings.toml')
    : join(configHome, warpFolder(channel), 'settings.toml')
}

export function warpChannels(home: string): WarpChannel[] {
  return WARP_CHANNELS.filter((channel) => existsSync(dirname(warpThemes(home, channel))))
}

export const WARP_DEFAULT = '"dark"'

export const WARP_SYSTEM_DEFAULT = '{ light = "light", dark = "dark" }'

function warpOwn(configHome: string, channel: WarpChannel, kind: string): string {
  return join(configHome, 'ttheme', `${channel === 'stable' ? 'warp' : `warp-${channel}`}.${kind}`)
}

export function warpBasePath(configHome: string, channel: WarpChannel = 'stable'): string {
  return warpOwn(configHome, channel, 'base')
}

export function warpSystemPath(configHome: string, channel: WarpChannel = 'stable'): string {
  return warpOwn(configHome, channel, 'system')
}

export function warpContrastPath(configHome: string, channel: WarpChannel = 'stable'): string {
  return warpOwn(configHome, channel, 'contrast')
}

const WARP_SECTION = '[appearance.themes]'

const WARP_ACCOUNT = '[account]'

const WARP_TEXT = '[appearance.text]'

const WARP_CONTRAST = 'enforce_minimum_contrast'

const WARP_NEVER = '"never"'

const WARP_SYSTEM = 'selected_system_themes'

function warpSection(lines: string[], header = WARP_SECTION): [number, number] | undefined {
  const start = lines.findIndex((line) => line.trim() === header)

  if (start < 0) {
    return undefined
  }

  const next = lines.findIndex((line, i) => i > start && line.trimStart().startsWith('['))

  return [start, next < 0 ? lines.length : next]
}

function keyed(key: string): RegExp {
  return new RegExp(`^${key}\\s*=\\s*`)
}

function warpKeyOf(content: string, key: string, header = WARP_SECTION): string | undefined {
  const lines = content.split('\n')
  const section = warpSection(lines, header)

  if (!section) {
    return undefined
  }

  const line = lines.slice(section[0] + 1, section[1]).find((l) => keyed(key).test(l))

  return line?.replace(keyed(key), '').trim()
}

export function warpThemeOf(content: string): string | undefined {
  return warpKeyOf(content, 'theme')
}

export function warpSystemOf(content: string): string | undefined {
  return warpKeyOf(content, WARP_SYSTEM)
}

export function warpThemeValue(name: string, file: string): string {
  return `{ custom = { name = "${name}", path = "${file}" } }`
}

export function warpRef(dir: string, file: string, palette: string): string {
  return warpThemeValue(/^name: "([^"]*)"$/m.exec(readText(join(dir, file)))?.[1] ?? palette, file)
}

export function warpSystemValue(value: string): string {
  return `{ light = ${value}, dark = ${value} }`
}

function warpWorn(value: string | undefined): string | undefined {
  return ours(value) ? /name = "([^"]+)"/.exec(value ?? '')?.[1]?.split(WARP_PART)[0] : undefined
}

function withWarpKey(content: string, key: string, value: string | undefined, header = WARP_SECTION): string {
  const lines = content.split('\n')
  const section = warpSection(lines, header)

  if (!section) {
    return value === undefined ? content : `${content.replace(/\n*$/, '\n')}\n${header}\n${key} = ${value}\n`
  }

  const at = lines.findIndex((l, i) => i > section[0] && i < section[1] && keyed(key).test(l))

  if (at >= 0) {
    lines.splice(at, 1, ...(value === undefined ? [] : [`${key} = ${value}`]))
  } else if (value !== undefined) {
    lines.splice(section[0] + 1, 0, `${key} = ${value}`)
  }

  return lines.join('\n')
}

export function withWarpTheme(content: string, value: string | undefined): string {
  return withWarpKey(content, 'theme', value)
}

function ours(value: string | undefined): boolean {
  return value?.includes(`path = "${owned('')}`) === true
}

export function warpBack(content: string, base: string, system: string, made = ''): string {
  const theme = ours(warpThemeOf(content)) ? withWarpTheme(content, base || WARP_DEFAULT) : content
  const back = ours(warpSystemOf(content)) ? withWarpKey(theme, WARP_SYSTEM, system || WARP_SYSTEM_DEFAULT) : theme

  return withoutContrast(back, made)
}

function withContrast(content: string, made: string): string {
  const held = warpKeyOf(content, WARP_CONTRAST, WARP_TEXT)

  if (held === undefined) {
    writeAtomic(made, warpSection(content.split('\n'), WARP_TEXT) ? 'key' : 'table')

    return withWarpKey(content, WARP_CONTRAST, WARP_NEVER, WARP_TEXT)
  }

  if (held !== WARP_NEVER) {
    rmSync(made, { force: true })
  }

  return content
}

function withoutContrast(content: string, made: string): string {
  if (made === '' || warpKeyOf(content, WARP_CONTRAST, WARP_TEXT) !== WARP_NEVER) {
    return content
  }

  const lines = withWarpKey(content, WARP_CONTRAST, undefined, WARP_TEXT).split('\n')
  const section = warpSection(lines, WARP_TEXT)

  if (made !== 'table' || !section || lines.slice(section[0] + 1, section[1]).some((line) => line.trim() !== '')) {
    return lines.join('\n')
  }

  const from = lines[section[0] - 1] === '' ? section[0] - 1 : section[0]
  lines.splice(from, section[0] + 1 - from)

  return lines.join('\n')
}

function letContrastGo(content: string, made: string): string {
  const was = readText(made)
  rmSync(made, { force: true })

  return withoutContrast(content, was)
}

export function warpWear(content: string, value: string | undefined, configHome: string, channel: WarpChannel): string {
  const base = warpBasePath(configHome, channel)
  const system = warpSystemPath(configHome, channel)
  const held = warpSystemOf(content)
  const next = value === undefined ? content : withWarpTheme(content, value)

  if (value === undefined || !ours(value)) {
    rmSync(base, { force: true })

    if (!ours(held)) {
      return next
    }

    const back = withWarpKey(next, WARP_SYSTEM, readText(system) || WARP_SYSTEM_DEFAULT)
    rmSync(system, { force: true })

    return back
  }

  const theme = warpThemeOf(content)

  if (!ours(theme)) {
    writeAtomic(base, theme ?? '')
  }

  if (warpKeyOf(content, 'system_theme') !== 'true') {
    return next
  }

  if (!ours(held)) {
    writeAtomic(system, held ?? '')
  }

  return withWarpKey(next, WARP_SYSTEM, warpSystemValue(value))
}

export const WARP_KNOWN = 260

export const WARP_SPACED = 700

const WARP_FRESH = 750

const WARP_LATER_MS = 500

export function warpReady(theme: string, settings: string, now = Date.now()): number {
  const made = statSync(theme).mtimeMs

  return now - made < WARP_FRESH ? Math.max(made + WARP_KNOWN, statSync(settings).mtimeMs + WARP_SPACED) : now
}

const WARP_LATER =
  "const [file, next, seen, theme, later, token, wait] = process.argv.slice(-7); setTimeout(() => { const fs = require('node:fs'); if (!fs.existsSync(later) || fs.readFileSync(later, 'utf8') !== token || fs.readFileSync(file, 'utf8') !== seen || !fs.existsSync(theme)) return; const real = fs.realpathSync(file); const tmp = real + '.ttheme-' + process.pid; fs.writeFileSync(tmp, next); fs.chmodSync(tmp, fs.statSync(real).mode & 0o7777); fs.renameSync(tmp, real); if (!fs.lstatSync(file).isSymbolicLink()) return; const link = file + '.ttheme-' + process.pid; fs.rmSync(link, { force: true }); fs.symlinkSync(fs.readlinkSync(file), link); fs.renameSync(link, file) }, Number(wait))"

interface Laid {
  files: Map<string, string>
  fresh: Set<string>
}

interface WarpShelf {
  dir: string
  channels: WarpChannel[]
}

function shelvesOf(home: string): WarpShelf[] {
  const found = warpChannels(home)
  const shelves: (WarpShelf & { real: string })[] = []

  for (const channel of found.length > 0 ? found : (['stable'] as const)) {
    const dir = warpThemes(home, channel)
    const real = existsSync(dir) ? realpathSync(dir) : dir
    const same = shelves.find((shelf) => shelf.real === real)

    if (same) {
      same.channels.push(channel)
    } else {
      shelves.push({ dir, real, channels: [channel] })
    }
  }

  return shelves
}

function laidOf(dir: string, theme: Theme, picture: ProfileBackground): WarpPicture {
  return { image: join(dir, warpPictureFile(theme.name, picture.image, theme.background)), opacity: picture.opacity }
}

function laidFiles(ctx: Ctx, dir: string): Laid {
  const pictures = backgroundsDir(ctx.configHome)
  const files = new Map<string, string>()
  const fresh = new Set<string>()

  for (const theme of ctx.themes) {
    const picture = readBackdrop(pictures, theme.name, ctx.home)
    const file = warpThemeFile(theme, picture && laidOf(dir, theme, picture))
    files.set(theme.name, file)

    for (const name of new Set([file, warpThemeFile(theme)])) {
      if (!existsSync(join(dir, name))) {
        fresh.add(name)
      }
    }
  }

  return { files, fresh }
}

function layPicture(from: string, to: string, background: Hex): void {
  const bytes = new Uint8Array(readFileSync(from))
  writeAtomic(to, flatIndexed(bytes, background, 1) ?? encodeRgb(flatten(decodePng(bytes), background, 1)))
}

function indexed(path: string): boolean {
  const head = new Uint8Array(26)
  let fd: number | undefined

  try {
    fd = openSync(path, 'r')
    readSync(fd, head, 0, head.length, 0)

    return head[25] === 3
  } catch {
    return false
  } finally {
    if (fd !== undefined) {
      closeSync(fd)
    }
  }
}

function writePictures(ctx: Ctx, out: Out, files: Map<string, string>, shelf: WarpShelf): void {
  const { dir } = shelf
  const pictures = backgroundsDir(ctx.configHome)

  const kept = new Set([
    ...files.values(),
    ...ctx.themes.flatMap((theme) => [theme, ...inOther(theme)].map((shade) => warpThemeFile(shade))),
  ])

  const current = shelf.channels
    .map((channel) => readText(warpSettings(ctx.home, ctx.configHome, channel)))
    .flatMap((content) => [warpThemeOf(content) ?? '', warpSystemOf(content) ?? ''])
    .join('\n')

  const others = new Set<string>()

  for (const theme of ctx.themes) {
    const picture = readBackdrop(pictures, theme.name, ctx.home)
    const file = files.get(theme.name)

    if (picture && file) {
      const laid = laidOf(dir, theme, picture)

      if (!existsSync(laid.image)) {
        try {
          layPicture(picture.image, laid.image, theme.background)
        } catch {
          files.set(theme.name, warpThemeFile(theme))
          continue
        }
      }

      out.write(join(dir, file), warpTheme(theme, laid))

      for (const shade of inOther(theme)) {
        const other: WarpPicture = {
          image: join(dir, warpPictureFile(theme.name, picture.image, shade.background)),
          opacity: picture.opacity,
        }

        others.add(other.image)

        if (indexed(picture.image)) {
          continue
        }

        if (!existsSync(other.image)) {
          try {
            layPicture(picture.image, other.image, shade.background)
          } catch {
            continue
          }
        }

        const name = warpThemeFile(shade, other)
        kept.add(name)
        out.write(join(dir, name), warpTheme(shade, other))
      }
    }
  }

  if (!existsSync(dir)) {
    return
  }

  const owns = (file: string, extension: string) =>
    file.startsWith(owned('')) && !file.includes('.view-') && file.endsWith(`.${extension}`)

  for (const file of readdirSync(dir)) {
    if (owns(file, 'yaml') && !kept.has(file) && !current.includes(`path = "${file}"`)) {
      out.remove(join(dir, file))
    }
  }

  const shown = new Set(
    readdirSync(dir)
      .values()
      .filter((file) => file.startsWith(owned('')) && file.endsWith('.yaml'))
      .map((file) => /^ {2}path: "(.+)"$/m.exec(readText(join(dir, file)))?.[1])
      .filter((image) => image !== undefined),
  )

  for (const other of others) {
    shown.add(other)
  }

  for (const file of readdirSync(dir)) {
    if (owns(file, 'png') && !shown.has(join(dir, file))) {
      out.remove(join(dir, file))
    }
  }
}

function kept(startup: string | undefined, laid: Laid, channel: WarpChannel): string | undefined {
  const tab = process.env.TTHEME_WARP_WEARS

  return startup !== undefined && tab !== undefined && laid.files.has(tab) && channel === warpChannelOf(process.env)
    ? tab
    : startup
}

function wearWarp(
  at: At,
  shelf: WarpShelf,
  channel: WarpChannel,
  startup: string | undefined,
  laid: Laid,
  keep = false,
): string | undefined {
  const file = warpSettings(at.home, at.configHome, channel)

  if (!existsSync(file)) {
    return undefined
  }

  const content = readFileSync(file, 'utf8')
  const wear = keep ? warpWorn(warpThemeOf(content)) : startup

  if (keep && (wear === undefined || !laid.files.has(wear))) {
    return undefined
  }

  const later = warpOwn(at.configHome, channel, 'later')
  rmSync(later, { force: true })
  const theme = wear ? laid.files.get(wear) : undefined

  if (wear && theme === undefined) {
    return undefined
  }

  const made = warpContrastPath(at.configHome, channel)
  const back = ours(warpThemeOf(content)) ? readText(warpBasePath(at.configHome, channel)) || WARP_DEFAULT : undefined
  const value = wear && theme !== undefined ? warpRef(shelf.dir, theme, wear) : back
  const worn = warpWear(content, value, at.configHome, channel)
  const next = keep ? worn : wear ? withContrast(worn, made) : letContrastGo(worn, made)

  if (next === content) {
    return undefined
  }

  if (theme !== undefined && laid.fresh.has(theme)) {
    backupOnce(file)
    const token = randomUUID()
    mkdirSync(dirname(later), { recursive: true })
    writeFileSync(later, token)
    const shown = join(shelf.dir, theme)
    const now = Date.now()
    const wait = String(Math.max(WARP_LATER_MS, warpReady(shown, file, now) - now))
    spawn(process.execPath, ['-e', WARP_LATER, file, next, content, shown, later, token, wait], {
      detached: true,
      stdio: 'ignore',
    }).unref()
  } else {
    editUserFile(file, next)
    relink(file)
  }

  return file
}

export const warp: Wiring = {
  id: 'warp',
  name: 'Warp',
  emitter,
  shelf: { from: 'themes', dir: (at) => (shelvesOf(at.home)[0] as WarpShelf).dir },
  bakes: true,
  offered: (_, host) => host.platform !== 'win32',
  present: (setup) => warpChannels(setup.home).length > 0,
  sync(ctx, out) {
    out.themes(warp)

    for (const [i, shelf] of shelvesOf(ctx.home).entries()) {
      if (i > 0) {
        for (const theme of ctx.themes) {
          for (const { path, content } of emitter.emit?.(theme) ?? []) {
            out.write(join(shelf.dir, basename(path)), content)
          }
        }
      }

      const laid = laidFiles(ctx, shelf.dir)
      writePictures(ctx, out, laid.files, shelf)

      for (const channel of shelf.channels) {
        const file = wearWarp(ctx, shelf, channel, kept(ctx.startup, laid, channel), laid)

        if (file) {
          out.note(file)
        }
      }
    }
  },
  pictures(ctx, out) {
    for (const shelf of shelvesOf(ctx.home)) {
      const laid = laidFiles(ctx, shelf.dir)
      writePictures(ctx, out, laid.files, shelf)

      for (const channel of shelf.channels) {
        wearWarp(ctx, shelf, channel, undefined, laid, true)
      }
    }
  },
  layer: (ctx) => ({
    TTHEME_WARP_PLAIN: ctx.themes.map((theme) => `${stem(theme.name)} ${warpThemeFile(theme)}`).join(' '),
  }),
  plan(ctx) {
    return ctx.startup
      ? shelvesOf(ctx.home)
          .flatMap((shelf) => shelf.channels)
          .map((channel) => warpSettings(ctx.home, ctx.configHome, channel))
          .filter((file) => existsSync(file))
          .map((file) =>
            warpKeyOf(readText(file), WARP_CONTRAST, WARP_TEXT) === undefined
              ? `Edit ${tilde(file, ctx.home)} — [appearance.themes] theme and [appearance.text] ${WARP_CONTRAST}, so Warp shows the palettes’ own colors; \`ttheme off\` puts yours back`
              : `Edit ${tilde(file, ctx.home)} — [appearance.themes] theme; \`ttheme off\` puts yours back`,
          )
      : []
  },
  notes: (now) => [
    'Warp shows one theme for the whole app, set through its settings.toml — a tab that takes a palette (`ttheme use`, a pin, preview) switches it, and switching tabs puts on the palette of the tab in front, read from Warp’s session database with sqlite3',
    ...WARP_CHANNELS.flatMap((channel) => {
      const file = warpSettings(now.home, now.configHome, channel)

      return warpKeyOf(readText(file), 'is_settings_sync_enabled', WARP_ACCOUNT) === 'true'
        ? [
            `${tilde(file, now.home)} has Warp’s Settings sync on, so every palette ttheme puts on, and the minimum contrast it turns off, reach your other devices — one without the same theme file falls back to Warp’s dark theme, and one running ttheme puts its own back; turn Settings sync off in Warp to keep them on this device`,
          ]
        : []
    }),
  ],
  next: () => [],
  unwire(at) {
    const unwired: Unwired = { edits: [], removals: [], touches: [] }

    for (const channel of WARP_CHANNELS) {
      const file = warpSettings(at.home, at.configHome, channel)
      const content = readText(file)

      const back = warpBack(
        content,
        readText(warpBasePath(at.configHome, channel)),
        readText(warpSystemPath(at.configHome, channel)),
        readText(warpContrastPath(at.configHome, channel)),
      )

      if (back === content) {
        unwired.removals.push(...spareBackup(file))
        continue
      }

      unwired.edits.push({ file, content: back })

      if (symlinked(file)) {
        unwired.touches.push(file)
      }
    }

    return unwired
  },
}
