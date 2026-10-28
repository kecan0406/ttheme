import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'

const KB = 1024

interface Budget {
  lines: number
  bytes?: number
}

export const ROOT_AGENTS: Budget = { lines: 150, bytes: 10 * KB }
export const AREA_AGENTS: Budget = { lines: 150, bytes: 12 * KB }
export const SKILL: Budget = { lines: 500 }

const lineCount = (text: string) => text.split('\n').length - (text.endsWith('\n') ? 1 : 0)

const kb = (bytes: number) => `${(bytes / KB).toFixed(1)} KB`

function filesOf(root: string): string[] {
  return execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    cwd: root,
    encoding: 'utf8',
  })
    .split('\n')
    .filter((file) => file !== '' && existsSync(join(root, file)))
}

function overruns(file: string, text: string, budget: Budget): string[] {
  const lines = lineCount(text)
  const bytes = Buffer.byteLength(text)

  return [
    ...(lines > budget.lines ? [`${file} is ${lines} lines, over its budget of ${budget.lines}`] : []),
    ...(budget.bytes !== undefined && bytes > budget.bytes
      ? [`${file} is ${kb(bytes)}, over its budget of ${kb(budget.bytes)}`]
      : []),
  ]
}

export function problems(root: string = join(import.meta.dirname, '..')): string[] {
  return filesOf(root).flatMap((file) => {
    const name = basename(file)

    if (name === 'CLAUDE.md') {
      return [
        `${file} stops Claude Code reading AGENTS.md beside it and below it; the instructions live in AGENTS.md alone`,
      ]
    }

    if (name === 'AGENTS.md') {
      return overruns(file, readFileSync(join(root, file), 'utf8'), file === name ? ROOT_AGENTS : AREA_AGENTS)
    }

    if (name === 'SKILL.md') {
      return overruns(file, readFileSync(join(root, file), 'utf8'), SKILL)
    }

    return []
  })
}

if (import.meta.main) {
  const found = problems()

  if (found.length > 0) {
    process.stderr.write(
      `${found.join('\n')}\nPut an area's rules in the AGENTS.md beside its code, and keep measurements, dates and history in the commit message.\n`,
    )
    process.exitCode = 1
  }
}
