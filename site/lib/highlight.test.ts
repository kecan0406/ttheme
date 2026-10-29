import { expect, test } from 'bun:test'
import { highlightHtml, type Lang, tokens } from './highlight'

function named(lang: Lang, line: string): string[] {
  return tokens(lang, line)
    .filter(({ role }) => role !== 'plain')
    .map(({ role, text }) => `${role}:${text}`)
}

test('a shell line names its commands, options, paths, variables, strings and comment', () => {
  expect(named('sh', 'DEBUG=1 tool run --fast ~/work $HOME "a b" | other && done # note')).toEqual([
    'var:DEBUG=1',
    'cmd:tool',
    'opt:--fast',
    'path:~/work',
    'var:$HOME',
    'str:"a b"',
    'cmd:other',
    'cmd:done',
    'comment:# note',
  ])
})

test('a name with a slash is an argument, not a path', () => {
  expect(named('sh', 'tool use alice/pastel @scope/pkg@latest')).toEqual(['cmd:tool'])
})

test('toml names its tables, keys, strings, numbers and comments', () => {
  expect(named('toml', '[[palette]]')).toEqual(['table:[[palette]]'])
  expect(named('toml', 'slug = "a#b"   # note')).toEqual(['key:slug', 'str:"a#b"', 'comment:# note'])
  expect(named('toml', '"$schema" = "x"')).toEqual(['key:"$schema"', 'str:"x"'])
  expect(named('toml', 'pair.nested = [ 1, 0.4, true, word ]')).toEqual([
    'key:pair.nested',
    'num:1',
    'num:0.4',
    'num:true',
  ])
})

test('markup in the text is escaped and an unterminated quote ends the line', () => {
  const out = highlightHtml('sh', 'say "open <b>')

  expect(out).toContain('&lt;')
  expect(out).not.toContain('<b>')
  expect(out.startsWith('<span data-t="cmd">say</span>')).toBe(true)
})
