import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { parse } from 'smol-toml'
import { check } from './contrast.ts'
import { paletteEntry } from './emit/manifest.ts'
import { draftOf, gateLines, paletteToml, shareCode } from './own.ts'
import { authorOf, COMMUNITY, loadThemes, nameProblem } from './theme.ts'

const THEMES = join(import.meta.dirname, '..', 'themes')

export function paletteOf(body: string): string {
  const fenced = /```(?:toml)?[^\n]*\n([\s\S]*?)\n```/.exec(body)?.[1]
  const section = /###\s*Palette\s*\n([\s\S]*)$/.exec(body)?.[1]
  const source = (fenced ?? section ?? body).trim()
  if (source === '' || source === '_No response_') {
    throw new Error('the issue holds no palette — `ttheme submit <palette>` fills it in')
  }
  return `${source}\n`
}

export function runIntake(bodyFile: string, login: string): void {
  const source = paletteOf(readFileSync(bodyFile, 'utf8'))
  let name: unknown
  try {
    name = (parse(source) as { meta?: { name?: unknown } }).meta?.name
  } catch (error) {
    throw new Error(`the palette is not valid TOML — ${(error as Error).message.split('\n')[0]}`)
  }
  if (typeof name !== 'string' || nameProblem(name) || !authorOf(name)) {
    throw new Error(`meta.name must be <your GitHub handle>/<palette>, got ${JSON.stringify(name)}`)
  }
  const author = authorOf(name) as string
  if (author !== login.toLowerCase()) {
    throw new Error(
      `${name} is named after ${author}, but this issue is from ${login} — a palette carries its author's handle`,
    )
  }
  const path = join(THEMES, COMMUNITY, author, `${name.slice(author.length + 1)}.toml`)
  const before = existsSync(path) ? readFileSync(path, 'utf8') : undefined
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, source)
  try {
    const theme = loadThemes(THEMES).find((t) => t.name === name)
    if (!theme) {
      throw new Error(`${name} did not load`)
    }
    const violations = check(theme)
    if (violations.length > 0) {
      throw new Error(
        `it fails the contrast gate — \`ttheme check --fix ${name}\` suggests colors that pass:\n${violations.map((v) => `  ${v.rule}: ${v.detail}`).join('\n')}`,
      )
    }
    const entry = paletteEntry(theme)
    const draft = {
      ...draftOf(entry, name, theme.waiveReason),
      ...(theme.pictures ? { pictures: theme.pictures } : {}),
    }
    writeFileSync(path, paletteToml(draft))
    console.log(
      JSON.stringify({
        name,
        path: join('themes', COMMUNITY, author, `${name.slice(author.length + 1)}.toml`),
        updating: before !== undefined,
        code: shareCode(draft),
        gate: gateLines(entry),
      }),
    )
  } catch (error) {
    if (before === undefined) {
      rmSync(path)
    } else {
      writeFileSync(path, before)
    }
    throw error
  }
}
