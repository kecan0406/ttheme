import { MARKS } from './tui/style.ts'

export function advise(lines: readonly string[]): void {
  if (lines.length > 0 && process.stderr.isTTY) {
    process.stderr.write(`${lines.join('\n')}\n`)
  }
}

export const UPDATE_HERE = '`ttheme update` updates it'

export function outdated(latest: string, running: string, how: string): string {
  return `ttheme ${latest} is out, you have ${running} — ${how}`
}

export type Standing = 'unknown' | 'checking' | 'current' | 'newer' | 'failed'

export interface ReleaseLine {
  standing: Standing
  line: string
}

export const STANDING_LINES: Record<Standing, string> = {
  unknown: 'ttheme %s',
  checking: 'ttheme %s  checking…',
  current: `ttheme %s  ${MARKS.ok} up to date`,
  newer: `ttheme %s  ${MARKS.update} %s available`,
  failed: `ttheme %s  ${MARKS.miss} check failed`,
}

export function standingLine(standing: Standing, running: string, latest = ''): string {
  return STANDING_LINES[standing].replace('%s', running).replace('%s', latest)
}
