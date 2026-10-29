import { escapeHtml } from '@kitajs/html'

export type Lang = 'sh' | 'toml'

export type Role = 'plain' | 'cmd' | 'opt' | 'path' | 'var' | 'str' | 'comment' | 'key' | 'table' | 'num'

export interface Token {
  role: Role
  text: string
}

const SPACE = /\s+/y
const QUOTED = /"(?:[^"\\]|\\.)*"|'[^']*'/y
const OPERATOR = /&&|\|\||[|;<>]+/y
const SH_WORD = /[^\s"'|&;<>]+/y
const TOML_WORD = /[^\s"'#[\],={}]+/y
const ASSIGN = /^[A-Za-z_]\w*=/
const PATH = /^(?:~|\.{1,2}\/|\/)/
const NUMBER = /^[+-]?\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?$/
const TABLE = /^(\s*)(\[\[?[^\]]+\]\]?)(.*)$/
const KEY = /(?:[A-Za-z0-9_-]+|"[^"]*")/
const PAIR = new RegExp(`^(\\s*)(${KEY.source}(?:\\.${KEY.source})*)(\\s*=)(.*)$`)

function take(pattern: RegExp, line: string, at: number): string | undefined {
  pattern.lastIndex = at

  return pattern.exec(line)?.[0]
}

function wordRole(word: string, head: boolean): Role {
  if (ASSIGN.test(word)) return 'var'

  if (head) return 'cmd'

  if (word.startsWith('-')) return 'opt'

  if (word.startsWith('$')) return 'var'

  return PATH.test(word) ? 'path' : 'plain'
}

function shellTokens(line: string): Token[] {
  const out: Token[] = []
  let at = 0
  let head = true

  while (at < line.length) {
    const space = take(SPACE, line, at)

    if (space) {
      out.push({ role: 'plain', text: space })
      at += space.length
      continue
    }

    if (line[at] === '#') {
      out.push({ role: 'comment', text: line.slice(at) })
      break
    }

    const quoted = take(QUOTED, line, at)

    if (quoted) {
      out.push({ role: 'str', text: quoted })
      head = false
      at += quoted.length
      continue
    }

    const operator = take(OPERATOR, line, at)

    if (operator) {
      out.push({ role: 'plain', text: operator })
      head = true
      at += operator.length
      continue
    }

    const word = take(SH_WORD, line, at)

    if (word) {
      out.push({ role: wordRole(word, head), text: word })
      head = ASSIGN.test(word)
      at += word.length
      continue
    }

    out.push({ role: 'plain', text: line.slice(at, at + 1) })
    at += 1
  }

  return out
}

function valueTokens(line: string): Token[] {
  const out: Token[] = []
  let at = 0

  while (at < line.length) {
    const space = take(SPACE, line, at)

    if (space) {
      out.push({ role: 'plain', text: space })
      at += space.length
      continue
    }

    if (line[at] === '#') {
      out.push({ role: 'comment', text: line.slice(at) })
      break
    }

    const quoted = take(QUOTED, line, at)

    if (quoted) {
      out.push({ role: 'str', text: quoted })
      at += quoted.length
      continue
    }

    const word = take(TOML_WORD, line, at)

    if (word) {
      out.push({ role: word === 'true' || word === 'false' || NUMBER.test(word) ? 'num' : 'plain', text: word })
      at += word.length
      continue
    }

    out.push({ role: 'plain', text: line.slice(at, at + 1) })
    at += 1
  }

  return out
}

function tomlTokens(line: string): Token[] {
  const table = TABLE.exec(line)

  if (table) {
    const [, lead = '', name = '', rest = ''] = table

    return [{ role: 'plain', text: lead }, { role: 'table', text: name }, ...valueTokens(rest)]
  }

  const pair = PAIR.exec(line)

  if (pair) {
    const [, lead = '', key = '', equals = '', rest = ''] = pair

    return [
      { role: 'plain', text: lead },
      { role: 'key', text: key },
      { role: 'plain', text: equals },
      ...valueTokens(rest),
    ]
  }

  return valueTokens(line)
}

export function tokens(lang: Lang, line: string): Token[] {
  return lang === 'sh' ? shellTokens(line) : tomlTokens(line)
}

export function highlightHtml(lang: Lang, text: string): string {
  return text
    .split('\n')
    .map((line) =>
      tokens(lang, line)
        .map(({ role, text: piece }) =>
          role === 'plain' ? escapeHtml(piece) : `<span data-t="${role}">${escapeHtml(piece)}</span>`,
        )
        .join(''),
    )
    .join('\n')
}
