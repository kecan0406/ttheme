function rgb(hex: string): string {
  const h = hex.replace('#', '')
  return [h.slice(0, 2), h.slice(2, 4), h.slice(4, 6)].map((c) => Number.parseInt(c, 16)).join(';')
}

export function ansiChip(text: string, bg: string): string {
  return `\x1b[48;2;${rgb(bg)}m ${text} \x1b[0m`
}

export function ansiDot(bg: string, fg: string): string {
  return `\x1b[48;2;${rgb(bg)};38;2;${rgb(fg)}m ● \x1b[0m`
}

export function ansiFg(color: string): string {
  return `\x1b[38;2;${rgb(color)}m`
}

export function ansiSwatch(colors: string[], bg: string): string {
  return `\x1b[48;2;${rgb(bg)}m${colors.map((c) => `\x1b[38;2;${rgb(c)}m▄`).join('')} \x1b[0m`
}
