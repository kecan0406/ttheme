export function advise(lines: readonly string[]): void {
  if (lines.length > 0 && process.stderr.isTTY) {
    process.stderr.write(`${lines.join('\n')}\n`)
  }
}
