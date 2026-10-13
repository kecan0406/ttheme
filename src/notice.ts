export function advise(lines: readonly string[]): void {
  if (lines.length > 0 && process.stderr.isTTY) {
    process.stderr.write(`${lines.join('\n')}\n`)
  }
}

export const UPDATE_HERE = '`ttheme update` updates it'

export function outdated(latest: string, running: string, how: string): string {
  return `ttheme ${latest} is out, you have ${running} — ${how}`
}
