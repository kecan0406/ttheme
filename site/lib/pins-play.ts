import { paint, shortName, type Theme } from '@/lib/themes'
import { wearStyle } from '@/lib/wear'

export type Role = 'dim' | 'c2' | 'c3' | 'c6'

export interface Run {
  text: string
  role?: Role
  tip?: string
  chip?: string
  bold?: boolean
}

export interface ListRow {
  runs: Run[]
  live?: string
}

interface Caption {
  lead: string
  why: string
}

export interface Frame extends Caption {
  cwd: string
  tab: string
  local: string
  host: string | null
  command: string | null
  shell: Run[][]
  prompt: Run[]
  list: ListRow[]
}

export interface Swatch {
  label: string
  style: string
  cursor: string
  background: string
  foreground: string
}

interface Pin {
  key: string
  id: string
}

type Step =
  | { op: 'cd'; to: string; text: string }
  | { op: 'ssh'; host: string; text: string }
  | { op: 'exit'; text: string }

export interface PinsScript {
  start: string
  pins: Pin[]
  steps: Step[]
}

type Event =
  | { kind: 'start' | 'none' | 'leave' | 'back' }
  | { kind: 'enter' | 'switch' | 'stay'; rule: Pin; from: string | null; nearest: boolean }
  | { kind: 'ssh'; rule: Pin }

interface State {
  cwd: string
  spec: string
  pin: Pin | null
  base: string
  ssh: { host: string; back: string; spec: string | null } | null
}

const HOME = '~'

function isSsh(key: string): boolean {
  return key.startsWith('ssh:')
}

function isBelow(key: string): boolean {
  return key.endsWith('/**')
}

function baseOf(key: string): string {
  return isBelow(key) ? key.slice(0, -3) : key
}

function inside(path: string, base: string): boolean {
  return path === base || path.startsWith(`${base}/`)
}

function leaf(path: string): string {
  return path === HOME ? HOME : (path.split('/').at(-1) ?? path)
}

function upOf(path: string): string {
  const at = path.lastIndexOf('/')

  return at < 0 ? HOME : path.slice(0, at)
}

function walkTo(from: string, to: string): string {
  const parts = to === HOME || to.startsWith(`${HOME}/`) ? to.split('/') : [...from.split('/'), ...to.split('/')]
  const out: string[] = []

  for (const part of parts) {
    if (part === '' || part === '.') continue

    if (part === '..') {
      if (out.length > 1) out.pop()
      continue
    }

    out.push(part)
  }

  return out.join('/') || HOME
}

export function readPins(text: string, start: string | undefined, known: (id: string) => boolean): PinsScript {
  if (!start) throw new Error('a pins fence names its default palette: default="<publisher>/<slug>"')

  if (!known(start)) throw new Error(`a pins fence starts on ${start}, which is no built-in palette`)
  const [head = '', tail = ''] = text.split(/\n\s*\n/)

  const pins = head
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      const [key = '', id = '', ...rest] = line.trim().split(/\s+/)

      if (rest.length > 0 || !(key === HOME || key.startsWith(`${HOME}/`) || isSsh(key))) {
        throw new Error(`a pins fence takes a pin under ~ or on an ssh host, not ${line.trim()}`)
      }

      if (!known(id)) throw new Error(`a pins fence pins ${id}, which is no built-in palette`)

      return { key, id }
    })

  let cwd = HOME
  let host: string | null = null

  const steps = tail
    .split('\n')
    .filter((line) => line.trim())
    .map((line): Step => {
      const text = line.trim()
      const [verb, arg, ...rest] = text.split(/\s+/)

      if (verb === 'cd' && arg && rest.length === 0 && !host && !arg.startsWith('/')) {
        cwd = walkTo(cwd, arg)

        return { op: 'cd', to: cwd, text }
      }

      if (verb === 'ssh' && arg && rest.length === 0 && !host) {
        host = arg

        return { op: 'ssh', host: arg, text }
      }

      if (verb === 'exit' && !arg && host) {
        host = null

        return { op: 'exit', text }
      }

      throw new Error(`a pins fence plays cd under ~, ssh and exit, not ${text}`)
    })

  return { start, pins, steps }
}

function covering(path: string, pins: Pin[]): Pin[] {
  return pins.filter((pin) => !isSsh(pin.key) && (isBelow(pin.key) ? inside(path, baseOf(pin.key)) : path === pin.key))
}

function ruleOf(path: string, pins: Pin[]): Pin | null {
  let best: Pin | null = null
  let length = -1

  for (const pin of covering(path, pins)) {
    const base = baseOf(pin.key)

    if (base.length > length || (base.length === length && !isBelow(pin.key))) {
      best = pin
      length = base.length
    }
  }

  return best
}

function globOf(pattern: string): RegExp {
  const body = pattern
    .replace(/[.+^$()|[\]\\{}]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')

  return new RegExp(`^${body}$`)
}

function sshRuleOf(host: string, pins: Pin[]): Pin | null {
  const own = pins.find((pin) => pin.key === `ssh:${host}`)

  if (own) return own

  return pins
    .filter((pin) => isSsh(pin.key) && /[*?]/.test(pin.key) && globOf(pin.key.slice(4)).test(host))
    .reduce<Pin | null>((best, pin) => (best && best.key.length >= pin.key.length ? best : pin), null)
}

function step(state: State, next: Step, pins: Pin[]): Event {
  if (next.op === 'ssh') {
    const rule = sshRuleOf(next.host, pins)
    state.ssh = { host: next.host, back: state.spec, spec: rule ? rule.id : null }

    if (!rule) return { kind: 'none' }
    state.spec = rule.id

    return { kind: 'ssh', rule }
  }

  if (next.op === 'exit') {
    const left = state.ssh
    state.ssh = null

    if (left?.spec && state.spec === left.spec) state.spec = left.back

    return { kind: 'back' }
  }

  state.cwd = next.to
  const rule = ruleOf(next.to, pins)

  if (rule) {
    if (state.pin?.key === rule.key) return { kind: 'stay', rule, from: null, nearest: false }
    const from = state.pin?.key ?? null

    if (!state.pin) state.base = state.spec
    state.pin = rule
    state.spec = rule.id

    return { kind: from ? 'switch' : 'enter', rule, from, nearest: covering(next.to, pins).length > 1 }
  }

  if (!state.pin) return { kind: 'none' }
  state.pin = null
  state.spec = state.base

  return { kind: 'leave' }
}

function reach(rule: Pin, cwd: string): string {
  const base = baseOf(rule.key)

  if (!isBelow(rule.key)) return `${leaf(cwd)} has a pin of its own, on that folder alone`

  return cwd === base
    ? `${leaf(cwd)} has a pin that reaches everything below it`
    : `${leaf(cwd)} is below ${base}, and its pin reaches everything under it`
}

function caption(event: Event, cwd: string, host: string | null): Caption {
  switch (event.kind) {
    case 'start':
      return { lead: 'Starts on', why: 'A new tab opens on the default palette.' }
    case 'enter':
      return {
        lead: 'Now',
        why: `${reach(event.rule, cwd)}.${event.nearest ? ' The nearest pin above a folder wins.' : ''}`,
      }
    case 'switch':
      return event.from && !isBelow(event.from) && inside(cwd, event.from)
        ? {
            lead: 'Now',
            why: `The pin on ${event.from} covers that folder alone, so ${leaf(cwd)} falls back to the pin on ${baseOf(event.rule.key)}.`,
          }
        : { lead: 'Now', why: `${reach(event.rule, cwd)}. The nearest pin above a folder wins.` }
    case 'stay':
      return { lead: 'Still', why: `${reach(event.rule, cwd)}.` }
    case 'leave':
      return { lead: 'Back to', why: `No pin covers ${leaf(cwd)}, so the tab puts back what it showed before.` }
    case 'ssh':
      return { lead: 'Now', why: `${host} matches the pin on ${event.rule.key}, until the prompt comes back.` }
    case 'back':
      return { lead: 'Back to', why: 'The prompt came back, and so did what the tab showed before.' }
    case 'none':
      return host
        ? { lead: 'Still', why: `No pin matches ${host}, so nothing changes.` }
        : { lead: 'Still', why: `No pin covers ${leaf(cwd)}, so nothing changes.` }
  }
}

function promptOf(cwd: string, host: string | null): Run[] {
  if (host) return [{ text: `deploy@${host}:~$ `, role: 'c3' }]

  return [
    { text: cwd, role: 'c6' },
    { text: ' ❯ ', role: 'c2' },
  ]
}

interface Node {
  at: string
  prefix: Run[]
  label: string
  id: string
  note: string
  here: boolean
}

function tree(cwd: string, pins: Pin[]): Node[] {
  const own = new Map<string, string>()
  const below = new Map<string, string>()
  const parent = new Map<string, string>()
  const nodes: Node[] = []

  for (const pin of pins) {
    if (isSsh(pin.key)) continue

    if (isBelow(pin.key)) below.set(baseOf(pin.key), pin.id)
    else own.set(pin.key, pin.id)
  }

  const link = (from: string) => {
    let at = from

    while (at !== HOME && !parent.has(at)) {
      parent.set(at, upOf(at))
      at = upOf(at)
    }
  }

  for (const at of [...own.keys(), ...below.keys(), cwd]) link(at)

  const kids = (at: string) => [...parent.entries()].flatMap(([kid, up]) => (up === at ? [kid] : [])).sort()
  const pinned = (at: string) => own.get(at) ?? below.get(at) ?? ''

  const under = (at: string) =>
    [...below.entries()]
      .filter(([base]) => inside(at, base))
      .reduce((best, [base, id]) => (base.length > best.length ? { length: base.length, id } : best), {
        length: -1,
        id: '',
      }).id

  const chain = (from: string, name: string) => {
    let at = from
    let label = name

    while (!pinned(at) && at !== cwd) {
      const only = kids(at)

      if (only.length !== 1) break
      at = only[0] as string
      label += `/${leaf(at)}`
    }

    return { at, label }
  }

  const add = (at: string, prefix: Run[], label: string) => {
    const note = own.has(at) ? 'this directory' : below.has(at) ? 'and below' : ''
    nodes.push({ at, prefix, label, id: pinned(at), note, here: at === cwd })
  }

  const walk = (at: string, prefix: Run[]) => {
    const tip = under(at)
    const all = kids(at)

    all.forEach((kid, index) => {
      const last = index === all.length - 1
      const next = chain(kid, leaf(kid))
      const glyph: Run = tip ? { text: last ? '└── ' : '├── ', tip } : { text: last ? '└── ' : '├── ', role: 'dim' }
      add(next.at, [...prefix, glyph], `${next.label}/`)
      walk(next.at, [...prefix, last ? { text: '    ' } : { ...glyph, text: '│   ' }])
    })
  }

  const root = chain(HOME, HOME)
  add(root.at, [], root.label)
  walk(root.at, [])
  const hosts = pins.filter((pin) => isSsh(pin.key))

  if (hosts.length > 0) {
    nodes.push({ at: 'ssh:', prefix: [], label: 'ssh', id: '', note: '', here: false })
    hosts.forEach((pin, index) => {
      const glyph = index < hosts.length - 1 ? '├── ' : '└── '
      nodes.push({
        at: pin.key,
        prefix: [{ text: glyph, role: 'dim' }],
        label: pin.key.slice(4),
        id: pin.id,
        note: 'while connected',
        here: false,
      })
    })
  }

  return nodes
}

function listOf(state: State, pins: Pin[], label: (id: string) => string): ListRow[] {
  const nodes = tree(state.cwd, pins)
  const rule = ruleOf(state.cwd, pins)
  const live = state.ssh ? sshRuleOf(state.ssh.host, pins) : rule
  const liveAt = live ? (isSsh(live.key) ? live.key : baseOf(live.key)) : null

  const width = (node: Node) =>
    node.prefix.reduce((sum, run) => sum + run.text.length, 0) + node.label.length + (node.here ? 7 : 0)

  const pinnedNodes = nodes.filter((node) => node.id)
  const widest = Math.max(0, ...pinnedNodes.map(width))
  const namew = Math.max(0, ...pinnedNodes.map((node) => label(node.id).length))
  const chip = (id: string, size: number): Run => ({ text: ` ${label(id).padEnd(size)} `, chip: id })

  const rows: ListRow[] = nodes.map((node) => {
    const runs: Run[] = [...node.prefix, node.id ? { text: node.label, bold: true } : { text: node.label, role: 'dim' }]

    if (node.here) runs.push(rule ? { text: ' ← here', tip: rule.id, bold: true } : { text: ' ← here', bold: true })

    if (node.id) {
      runs.push({ text: ' '.repeat(widest - width(node) + 2) }, chip(node.id, namew), {
        text: `  ${node.note}`,
        role: 'dim',
      })
    }

    return live && node.at === liveAt ? { runs, live: live.id } : { runs }
  })

  const here: Run[] = rule
    ? [
        { text: 'Here · ' },
        chip(rule.id, label(rule.id).length),
        {
          text: ` pinned to ${baseOf(rule.key) === state.cwd ? 'this directory' : baseOf(rule.key)}${isBelow(rule.key) ? ' and below' : ''}`,
        },
      ]
    : [{ text: 'Here · no pin — the tab’s own palette' }]

  return [{ runs: [...promptOf(state.cwd, null), { text: 'ttheme pins' }] }, ...rows, { runs: [] }, { runs: here }]
}

export function playPins(script: PinsScript, label: (id: string) => string = shortName): Frame[] {
  const state: State = { cwd: HOME, spec: script.start, pin: null, base: script.start, ssh: null }
  const shell: Run[][] = []

  const frame = (event: Event, command: string | null): Frame => {
    const host = state.ssh?.host ?? null

    return {
      cwd: state.cwd,
      tab: state.spec,
      local: state.ssh ? state.ssh.back : state.spec,
      host,
      command,
      ...caption(event, state.cwd, host),
      shell: [...shell],
      prompt: promptOf(state.cwd, host),
      list: listOf(state, script.pins, label),
    }
  }

  const frames = [frame({ kind: 'start' }, null)]

  for (const next of script.steps) {
    shell.push([...promptOf(state.cwd, state.ssh?.host ?? null), { text: next.text }])
    frames.push(frame(step(state, next, script.pins), next.text))
  }

  return frames
}

export function idsOf(script: PinsScript): string[] {
  return [...new Set([script.start, ...script.pins.map((pin) => pin.id)])]
}

export function swatchOf(theme: Theme): Swatch {
  return {
    label: shortName(theme.id),
    style: wearStyle(theme),
    cursor: paint(theme, (shade) => shade.cursor),
    background: paint(theme, (shade) => shade.background),
    foreground: paint(theme, (shade) => shade.foreground),
  }
}
