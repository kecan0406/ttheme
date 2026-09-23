import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { AGENT, KEY_SPAN, MAX_PIXELS, type Site } from './booru.ts'
import { isPng, pngHead } from './png.ts'

const run = promisify(execFile)
const LIMIT = 64 * 1024 * 1024
const SIDE = 4096
const IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/tiff', 'image/heic']
const TEXT_MIMES = ['text/uri-list', 'text/plain;charset=utf-8', 'text/plain']
const DROP_MIMES = [...IMAGE_MIMES, 'text/uri-list', 'text/plain']

export interface Loaded {
  bytes: Uint8Array
  ext: 'png' | 'jpg'
  width: number
  height: number
  source: string
}

export type Got =
  | { kind: 'bytes'; bytes: Uint8Array; source: string }
  | { kind: 'text'; text: string }
  | { kind: 'error'; message: string }

export type Inbound =
  | { kind: 'paste'; text: string }
  | { kind: 'osc'; code: string; meta: Record<string, string>; payload: string }
  | { kind: 'mode'; mode: number; value: number }
  | { kind: 'attributes' }

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}

export function words(line: string): string[] {
  const out: string[] = []
  let word = ''
  let quote = ''
  let open = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i] as string
    if (quote === "'") {
      if (c === "'") {
        quote = ''
      } else {
        word += c
      }
    } else if (quote === '"') {
      if (c === '"') {
        quote = ''
      } else if (c === '\\' && '"\\$`'.includes(line[i + 1] ?? '')) {
        word += line[++i]
      } else {
        word += c
      }
    } else if (c === '\\' && i + 1 < line.length) {
      word += line[++i]
      open = true
    } else if (c === "'" || c === '"') {
      quote = c
      open = true
    } else if (/\s/.test(c)) {
      if (open) {
        out.push(word)
      }
      word = ''
      open = false
    } else {
      word += c
      open = true
    }
  }
  if (open) {
    out.push(word)
  }
  return out
}

function local(word: string): string | undefined {
  if (/^file:\/\//i.test(word)) {
    try {
      return fileURLToPath(word)
    } catch {
      return undefined
    }
  }
  if (word.startsWith('~/')) {
    return join(homedir(), word.slice(2))
  }
  return word.startsWith('/') ? word : undefined
}

export function pastedRefs(text: string, exists: (path: string) => boolean = isFile): string[] {
  const refs: string[] = []
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    const whole = local(line.trim())
    if (whole && exists(whole)) {
      refs.push(whole)
      continue
    }
    for (const word of words(line)) {
      if (/^https?:\/\/\S+$/i.test(word)) {
        refs.push(word)
        continue
      }
      const path = local(word)
      if (path && exists(path)) {
        refs.push(path)
      }
    }
  }
  return refs
}

export function jpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return null
  }
  let at = 2
  while (at + 9 < bytes.length) {
    if (bytes[at] !== 0xff) {
      at++
      continue
    }
    const marker = bytes[at + 1] as number
    if (marker === 0xff) {
      at++
      continue
    }
    const length = ((bytes[at + 2] as number) << 8) | (bytes[at + 3] as number)
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return {
        height: ((bytes[at + 5] as number) << 8) | (bytes[at + 6] as number),
        width: ((bytes[at + 7] as number) << 8) | (bytes[at + 8] as number),
      }
    }
    at += 2 + length
  }
  return null
}

function sniff(bytes: Uint8Array): { ext: 'png' | 'jpg'; width: number; height: number } | undefined {
  const size = isPng(bytes) ? pngHead(bytes) : jpegSize(bytes)
  if (!size) {
    return undefined
  }
  return { ext: isPng(bytes) ? 'png' : 'jpg', width: size.width, height: size.height }
}

export async function normalize(bytes: Uint8Array, source: string): Promise<Loaded> {
  const known = sniff(bytes)
  if (known && known.width * known.height <= MAX_PIXELS) {
    return { bytes, ...known, source }
  }
  if (process.platform !== 'darwin') {
    throw new Error(
      known
        ? `${known.width}×${known.height} is over ${MAX_PIXELS / 1e6} megapixels`
        : 'only PNG and JPEG pictures work here',
    )
  }
  const dir = mkdtempSync(join(tmpdir(), 'ttheme-attach-'))
  try {
    const from = join(dir, 'in')
    const to = join(dir, 'out.png')
    writeFileSync(from, bytes)
    const fit = !known || known.width * known.height > MAX_PIXELS ? ['--resampleHeightWidthMax', String(SIDE)] : []
    await run('sips', ['-s', 'format', 'png', ...fit, from, '--out', to]).catch(() => {
      throw new Error('that is not a picture macOS can read')
    })
    const png = new Uint8Array(readFileSync(to))
    const head = sniff(png)
    if (!head) {
      throw new Error('that is not a picture macOS can read')
    }
    return { bytes: png, ...head, source }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

export async function loadRef(ref: string, signal: AbortSignal): Promise<Loaded> {
  if (/^https?:\/\//i.test(ref)) {
    const response = await fetch(ref, { headers: { 'User-Agent': AGENT }, signal })
    if (!response.ok) {
      throw new Error(`${new URL(ref).host} answered ${response.status}`)
    }
    if (Number(response.headers.get('content-length') ?? 0) > LIMIT) {
      throw new Error('that picture is over 64 MB')
    }
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (/^text\/html/i.test(response.headers.get('content-type') ?? '')) {
      throw new Error(`${new URL(ref).host} sent a web page, not a picture — copy the image address instead`)
    }
    return normalize(bytes, ref)
  }
  if (statSync(ref).size > LIMIT) {
    throw new Error('that picture is over 64 MB')
  }
  return normalize(new Uint8Array(readFileSync(ref)), ref)
}

const sources = new Map<number, string>()

export const LOCAL: Site = {
  key: 'local',
  name: 'local',
  origin: 'file://',
  moved: false,
  cutouts: '',
  best: '',
  tagBudget: 0,
  vouched: true,
  tunneled: false,
  ansi: 7,
  ratings: { safe: new Set(), questionable: new Set(), explicit: new Set() },
  rate: () => '',
  postsUrl: () => '',
  countUrl: () => '',
  postUrl: () => '',
  pageUrl: (id) => sources.get(id) ?? '',
  parse: () => [],
  count: () => 0,
}

export function sourceLabel(source: string): string {
  if (/^https?:\/\//i.test(source)) {
    return ''
  }
  return source.split('/').pop() ?? source
}

export function remember(id: number, source: string): void {
  sources.set(id, source)
}

export function localId(bytes: Uint8Array): number {
  return Number.parseInt(createHash('sha1').update(bytes).digest('hex').slice(0, 8), 16) % KEY_SPAN
}

const MAC_CLIPBOARD = `ObjC.import('AppKit')
function run(argv) {
  const pb = $.NSPasteboard.generalPasteboard
  const files = pb.readObjectsForClassesOptions($([$.NSURL]), $({ NSPasteboardURLReadingFileURLsOnlyKey: true }))
  if (files && files.count > 0) {
    const out = []
    for (let i = 0; i < files.count; i++) out.push(files.objectAtIndex(i).path.js)
    return out.join('\\n')
  }
  for (const type of ['public.png', 'public.tiff', 'public.jpeg', 'public.heic']) {
    const data = pb.dataForType(type)
    if (!data || data.isNil()) continue
    if (type === 'public.png') {
      data.writeToFileAtomically(argv[0], true)
      return argv[0]
    }
    const rep = $.NSBitmapImageRep.imageRepWithData(data)
    if (rep.isNil()) continue
    rep.representationUsingTypeProperties($.NSBitmapImageFileTypePNG, $({})).writeToFileAtomically(argv[0], true)
    return argv[0]
  }
  const web = pb.readObjectsForClassesOptions($([$.NSURL]), $({}))
  if (web && web.count > 0) return web.objectAtIndex(0).absoluteString.js
  const text = pb.stringForType('public.utf8-plain-text')
  return text && !text.isNil() ? text.js : ''
}`

const WSL_CLIPBOARD = `Add-Type -AssemblyName System.Windows.Forms,System.Drawing
$c = [Windows.Forms.Clipboard]
$f = $c::GetFileDropList(); if ($f.Count) { $f; exit }
$p = Join-Path $env:TEMP 'ttheme-clipboard.png'
$s = $c::GetData('PNG'); if ($s -is [IO.MemoryStream]) { [IO.File]::WriteAllBytes($p, $s.ToArray()); $p; exit }
$i = $c::GetImage(); if ($i) { $i.Save($p, [Drawing.Imaging.ImageFormat]::Png); $p; exit }
$c::GetText()`

function wsl(): boolean {
  if (process.platform !== 'linux') {
    return false
  }
  try {
    return /microsoft/i.test(readFileSync('/proc/version', 'utf8'))
  } catch {
    return false
  }
}

export type Clip = { image: string } | { text: string }

async function unix(out: string): Promise<Clip> {
  const wayland = Boolean(process.env.WAYLAND_DISPLAY)
  const list = wayland ? ['wl-paste', ['--list-types']] : ['xclip', ['-selection', 'clipboard', '-t', 'TARGETS', '-o']]
  const types = (await run(list[0] as string, list[1] as string[])).stdout.split('\n').map((t) => t.trim())
  const read = (type: string) =>
    wayland
      ? run('wl-paste', ['--no-newline', '--type', type], { encoding: 'buffer', maxBuffer: LIMIT })
      : run('xclip', ['-selection', 'clipboard', '-t', type, '-o'], { encoding: 'buffer', maxBuffer: LIMIT })
  if (types.includes('text/uri-list')) {
    return { text: (await read('text/uri-list')).stdout.toString('utf8') }
  }
  const image = IMAGE_MIMES.find((type) => types.includes(type))
  if (image) {
    writeFileSync(out, (await read(image)).stdout)
    return { image: out }
  }
  return {
    text: types.some((type) => type.startsWith('text/plain') || type === 'UTF8_STRING')
      ? (await read(types.includes('text/plain') ? 'text/plain' : 'UTF8_STRING')).stdout.toString('utf8')
      : '',
  }
}

export function remote(): boolean {
  return Boolean(process.env.SSH_CONNECTION || process.env.SSH_TTY)
}

export async function readClipboard(out: string): Promise<Clip> {
  if (process.platform === 'darwin') {
    const got = (await run('osascript', ['-l', 'JavaScript', '-e', MAC_CLIPBOARD, out])).stdout.trim()
    return got === out ? { image: out } : { text: got }
  }
  if (wsl()) {
    const text = (await run('powershell.exe', ['-NoProfile', '-STA', '-Command', WSL_CLIPBOARD])).stdout
      .replace(/\r/g, '')
      .trim()
    const lines = await Promise.all(
      text
        .split('\n')
        .map(async (line) => (/^[A-Za-z]:\\/.test(line) ? (await run('wslpath', ['-u', line])).stdout.trim() : line)),
    )
    return lines.length === 1 && /ttheme-clipboard\.png$/.test(lines[0] ?? '')
      ? { image: lines[0] as string }
      : { text: lines.join('\n') }
  }
  if (process.platform === 'linux') {
    return unix(out)
  }
  throw new Error(`reading the clipboard is not supported on ${process.platform}`)
}

const MAC_PEEK = `ObjC.import('AppKit')
function run() {
  const pb = $.NSPasteboard.generalPasteboard
  const files = pb.readObjectsForClassesOptions($([$.NSURL]), $({ NSPasteboardURLReadingFileURLsOnlyKey: true }))
  let picture = false
  if (files && files.count > 0) {
    for (let i = 0; i < files.count; i++) picture ||= /\\.(png|jpe?g|gif|webp|heic|tiff?|bmp)$/i.test(files.objectAtIndex(i).path.js)
  } else {
    const types = pb.types.js.map((t) => t.js)
    picture = ['public.png', 'public.tiff', 'public.jpeg', 'public.heic'].some((t) => types.includes(t))
  }
  return pb.changeCount + '\\t' + (picture ? 'picture' : '')
}`

export async function peekClipboard(): Promise<{ stamp: string; picture: boolean } | undefined> {
  if (remote()) {
    return undefined
  }
  if (process.platform === 'darwin') {
    const [stamp = '', kind = ''] = (await run('osascript', ['-l', 'JavaScript', '-e', MAC_PEEK])).stdout
      .trim()
      .split('\t')
    return { stamp, picture: kind === 'picture' }
  }
  if (process.platform === 'linux' && !wsl()) {
    const wayland = Boolean(process.env.WAYLAND_DISPLAY)
    const types = wayland
      ? (await run('wl-paste', ['--list-types'])).stdout
      : (await run('xclip', ['-selection', 'clipboard', '-t', 'TARGETS', '-o'])).stdout
    return { stamp: types, picture: /^image\//m.test(types) }
  }
  return undefined
}

export function takeInbound(input: string): { events: Inbound[]; keys: string; pending: string } {
  const events: Inbound[] = []
  let keys = ''
  let i = 0
  while (i < input.length) {
    if (input[i] !== '\x1b') {
      keys += input[i]
      i++
      continue
    }
    if (input.startsWith('\x1b[200~', i)) {
      const end = input.indexOf('\x1b[201~', i + 6)
      if (end === -1) {
        return { events, keys, pending: input.slice(i) }
      }
      events.push({ kind: 'paste', text: input.slice(i + 6, end) })
      i = end + 6
      continue
    }
    if (input.startsWith('\x1b]5522;', i) || input.startsWith('\x1b]72;', i)) {
      const ends = [input.indexOf('\x1b\\', i), input.indexOf('\x07', i)].filter((at) => at !== -1)
      if (ends.length === 0) {
        return { events, keys, pending: input.slice(i) }
      }
      const end = Math.min(...ends)
      const body = input.slice(i + 2, end)
      const [code = '', meta = '', ...rest] = body.split(';')
      events.push({ kind: 'osc', code, meta: metadata(meta), payload: rest.join(';') })
      i = end + (input[end] === '\x07' ? 1 : 2)
      continue
    }
    const report = /^\[\?([\d;]*)(\$y|c)/.exec(input.slice(i + 1, i + 64))
    if (report) {
      if (report[2] === 'c') {
        events.push({ kind: 'attributes' })
      } else {
        const [mode = '0', value = '0'] = (report[1] ?? '').split(';')
        events.push({ kind: 'mode', mode: Number(mode), value: Number(value) })
      }
      i += 1 + report[0].length
      continue
    }
    if (/^(?:\[(?:\?[\d;$]*|2|20|200|201)?|\](?:5|55|552|5522|7|72)?)$/.test(input.slice(i + 1))) {
      return { events, keys, pending: input.slice(i) }
    }
    keys += input[i]
    i++
  }
  return { events, keys, pending: '' }
}

function metadata(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const pair of text.split(':')) {
    const at = pair.indexOf('=')
    if (at > 0) {
      out[pair.slice(0, at)] = pair.slice(at + 1)
    }
  }
  return out
}

const b64 = (text: string) => Buffer.from(text).toString('base64')
const unb64 = (text: string) => Buffer.from(text, 'base64')

function pick(offered: string[], wanted: string[]): string | undefined {
  return wanted.find((type) => offered.includes(type))
}

export class Grabber {
  clipboard = false
  drops = false
  private reading?: { mime: string; chunks: Buffer[]; pw: string; listing: boolean }
  private offered: string[] = []
  private dropping?: { mimes: string[]; index: number; chunks: Buffer[] }
  private readonly pw = b64(createHash('sha1').update(`${process.pid}:${Date.now()}`).digest('hex'))

  private readonly send: (text: string) => void
  private readonly deliver: (got: Got) => void

  constructor(send: (text: string) => void, deliver: (got: Got) => void) {
    this.send = send
    this.deliver = deliver
  }

  start(): void {
    let out = '\x1b[?2004h'
    if (this.clipboard) {
      out += '\x1b[?5522h'
    }
    if (this.drops) {
      out += `\x1b]72;t=a;${DROP_MIMES.join(' ')}\x1b\\`
    }
    this.send(out)
  }

  stop(): void {
    this.send(`\x1b[?2004l${this.clipboard ? '\x1b[?5522l' : ''}${this.drops ? '\x1b]72;t=A\x1b\\' : ''}`)
  }

  ask(): void {
    this.reading = { mime: '.', chunks: [], pw: '', listing: true }
    this.send(`\x1b]5522;type=read:name=${b64('ttheme')}:pw=${this.pw};${b64('.')}\x1b\\`)
  }

  take(event: Inbound & { kind: 'osc' }): void {
    if (event.code === '5522') {
      this.clip(event.meta, event.payload)
    } else if (event.code === '72') {
      this.drop(event.meta, event.payload)
    }
  }

  private clip(meta: Record<string, string>, payload: string): void {
    if (meta.type !== 'read') {
      return
    }
    const status = meta.status ?? ''
    if (status === 'OK') {
      this.reading ??= { mime: '.', chunks: [], pw: meta.pw ?? '', listing: true }
      if (meta.pw) {
        this.reading.pw = meta.pw
      }
      return
    }
    const reading = this.reading
    if (!reading) {
      return
    }
    if (status === 'DATA') {
      reading.mime = meta.mime ? unb64(meta.mime).toString('utf8') : reading.mime
      if (payload) {
        reading.chunks.push(unb64(payload))
      }
      return
    }
    this.reading = undefined
    if (status !== 'DONE') {
      this.deliver({
        kind: 'error',
        message: status === 'EPERM' ? 'the clipboard read was not allowed' : `the terminal answered ${status}`,
      })
      return
    }
    const data = Buffer.concat(reading.chunks)
    if (reading.listing) {
      const offered = data.toString('utf8').split(/\s+/).filter(Boolean)
      const mime = pick(offered, [...IMAGE_MIMES, ...TEXT_MIMES])
      if (!mime) {
        this.deliver({ kind: 'text', text: '' })
        return
      }
      const pw = reading.pw || this.pw
      const name = reading.pw ? 'Paste event' : 'ttheme'
      this.reading = { mime, chunks: [], pw, listing: false }
      this.send(`\x1b]5522;type=read:name=${b64(name)}:pw=${pw};${b64(mime)}\x1b\\`)
      return
    }
    this.deliver(
      reading.mime.startsWith('image/')
        ? { kind: 'bytes', bytes: new Uint8Array(data), source: 'clipboard' }
        : { kind: 'text', text: data.toString('utf8') },
    )
  }

  private drop(meta: Record<string, string>, payload: string): void {
    const type = meta.t ?? ''
    if (type === 'm') {
      if (meta.x === '-1') {
        this.offered = []
        return
      }
      if (payload) {
        this.offered = payload.split(' ').filter(Boolean)
        const wanted = DROP_MIMES.filter((mime) => this.offered.includes(mime))
        this.send(`\x1b]72;t=m:o=${wanted.length > 0 ? 1 : 0};${wanted.join(' ')}\x1b\\`)
      }
      return
    }
    if (type === 'M') {
      const mimes = payload ? payload.split(' ').filter(Boolean) : this.offered
      const mime = pick(mimes, DROP_MIMES)
      if (!mime) {
        this.send('\x1b]72;t=r:o=0\x1b\\')
        return
      }
      this.dropping = { mimes, index: mimes.indexOf(mime) + 1, chunks: [] }
      this.send(`\x1b]72;t=r:x=${this.dropping.index}\x1b\\`)
      return
    }
    const dropping = this.dropping
    if (!dropping) {
      return
    }
    if (type === 'R') {
      this.dropping = undefined
      this.send('\x1b]72;t=r:o=0\x1b\\')
      this.deliver({ kind: 'error', message: `the drop failed: ${payload.split(':')[0] || 'unknown error'}` })
      return
    }
    if (type !== 'r' && type !== '') {
      return
    }
    if (payload) {
      dropping.chunks.push(unb64(payload))
    }
    if (meta.m === '1' || payload) {
      return
    }
    this.dropping = undefined
    const data = Buffer.concat(dropping.chunks)
    const mime = dropping.mimes[dropping.index - 1] ?? ''
    let got: Got
    if (mime.startsWith('image/')) {
      got = { kind: 'bytes', bytes: new Uint8Array(data), source: 'drop' }
    } else {
      const text = data.toString('utf8')
      const file = mime === 'text/uri-list' ? pastedRefs(text).find((ref) => existsSync(ref)) : undefined
      got = file ? { kind: 'bytes', bytes: new Uint8Array(readFileSync(file)), source: file } : { kind: 'text', text }
    }
    this.send('\x1b]72;t=r:o=1\x1b\\')
    this.deliver(got)
  }
}
