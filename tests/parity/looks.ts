import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, isAbsolute, join } from 'node:path'
import { parse as parseToml } from 'smol-toml'
import { readBackdrop } from '../../src/backdrop.ts'
import { SLOT_CODES } from '../../src/osc.ts'
import { decodePng, type Rgba } from '../../src/png.ts'
import { type Colors, OWN, SEEN } from './terms.ts'

export function read(path: string): string {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return ''
  }
}

export function stamp(path: string): string {
  try {
    const s = statSync(path)
    return `${s.mtimeMs}:${s.size}`
  } catch {
    return '-'
  }
}

export function hex(value: string | undefined): string | undefined {
  const v = value?.trim().replace(/^['"]|['"]$/g, '')
  if (!v) {
    return undefined
  }
  if (/^#[0-9a-fA-F]{6}$/.test(v)) {
    return v.toLowerCase()
  }
  const rgb = /^rgba?:([0-9a-fA-F]{1,4})\/([0-9a-fA-F]{1,4})\/([0-9a-fA-F]{1,4})/.exec(v)
  if (rgb) {
    return `#${rgb
      .slice(1, 4)
      .map((part) => Math.round((Number.parseInt(part, 16) / (16 ** part.length - 1)) * 255))
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('')}`
  }
  const triple = /^(\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})$/.exec(v)
  if (triple) {
    return `#${triple
      .slice(1, 4)
      .map((n) => Number(n).toString(16).padStart(2, '0'))
      .join('')}`
  }
  return undefined
}

export function rgbSpec(color: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => color.slice(i, i + 2))
  return `rgb:${r}${r}/${g}${g}/${b}${b}`
}

export function filled(partial: Colors): Colors {
  return new Map(SLOT_CODES.map((code) => [code, partial.get(code) ?? (OWN.get(code) as string)]))
}

export function stemName(stem: string): string {
  return stem.replace('--', '@').replace('--', '/')
}

export function fileStem(name: string): string {
  return name.replace('@', '--').replace('/', '--')
}

export function palettesOf(home: string): Map<string, Colors> {
  const text = read(join(home, '.config', 'ttheme', 'palettes.zsh'))
  const block = /typeset -gA TTHEME_PALETTE=\(\n([\s\S]*?)\n\)/.exec(text)?.[1] ?? ''
  const palettes = new Map<string, Colors>()
  for (const line of block.split('\n')) {
    const match = /^\s*(\S+)\s+"([^"]+)"/.exec(line)
    const colors = match?.[2]?.split(' ')
    if (match?.[1] && colors?.length === 20) {
      palettes.set(match[1], new Map(SLOT_CODES.map((code, i) => [code, colors[i] as string])))
    }
  }
  return palettes
}

export function specName(spec: string, palettes: Map<string, Colors>): string {
  if (!spec) {
    return 'none'
  }
  for (const [name, colors] of palettes) {
    if (SLOT_CODES.map((code) => colors.get(code)).join(' ') === spec) {
      return name
    }
  }
  return 'custom'
}

function matches(colors: Colors, want: Colors, slots: readonly string[]): boolean {
  return slots.every((code) => colors.get(code) === want.get(code))
}

export function named(colors: Colors, palettes: Map<string, Colors>): string {
  const whole = (slots: readonly string[]) => {
    if (matches(colors, OWN, slots)) {
      return 'own'
    }
    for (const [name, want] of palettes) {
      if (matches(colors, want, slots)) {
        return name
      }
    }
    return undefined
  }
  const all = whole(SEEN)
  if (all) {
    return all
  }
  const parts = [
    ['bg', ['11']],
    ['fg', ['10']],
    ['cursor', ['12']],
    ['ansi', SEEN.filter((code) => code.startsWith('4;'))],
  ] as const
  return parts.map(([label, slots]) => `${label}:${whole(slots) ?? 'other'}`).join(' ')
}

export function conf(file: string, into = new Map<string, string>(), depth = 0): Map<string, string> {
  const text = read(file)
  if (!text || depth > 8) {
    return into
  }
  for (const line of text.split('\n')) {
    const match = /^\s*([\w-]+)\s*=\s*(.*?)\s*$/.exec(line)
    if (!match?.[1]) {
      continue
    }
    if (match[1] === 'config-file') {
      const path = (match[2] ?? '').replace(/^\?/, '')
      conf(isAbsolute(path) ? path : join(dirname(file), path), into, depth + 1)
    } else {
      into.set(match[1], match[2] ?? '')
    }
  }
  return into
}

export function pictured(file: string): boolean {
  const c = conf(file)
  const opacity = Number(c.get('background-image-opacity') ?? '1')
  return (c.get('background-image') ?? '') !== '' && !(opacity <= 0)
}

export function pictureOf(backgrounds: string, palette: string | undefined): string {
  return palette && pictured(join(backgrounds, `${fileStem(palette)}.conf`)) ? palette : 'none'
}

export function strength(file: string): string {
  return pictured(file) ? String(Number(conf(file).get('background-image-opacity') ?? '1')) : '-'
}

export function strengthOf(backgrounds: string, palette: string | undefined): string {
  return palette ? strength(join(backgrounds, `${fileStem(palette)}.conf`)) : '-'
}

export function imageName(path: string): string {
  const base = path.split('/').at(-1) ?? ''
  return stemName(base.replace(/[.@].*$/, ''))
}

function ghosttyLines(file: string, depth = 0): [string, string, string][] {
  const text = read(file)
  if (!text || depth > 8) {
    return []
  }
  return text.split('\n').flatMap((line): [string, string, string][] => {
    const match = /^\s*([\w-]+)\s*=\s*(.*?)\s*$/.exec(line)
    return match?.[1] ? [[match[1], match[2] ?? '', file]] : []
  })
}

export interface GhosttyLoad {
  command?: string
  colors: Colors
  picture: string
  opacity: string
}

export function ghosttyLoad(configHome: string): GhosttyLoad {
  const main = ghosttyLines(join(configHome, 'ghostty', 'config'))
  const command = main.findLast(([key]) => key === 'command')?.[1]
  const theme = main.findLast(([key]) => key === 'theme')?.[1]
  const colors = new Map<string, string>()
  const slot: Record<string, string> = {
    background: '11',
    foreground: '10',
    'cursor-color': '12',
    'selection-background': '17',
  }
  const apply = (lines: [string, string, string][]) => {
    for (const [key, value] of lines) {
      const code = slot[key]
      const color = code ? hex(value) : undefined
      if (code && color) {
        colors.set(code, color)
      }
      const pal = key === 'palette' ? /^(\d+)=(#[0-9a-fA-F]{6})$/.exec(value) : undefined
      if (pal) {
        colors.set(`4;${pal[1]}`, (pal[2] as string).toLowerCase())
      }
    }
  }
  if (theme) {
    apply(ghosttyLines(isAbsolute(theme) ? theme : join(configHome, 'ghostty', 'themes', theme)))
  }
  apply(main)
  let picture = 'none'
  let opacity = '-'
  for (const [key, value, from] of main) {
    if (key !== 'config-file') {
      continue
    }
    const path = value.replace(/^\?/, '')
    for (const [inner, target, at] of ghosttyLines(isAbsolute(path) ? path : join(dirname(from), path))) {
      if (inner === 'config-file') {
        const conf = target.replace(/^\?/, '')
        const file = isAbsolute(conf) ? conf : join(dirname(at), conf)
        picture =
          existsSync(file) && pictured(file)
            ? stemName(
                file
                  .split('/')
                  .at(-1)
                  ?.replace(/\.conf$/, '') ?? '',
              )
            : 'none'
        opacity = picture === 'none' ? '-' : strength(file)
      }
    }
  }
  return { ...(command ? { command } : {}), colors: filled(colors), picture, opacity }
}

export function kittyColors(configHome: string): Colors {
  const colors = new Map<string, string>()
  const slot: Record<string, string> = {
    background: '11',
    foreground: '10',
    cursor: '12',
    selection_background: '17',
  }
  const apply = (file: string, depth: number) => {
    for (const line of read(file).split('\n')) {
      const match = /^\s*(\S+)\s+(.*?)\s*$/.exec(line)
      if (!match?.[1] || match[1].startsWith('#')) {
        continue
      }
      if (match[1] === 'include' && depth < 8) {
        const path = match[2] ?? ''
        apply(isAbsolute(path) ? path : join(dirname(file), path), depth + 1)
        continue
      }
      const color = hex(match[2])
      const code = slot[match[1]] ?? (/^color(\d+)$/.exec(match[1]) ? `4;${match[1].slice(5)}` : undefined)
      if (code && color) {
        colors.set(code, color)
      }
    }
  }
  apply(join(configHome, 'kitty', 'kitty.conf'), 0)
  return filled(colors)
}

export function kittyTheme(configHome: string, palette: string): Colors | undefined {
  const file = join(configHome, 'kitty', 'themes', `ttheme-${fileStem(palette)}.conf`)
  if (!existsSync(file)) {
    return undefined
  }
  const colors = new Map<string, string>()
  for (const line of read(file).split('\n')) {
    const match = /^\s*(\S+)\s+(#[0-9a-fA-F]{6})\s*$/.exec(line)
    const code = match?.[1]
      ? (({ background: '11', foreground: '10', cursor: '12', selection_background: '17' } as Record<string, string>)[
          match[1]
        ] ?? (/^color(\d+)$/.exec(match[1]) ? `4;${match[1].slice(5)}` : undefined))
      : undefined
    if (code && match?.[2]) {
      colors.set(code, match[2].toLowerCase())
    }
  }
  return filled(colors)
}

function tomlColors(
  text: string,
  pick: (doc: Record<string, unknown>) => Record<string, unknown> | undefined,
): Map<string, string> {
  const colors = new Map<string, string>()
  let doc: Record<string, unknown>
  try {
    doc = parseToml(text) as Record<string, unknown>
  } catch {
    return colors
  }
  for (const [code, value] of Object.entries(pick(doc) ?? {})) {
    const color = hex(String(value))
    if (color) {
      colors.set(code, color)
    }
  }
  return colors
}

const ALACRITTY_NAMES = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white']

function alacrittyPick(doc: Record<string, unknown>): Record<string, unknown> | undefined {
  const c = doc.colors as Record<string, Record<string, string>> | undefined
  if (!c) {
    return undefined
  }
  return {
    ...(c.primary?.background ? { 11: c.primary.background } : {}),
    ...(c.primary?.foreground ? { 10: c.primary.foreground } : {}),
    ...(c.cursor?.cursor ? { 12: c.cursor.cursor } : {}),
    ...(c.selection?.background ? { 17: c.selection.background } : {}),
    ...Object.fromEntries(
      ALACRITTY_NAMES.flatMap((name, i) => [
        ...(c.normal?.[name] ? [[`4;${i}`, c.normal[name]]] : []),
        ...(c.bright?.[name] ? [[`4;${i + 8}`, c.bright[name]]] : []),
      ]),
    ),
  }
}

export function alacrittyFiles(configHome: string): string[] {
  const config = join(configHome, 'alacritty', 'alacritty.toml')
  let imports: string[] = []
  try {
    imports = (parseToml(read(config)) as { general?: { import?: string[] } }).general?.import ?? []
  } catch {
    imports = []
  }
  return [...imports, config]
}

export function alacrittyColors(configHome: string): Colors {
  const colors = new Map<string, string>()
  for (const file of alacrittyFiles(configHome)) {
    for (const [code, color] of tomlColors(read(file), alacrittyPick)) {
      colors.set(code, color)
    }
  }
  return filled(colors)
}

export function weztermColors(configHome: string): Colors {
  const module = read(join(configHome, 'ttheme', 'wezterm.lua'))
  const wired =
    read(join(configHome, 'wezterm', 'wezterm.lua')).includes('dofile(') ||
    read(join(dirname(configHome), '.wezterm.lua')).includes('dofile(')
  const scheme = /^local STARTUP = "([^"]+)"$/m.exec(module)?.[1]
  if (!wired || !scheme) {
    return filled(new Map())
  }
  const colors = tomlColors(read(join(configHome, 'wezterm', 'colors', `${scheme}.toml`)), (doc) => {
    const c = doc.colors as Record<string, unknown> | undefined
    if (!c) {
      return undefined
    }
    const ansi = (c.ansi as string[] | undefined) ?? []
    const brights = (c.brights as string[] | undefined) ?? []
    return {
      ...(c.background ? { 11: c.background } : {}),
      ...(c.foreground ? { 10: c.foreground } : {}),
      ...(c.cursor_bg ? { 12: c.cursor_bg } : {}),
      ...(c.selection_bg ? { 17: c.selection_bg } : {}),
      ...Object.fromEntries([...ansi, ...brights].map((color, i) => [`4;${i}`, color])),
    }
  })
  return filled(colors)
}

export interface ItermProfile {
  guid: string
  name: string
  colors: Colors
  image: string
  blend: number
}

export function itermProfiles(home: string): Map<string, ItermProfile> {
  const profiles = new Map<string, ItermProfile>()
  const file = join(home, 'Library', 'Application Support', 'iTerm2', 'DynamicProfiles', 'ttheme.json')
  let list: Record<string, unknown>[] = []
  try {
    list = (JSON.parse(read(file) || '{}') as { Profiles?: Record<string, unknown>[] }).Profiles ?? []
  } catch {
    list = []
  }
  const keys: Record<string, string> = {
    'Background Color': '11',
    'Foreground Color': '10',
    'Cursor Color': '12',
    'Selection Color': '17',
    ...Object.fromEntries(Array.from({ length: 16 }, (_, i) => [`Ansi ${i} Color`, `4;${i}`])),
  }
  for (const profile of list) {
    const colors = new Map<string, string>()
    for (const [key, code] of Object.entries(keys)) {
      const c = profile[key] as Record<string, number> | undefined
      if (c) {
        colors.set(
          code,
          `#${['Red Component', 'Green Component', 'Blue Component']
            .map((part) =>
              Math.round((c[part] ?? 0) * 255)
                .toString(16)
                .padStart(2, '0'),
            )
            .join('')}`,
        )
      }
    }
    const guid = String(profile.Guid ?? '')
    profiles.set(guid, {
      guid,
      name: String(profile.Name ?? ''),
      colors: filled(colors),
      image: String(profile['Background Image Location'] ?? ''),
      blend: Number(profile.Blend ?? 0.5),
    })
  }
  return profiles
}

export function wtColors(wtHome: string, profile: string): Colors {
  const file = join(wtHome, 'Microsoft', 'Windows Terminal', 'Fragments', 'ttheme', 'ttheme.json')
  let fragment: { profiles?: Record<string, string>[]; schemes?: Record<string, string>[] } = {}
  try {
    fragment = JSON.parse(read(file) || '{}')
  } catch {
    fragment = {}
  }
  const scheme = fragment.profiles?.find((p) => p.updates === profile)?.colorScheme
  const found = fragment.schemes?.find((s) => s.name === scheme)
  if (!found) {
    return filled(new Map())
  }
  const names = ['black', 'red', 'green', 'yellow', 'blue', 'purple', 'cyan', 'white']
  const colors = new Map<string, string>()
  const put = (code: string, value: string | undefined) => {
    const color = hex(value)
    if (color) {
      colors.set(code, color)
    }
  }
  put('11', found.background)
  put('10', found.foreground)
  put('12', found.cursorColor)
  put('17', found.selectionBackground)
  names.forEach((name, i) => {
    put(`4;${i}`, found[name])
    put(`4;${i + 8}`, found[`bright${name[0]?.toUpperCase()}${name.slice(1)}`])
  })
  return filled(colors)
}

export interface WarpLook {
  colors: Colors
  picture: string
  opacity: string
}

export function warpLook(settings: string, themes: string): WarpLook {
  const text = read(settings)
  const section = text.split(/^\[/m).find((part) => part.startsWith('appearance.themes]')) ?? ''
  const value = /^theme\s*=\s*(.*)$/m.exec(section)?.[1] ?? ''
  const path = /path = "([^"]+)"/.exec(value)?.[1]
  if (!path) {
    return { colors: filled(new Map()), picture: 'none', opacity: '-' }
  }
  const yaml = read(isAbsolute(path) ? path : join(themes, path))
  const colors = new Map<string, string>()
  const pick = (key: string) => hex(new RegExp(`^${key}:\\s*(\\S+)`, 'm').exec(yaml)?.[1])
  const put = (code: string, color: string | undefined) => {
    if (color) {
      colors.set(code, color)
    }
  }
  put('11', pick('background'))
  put('10', pick('foreground'))
  put('12', pick('cursor'))
  const names = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white']
  for (const [group, offset] of [
    ['normal', 0],
    ['bright', 8],
  ] as const) {
    const block = new RegExp(`^  ${group}:\\n((?:    .*\\n?)*)`, 'm').exec(yaml)?.[1] ?? ''
    names.forEach((name, i) => {
      put(`4;${i + offset}`, hex(new RegExp(`^    ${name}:\\s*(\\S+)`, 'm').exec(block)?.[1]))
    })
  }
  const image = /^background_image:\n\s+path:\s*"([^"]+)"/m.exec(yaml)?.[1]
  const picture = image ? imageName((image.split('/').at(-1) ?? '').replace(/^ttheme-/, '')) : 'none'
  const opacity = /^background_image:\n(?:\s+.*\n)*?\s+opacity:\s*(\d+)/m.exec(yaml)?.[1]
  return {
    colors: filled(colors),
    picture,
    opacity: picture === 'none' ? '-' : String(Number(opacity ?? '100') / 100),
  }
}

export function konsoleScheme(dataHome: string, scheme: string): Colors | undefined {
  const text = read(join(dataHome, 'konsole', `${scheme}.colorscheme`))
  if (!text) {
    return undefined
  }
  const colors = new Map<string, string>()
  let group = ''
  for (const line of text.split('\n')) {
    const header = /^\[(.+)\]$/.exec(line.trim())
    if (header) {
      group = header[1] ?? ''
      continue
    }
    const color = /^Color=(.+)$/.exec(line.trim())?.[1]
    const code =
      group === 'Background'
        ? '11'
        : group === 'Foreground'
          ? '10'
          : /^Color(\d)$/.test(group)
            ? `4;${group.slice(5)}`
            : /^Color(\d)Intense$/.test(group)
              ? `4;${Number(group.slice(5, 6)) + 8}`
              : undefined
    const value = hex(color)
    if (code && value) {
      colors.set(code, value)
    }
  }
  return filled(new Map([...colors, ['12', colors.get('10') ?? (OWN.get('12') as string)]]))
}

export interface KonsoleLook {
  colors: Colors
  picture: string
  opacity: string
}

export function konsoleLook(dataHome: string, scheme: string): KonsoleLook | undefined {
  const colors = konsoleScheme(dataHome, scheme)
  if (!colors) {
    return undefined
  }
  const text = read(join(dataHome, 'konsole', `${scheme}.colorscheme`))
  const general = text.split(/^\[/m).find((part) => part.startsWith('General]')) ?? ''
  const image = /^Wallpaper=(.*)$/m.exec(general)?.[1]?.trim() ?? ''
  const opacity = Number(/^WallpaperOpacity=(.*)$/m.exec(general)?.[1] ?? '1')
  return image === '' || !(opacity > 0)
    ? { colors, picture: 'none', opacity: '-' }
    : { colors, picture: imageName(image), opacity: String(opacity) }
}

export function konsoleProfile(dataHome: string, file: string): { scheme: string; cursor?: string } | undefined {
  const text = read(join(dataHome, 'konsole', file.endsWith('.profile') ? file : `${file}.profile`))
  if (!text) {
    return undefined
  }
  const value = (group: string, key: string) => {
    const part = text.split(/^\[/m).find((p) => p.startsWith(`${group}]`)) ?? ''
    return new RegExp(`^${key}=(.*)$`, 'm').exec(part)?.[1]?.trim()
  }
  const scheme = value('Appearance', 'ColorScheme') ?? 'Own'
  const cursor =
    value('Cursor Options', 'UseCustomCursorColor') === 'true'
      ? hex(value('Cursor Options', 'CustomCursorColor'))
      : undefined
  return { scheme, ...(cursor ? { cursor } : {}) }
}

export interface TerminalPicture {
  palette: string
  opacity: string
  background: string
}

function toneOf(backgrounds: string, palette: string, home: string): number[] | undefined {
  const picture = readBackdrop(backgrounds, palette, home)
  if (!picture || !existsSync(picture.image)) {
    return undefined
  }
  const image = decodePng(new Uint8Array(readFileSync(picture.image)))
  let at = -1
  for (let i = 3; i < image.data.length; i += 4) {
    if (at < 0 || (image.data[i] as number) > (image.data[at] as number)) {
      at = i
    }
  }
  return at < 0 ? undefined : [...image.data.subarray(at - 3, at)]
}

export function terminalPicture(file: string, backgrounds: string, home: string): TerminalPicture | undefined {
  let image: Rgba
  try {
    image = decodePng(new Uint8Array(readFileSync(file)))
  } catch {
    return undefined
  }
  const palette = stemName((file.split('/').at(-1) ?? '').replace(/^ttheme-/, '').replace(/\..*$/, ''))
  const corner = (image.height - 1) * image.width * 4
  const bg = [...image.data.subarray(corner, corner + 3)]
  const tone = toneOf(backgrounds, palette, home) ?? bg
  const span = tone.map((value, c) => value - (bg[c] as number))
  const length = span.reduce((sum, value) => sum + value * value, 0)
  let most = 0
  for (let i = 0; length > 0 && i < image.data.length; i += 4) {
    let along = 0
    for (let c = 0; c < 3; c++) {
      along += ((image.data[i + c] as number) - (bg[c] as number)) * (span[c] as number)
    }
    most = Math.max(most, along / length)
  }
  return {
    palette,
    opacity: String(Math.round(most * 100) / 100),
    background: `#${bg.map((value) => value.toString(16).padStart(2, '0')).join('')}`,
  }
}
