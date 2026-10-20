import { readFileSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import { stem as fileStem } from '../core/theme.ts'

export const CONF_IMAGE = 'background-image'
export const CONF_FIT = 'background-image-fit'
export const CONF_OPACITY = 'background-image-opacity'
export const CONF_POSITION = 'background-image-position'

export const CONF_KEYS = [CONF_IMAGE, CONF_FIT, CONF_OPACITY, CONF_POSITION] as const

export const CONF_INCLUDE = 'config-file'
export const CONF_OPTIONAL = '?'
export const CONF_DEPTH = 4

export interface ProfileBackground {
  image: string
  opacity: number
  cover: boolean
  position: string
}

function readText(path: string): string | undefined {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return undefined
  }
}

function locate(dir: string, path: string, home: string): string {
  return path.startsWith('~/') ? join(home, path.slice(2)) : isAbsolute(path) ? path : join(dir, path)
}

export function readConf(file: string, dir: string, home: string): Map<string, string> | undefined {
  const set = new Map<string, string>()

  const read = (path: string, depth: number): boolean => {
    const text = readText(path)

    if (text === undefined) {
      return false
    }

    for (const line of text.split('\n')) {
      const m = /^([a-z-]+)\s*=\s*(.*?)\s*$/.exec(line)

      if (!m) {
        continue
      }

      if (m[1] === CONF_INCLUDE) {
        if (depth < CONF_DEPTH) {
          read(locate(dir, (m[2] as string).replace(/^\?/, ''), home), depth + 1)
        }
      } else {
        set.set(m[1] as string, m[2] as string)
      }
    }

    return true
  }

  return read(file, 0) ? set : undefined
}

export function readBackdrop(dir: string, name: string, home: string): ProfileBackground | undefined {
  const set = readConf(join(dir, `${fileStem(name)}.conf`), dir, home)

  if (!set) {
    return undefined
  }

  const image = set.get(CONF_IMAGE) ?? ''

  if (image === '') {
    return undefined
  }

  const opacity = Number(set.get(CONF_OPACITY) ?? 1)

  return {
    image: locate(dir, image, home),
    opacity: Number.isFinite(opacity) ? opacity : 1,
    cover: set.get(CONF_FIT) === 'cover',
    position: set.get(CONF_POSITION) ?? 'center',
  }
}

export function confReaderPython(): string[] {
  return [
    'def read(path, into, depth=0):',
    '    try:',
    "        with open(path, encoding='utf-8') as f:",
    '            lines = f.read().splitlines()',
    '    except OSError:',
    '        return False',
    '    for line in lines:',
    "        key, sep, value = line.partition('=')",
    '        key, value = key.strip(), value.strip()',
    "        if not sep or not key or key.startswith('#'):",
    '            continue',
    `        if key == '${CONF_INCLUDE}':`,
    `            if depth < ${CONF_DEPTH}:`,
    `                read(locate(value.lstrip('${CONF_OPTIONAL}')), into, depth + 1)`,
    '        else:',
    '            into[key] = value',
    '    return True',
  ]
}

const luaText = (text: string) => text.replace(/[\\^$*+?.()[\]{}|%-]/g, '%$&')

export function confReaderLua(): string[] {
  return [
    'local function read(path, into, depth)',
    "  local f = io.open(path, 'r')",
    '  if not f then',
    '    return false',
    '  end',
    '  for line in f:lines() do',
    "    local key, value = line:match('^%s*([%w%-]+)%s*=%s*(.-)%s*$')",
    `    if key == '${CONF_INCLUDE}' then`,
    `      if depth < ${CONF_DEPTH} then`,
    `        read(locate((value:gsub('^${luaText(CONF_OPTIONAL)}', ''))), into, depth + 1)`,
    '      end',
    '    elseif key then',
    '      into[key] = value',
    '    end',
    '  end',
    '  f:close()',
    '  return true',
    'end',
  ]
}
