function rgb(hex: string): string {
  const h = hex.replace('#', '')
  return [h.slice(0, 2), h.slice(2, 4), h.slice(4, 6)].map((c) => Number.parseInt(c, 16)).join(';')
}

export function ansiFg(color: string): string {
  return `\x1b[38;2;${rgb(color)}m`
}

export function ansiBar(bg: string, fg: string): string {
  return `\x1b[48;2;${rgb(bg)};38;2;${rgb(fg)}m`
}

export function ansiSquares(colors: string[], after = '\x1b[39m'): string {
  return `${colors.map((c) => `${ansiFg(c)}■`).join(' ')}${after}`
}
