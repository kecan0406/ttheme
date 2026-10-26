import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { ROOT } from '../root.ts'

const WORDS: [RegExp, string][] = [
  [/\b(wear|wears|wearing|worn)\b/i, 'use, or shows'],
  [/\b(paint|paints|painted)\b/i, 'use, or shows'],
  [/\bgate\b/i, 'contrast checks'],
  [/\bmisses\b/i, 'fails'],
  [/\btone\b/i, 'tuning, or tinted'],
  [/\b(image|images)\b/i, 'picture'],
  [/\b(slot|slots)\b/i, 'color'],
  [/\bread in place\b/i, 'always up to date'],
  [/\bcomes with ttheme\b/i, 'built in, or updates with ttheme'],
]

const KEPT = [/\bimage (address|boards?)\b/gi, /\bImage Editing\b/g]

function texts(code: string): string[] {
  const out: string[] = []
  let at = 0

  while (at < code.length) {
    const quote = code[at] as string

    if (quote !== "'" && quote !== '"' && quote !== '`') {
      at++
      continue
    }

    let text = ''
    let depth = 0
    at++

    while (at < code.length && (depth > 0 || code[at] !== quote)) {
      const ch = code[at] as string

      if (ch === '\\') {
        at += 2
        continue
      }

      if (quote === '`' && depth === 0 && code.startsWith('${', at)) {
        depth = 1
        at += 2
        text += ' '
        continue
      }

      if (depth > 0) {
        depth += ch === '{' ? 1 : ch === '}' ? -1 : 0
      } else if (ch === '\n' && quote !== '`') {
        break
      } else {
        text += ch
      }

      at++
    }

    at++
    out.push(text)
  }

  return out
}

function prose(markdown: string): string {
  return markdown
    .replace(/^```[\s\S]*?^```$/gm, '')
    .replace(/`[^`\n]*`/g, '')
    .replace(/\]\([^)]*\)/g, ']')
}

function misses(file: string, texts: string[]): string[] {
  return texts.flatMap((text) => {
    const said = KEPT.reduce((line, kept) => line.replace(kept, ''), text)

    return WORDS.flatMap(([word, instead]) => (word.test(said) ? [`${file}: '${said.trim()}' — say ${instead}`] : []))
  })
}

test('the screens and the docs say one word for one concept, as CONTRIBUTING lists them', () => {
  const screens = readdirSync(join(ROOT, 'src', 'tui'), { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
    .flatMap((file) =>
      misses(
        `src/tui/${file}`,
        texts(readFileSync(join(ROOT, 'src', 'tui', file), 'utf8')).filter((text) => text.trim().includes(' ')),
      ),
    )

  const docs = readdirSync(join(ROOT, 'docs'), { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.md'))
    .flatMap((file) => misses(`docs/${file}`, prose(readFileSync(join(ROOT, 'docs', file), 'utf8')).split('\n')))

  assert.deepEqual([...screens, ...docs], [])
})
