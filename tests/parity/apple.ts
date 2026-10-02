import { appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const OURS = 'ttheme · '

export interface Bookmark {
  path: string
  ino: number
}

export interface Profile {
  colors: string[]
  image?: Bookmark
  at: number
}

export type Prefs = Record<string, Profile>

const dir = join(process.env.HOME ?? '', '.parity', 'terminal')

export function prefsOf(home: string): Prefs {
  const file = join(home, '.parity', 'terminal', 'prefs.json')
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Prefs) : {}
}

export function tabFile(home: string, n: string): string {
  return join(home, '.parity', 'terminal', `tab.${n}`)
}

function real(path: string): string {
  try {
    return realpathSync(path)
  } catch {
    return path
  }
}

function mark(path: string, was: Bookmark | undefined): Bookmark | undefined {
  if (was && existsSync(path) && statSync(path).ino === was.ino) {
    return was
  }
  return existsSync(path) ? { path: real(path), ino: statSync(path).ino } : undefined
}

function current(prefs: Prefs, name: string): boolean {
  if (!name || !existsSync(join(dir, 'loaded', name.replaceAll('/', '--')))) {
    return false
  }
  if (!name.startsWith(OURS)) {
    return true
  }
  const started = existsSync(join(dir, 'started')) ? Number(readFileSync(join(dir, 'started'), 'utf8').trim()) : 0
  const profile = prefs[name]
  return profile !== undefined && profile.at < started
}

function wear(tty: string, name: string, fallback: string): string {
  const prefs = prefsOf(process.env.HOME ?? '')
  const tab = tabFile(process.env.HOME ?? '', process.env.PT_TAB ?? '')
  const now = existsSync(tab) ? readFileSync(tab, 'utf8').trim() : ''
  const to = (profile: string) => {
    appendFileSync(join(dir, 'switch'), `${tty}\t${profile}\t${process.env.PT_TAB ?? ''}\n`)
    writeFileSync(tab, `${profile}\n`)
  }
  if (current(prefs, name)) {
    to(name)
    return 'worn'
  }
  if (now.startsWith(OURS) && fallback && current(prefs, fallback)) {
    to(fallback)
    return 'base'
  }
  return 'kept'
}

function write(base: string, rest: string[]): string {
  mkdirSync(dir, { recursive: true })
  const file = join(dir, 'prefs.json')
  const prefs = prefsOf(process.env.HOME ?? '')
  const keep = new Set<string>()
  let changed = false
  for (let i = 0; i + 21 < rest.length; i += 22) {
    const name = rest[i] as string
    const colors = rest.slice(i + 1, i + 21)
    const was = prefs[name]
    const image = rest[i + 21] === '-' ? prefs[base]?.image : mark(rest[i + 21] as string, was?.image)
    keep.add(name)
    const plain = was !== undefined && JSON.stringify(was.colors) === JSON.stringify(colors)
    if (plain && JSON.stringify(was?.image) === JSON.stringify(image)) {
      continue
    }
    prefs[name] = { colors, ...(image ? { image } : {}), at: plain && was ? was.at : Date.now() }
    changed = true
  }
  for (const name of Object.keys(prefs)) {
    if (name.startsWith(OURS) && !keep.has(name)) {
      delete prefs[name]
      changed = true
    }
  }
  writeFileSync(file, `${JSON.stringify(prefs)}\n`)
  return changed ? 'wrote' : 'same'
}

async function serve(): Promise<void> {
  let buf = ''
  for await (const chunk of process.stdin) {
    buf += chunk.toString()
    let at = buf.indexOf('\n')
    while (at >= 0) {
      const [verb, tty = '', name = '', fallback = ''] = buf.slice(0, at).split('\t')
      buf = buf.slice(at + 1)
      process.stdout.write(`${verb === 'tab' ? wear(tty, name, fallback) : 'kept'}\n`)
      at = buf.indexOf('\n')
    }
  }
}

if (import.meta.main) {
  const [verb = '', ...rest] = process.argv.slice(2)
  if (verb === 'serve') {
    await serve()
  } else if (verb === 'tab') {
    process.stdout.write(`${wear(rest[0] ?? '', rest[1] ?? '', rest[2] ?? '')}\n`)
  } else if (verb === 'write') {
    process.stdout.write(`${write(rest[0] ?? '', rest.slice(1))}\n`)
  } else if (verb === 'drop') {
    process.stdout.write(`${write('', [])}\n`)
  } else if (verb === 'loaded') {
    process.stdout.write(current(prefsOf(process.env.HOME ?? ''), rest[0] ?? '') ? '1\n' : '0\n')
  }
}
