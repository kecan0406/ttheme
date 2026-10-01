import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { backgroundsDir, readBackdrop } from '../backdrop.ts'
import { backupOnce, editUserFile, writeAtomic } from '../edits.ts'
import { warp as emitter } from '../emit/index.ts'
import type { ProfileBackground } from '../emit/iterm2.ts'
import { type WarpPicture, warpPictureFile, warpTheme, warpThemeFile } from '../emit/warp.ts'
import { decodePng, encodeRgb, flatten } from '../png.ts'
import type { Theme } from '../theme.ts'
import { owned } from '../theme.ts'
import { dataHome, readText, tilde } from './common.ts'
import type { At, Ctx, Out, Wiring } from './types.ts'

export function warpThemes(home: string): string {
  return process.platform === 'darwin' ? join(home, '.warp', 'themes') : join(dataHome(home), 'warp-terminal', 'themes')
}

export function warpSettings(home: string, configHome: string): string {
  return process.platform === 'darwin'
    ? join(home, '.warp', 'settings.toml')
    : join(configHome, 'warp-terminal', 'settings.toml')
}

export const WARP_DEFAULT = '"dark"'

export function warpBasePath(configHome: string): string {
  return join(configHome, 'ttheme', 'warp.base')
}

const WARP_SECTION = '[appearance.themes]'

function warpSection(lines: string[]): [number, number] | undefined {
  const start = lines.findIndex((line) => line.trim() === WARP_SECTION)
  if (start < 0) {
    return undefined
  }
  const next = lines.findIndex((line, i) => i > start && line.trimStart().startsWith('['))
  return [start, next < 0 ? lines.length : next]
}

export function warpThemeOf(content: string): string | undefined {
  const lines = content.split('\n')
  const section = warpSection(lines)
  if (!section) {
    return undefined
  }
  const line = lines.slice(section[0] + 1, section[1]).find((l) => /^theme\s*=/.test(l))
  return line?.replace(/^theme\s*=\s*/, '').trim()
}

export function warpThemeValue(palette: string, file = `${owned(palette)}.yaml`): string {
  return `{ custom = { name = "${palette}", path = "${file}" } }`
}

export function warpWorn(value: string | undefined): string | undefined {
  return value?.includes(`path = "${owned('')}`) === true ? /name = "([^"]+)"/.exec(value)?.[1] : undefined
}

export function withWarpTheme(content: string, value: string | undefined): string {
  const lines = content.split('\n')
  const section = warpSection(lines)
  if (!section) {
    return value === undefined ? content : `${content.replace(/\n*$/, '\n')}\n${WARP_SECTION}\ntheme = ${value}\n`
  }
  const at = lines.findIndex((l, i) => i > section[0] && i < section[1] && /^theme\s*=/.test(l))
  if (at >= 0) {
    lines.splice(at, 1, ...(value === undefined ? [] : [`theme = ${value}`]))
  } else if (value !== undefined) {
    lines.splice(section[0] + 1, 0, `theme = ${value}`)
  }
  return lines.join('\n')
}

function ours(content: string): boolean {
  return warpThemeOf(content)?.includes(`path = "${owned('')}`) === true
}

const WARP_LATER =
  "setTimeout(() => { const fs = require('node:fs'); const [file, next, seen, theme] = process.argv.slice(-4); if (fs.readFileSync(file, 'utf8') !== seen || !fs.existsSync(theme)) return; const tmp = file + '.ttheme-' + process.pid; fs.writeFileSync(tmp, next); fs.chmodSync(tmp, fs.statSync(file).mode & 0o7777); fs.renameSync(tmp, file) }, 500)"

interface Laid {
  files: Map<string, string>
  fresh: Set<string>
}

function laidOf(dir: string, theme: Theme, picture: ProfileBackground): WarpPicture {
  return { image: join(dir, warpPictureFile(theme.name, picture.image, theme.background)), opacity: picture.opacity }
}

function laidFiles(ctx: Ctx): Laid {
  const dir = warpThemes(ctx.home)
  const pictures = backgroundsDir(ctx.configHome)
  const files = new Map<string, string>()
  const fresh = new Set<string>()
  for (const theme of ctx.themes) {
    const picture = readBackdrop(pictures, theme.name, ctx.home)
    const file = warpThemeFile(theme.name, picture && laidOf(dir, theme, picture))
    files.set(theme.name, file)
    for (const name of new Set([file, warpThemeFile(theme.name)])) {
      if (!existsSync(join(dir, name))) {
        fresh.add(name)
      }
    }
  }
  return { files, fresh }
}

function writePictures(ctx: Ctx, out: Out, files: Map<string, string>): void {
  const dir = warpThemes(ctx.home)
  const pictures = backgroundsDir(ctx.configHome)
  const kept = new Set(files.values())
  const current = warpThemeOf(readText(warpSettings(ctx.home, ctx.configHome))) ?? ''
  for (const theme of ctx.themes) {
    const picture = readBackdrop(pictures, theme.name, ctx.home)
    const file = files.get(theme.name)
    if (picture && file) {
      const laid = laidOf(dir, theme, picture)
      if (!existsSync(laid.image)) {
        try {
          const image = decodePng(new Uint8Array(readFileSync(picture.image)))
          writeAtomic(laid.image, encodeRgb(flatten(image, theme.background, 1)))
        } catch {
          files.set(theme.name, warpThemeFile(theme.name))
          continue
        }
      }
      out.write(join(dir, file), warpTheme(theme, laid))
    }
  }
  if (!existsSync(dir)) {
    return
  }
  const owns = (file: string, extension: string) =>
    file.startsWith(owned('')) && new RegExp(`\\.[0-9a-f]{8}\\.${extension}$`).test(file)
  for (const file of readdirSync(dir)) {
    if (owns(file, 'yaml') && !kept.has(file) && !current.includes(`path = "${file}"`)) {
      out.remove(join(dir, file))
    }
  }
  const shown = new Set<string>()
  for (const file of readdirSync(dir)) {
    const image =
      file.startsWith(owned('')) && file.endsWith('.yaml')
        ? /^ {2}path: "(.+)"$/m.exec(readText(join(dir, file)))?.[1]
        : undefined
    if (image) {
      shown.add(image)
    }
  }
  for (const file of readdirSync(dir)) {
    if (owns(file, 'png') && !shown.has(join(dir, file))) {
      out.remove(join(dir, file))
    }
  }
}

function wearWarp(at: At, startup: string | undefined, laid: Laid, keep = false): string | undefined {
  const file = warpSettings(at.home, at.configHome)
  if (!existsSync(file)) {
    return undefined
  }
  const base = warpBasePath(at.configHome)
  const content = readFileSync(file, 'utf8')
  const wear = keep ? warpWorn(warpThemeOf(content)) : startup
  if (keep && (wear === undefined || !laid.files.has(wear))) {
    return undefined
  }
  let value: string
  if (wear) {
    if (!ours(content) && !existsSync(base)) {
      mkdirSync(dirname(base), { recursive: true })
      writeFileSync(base, warpThemeOf(content) ?? '')
    }
    value = warpThemeValue(wear, laid.files.get(wear))
  } else {
    if (!ours(content)) {
      return undefined
    }
    value = (existsSync(base) && readFileSync(base, 'utf8')) || WARP_DEFAULT
    rmSync(base, { force: true })
  }
  const next = withWarpTheme(content, value)
  if (next === content) {
    return undefined
  }
  const theme = wear === undefined ? undefined : (laid.files.get(wear) ?? `${owned(wear)}.yaml`)
  if (theme !== undefined && laid.fresh.has(theme)) {
    backupOnce(file)
    spawn(process.execPath, ['-e', WARP_LATER, realpathSync(file), next, content, join(warpThemes(at.home), theme)], {
      detached: true,
      stdio: 'ignore',
    }).unref()
  } else {
    editUserFile(file, next)
  }
  return file
}

export const warp: Wiring = {
  id: 'warp',
  name: 'Warp',
  emitter,
  shelf: { from: 'themes', dir: (at) => warpThemes(at.home) },
  bakes: true,
  offered: (_, host) => host.platform !== 'win32',
  present: (setup) => existsSync(dirname(warpThemes(setup.home))),
  sync(ctx, out) {
    const laid = laidFiles(ctx)
    out.themes(warp)
    writePictures(ctx, out, laid.files)
    const file = wearWarp(ctx, ctx.startup, laid)
    if (file) {
      out.note(file)
    }
  },
  pictures(ctx, out) {
    const laid = laidFiles(ctx)
    writePictures(ctx, out, laid.files)
    wearWarp(ctx, undefined, laid, true)
  },
  plan(ctx) {
    const file = warpSettings(ctx.home, ctx.configHome)
    return ctx.startup && existsSync(file)
      ? [`Edit ${tilde(file, ctx.home)} — [appearance.themes] theme; \`ttheme off\` puts yours back`]
      : []
  },
  notes: () => [
    'Warp wears one theme for the whole app, set through its settings.toml — a tab that takes a palette (`ttheme use`, a pin, preview) switches it, and switching tabs puts on the palette of the tab in front, read from Warp’s session database with sqlite3',
  ],
  next: () => [],
  unwire(at) {
    const file = warpSettings(at.home, at.configHome)
    const content = readText(file)
    return {
      edits: ours(content)
        ? [{ file, content: withWarpTheme(content, readText(warpBasePath(at.configHome)) || WARP_DEFAULT) }]
        : [],
      removals: [],
      touches: [],
    }
  },
}
