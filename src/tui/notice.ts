import { markOf } from './parts.ts'
import { MARKS, type Paint } from './style.ts'

export function advise(lines: readonly string[]): void {
  if (lines.length > 0 && process.stderr.isTTY) {
    process.stderr.write(`${lines.join('\n')}\n`)
  }
}

export const UPDATE_HERE = '`ttheme update` updates it'

export function outdated(latest: string, running: string, how: string): string {
  return `ttheme ${latest} is out, you have ${running} — ${how}`
}

const KEPT_ON_UPDATE = 'keeps your palettes, pins and settings'

export function outdatedLines(p: Paint, latest: string, running: string, command: string): string[] {
  if (!p.color) {
    return ['', `UPDATE  ttheme ${latest} is out, you have ${running}`, `        \`${command}\` ${KEPT_ON_UPDATE}`, '']
  }

  return [
    '',
    `${markOf(p)}  ${p.alert(' UPDATE ')}  ttheme ${p.bold(p.warn(latest))} is out, you have ${running}`,
    `${' '.repeat(14)}${p.bold(command)} ${p.dim(KEPT_ON_UPDATE)}`,
    '',
  ]
}

export function installedLines(p: Paint, version: string): string[] {
  if (!p.color) {
    return ['', `ttheme ${version} is installed — new tabs run it, \`exec zsh\` runs it here`, '']
  }

  return [
    '',
    `${markOf(p)}  ${p.good(MARKS.ok)} ttheme ${p.bold(p.good(version))} is installed — new tabs run it, ${p.bold('exec zsh')} runs it here`,
    '',
  ]
}

export function updatedLine(p: Paint, version: string, url: string): string {
  return p.color ? `Updated to ${p.bold(p.good(version))}  ${url}` : `Updated to ${version}  ${url}`
}

export type Standing = 'unknown' | 'checking' | 'current' | 'newer' | 'failed'

export interface ReleaseLine {
  standing: Standing
  line: string
  notes?: string
}

export const STANDING_LINES: Record<Standing, string> = {
  unknown: 'v%1$s',
  checking: 'v%1$s',
  current: `${MARKS.ok} v%1$s`,
  newer: `${MARKS.update} v%2$s`,
  failed: `${MARKS.miss} v%1$s`,
}

export function standingLine(standing: Standing, running: string, latest = ''): string {
  return STANDING_LINES[standing].replace('%1$s', running).replace('%2$s', latest)
}
