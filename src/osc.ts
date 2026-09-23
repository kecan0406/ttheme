import { openSync, writeSync } from 'node:fs'
import { ReadStream } from 'node:tty'
import type { PaletteEntry } from './emit/manifest.ts'

const QUERY_CODES = ['10', '11', '12', '17', ...Array.from({ length: 16 }, (_, i) => `4;${i}`)]

export function colorless(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.NO_COLOR) || env.TERM === 'dumb'
}

export function paletteOsc(entry: PaletteEntry): string {
  return [
    `\x1b]11;${entry.background}\x1b\\`,
    `\x1b]10;${entry.foreground}\x1b\\`,
    `\x1b]12;${entry.cursor}\x1b\\`,
    `\x1b]17;${entry.selection}\x1b\\`,
    ...entry.ansi.map((c, i) => `\x1b]4;${i};${c}\x1b\\`),
  ].join('')
}

export function parseOscColors(text: string): Map<string, string> {
  const colors = new Map<string, string>()
  for (const part of text.split('\x1b')) {
    const match = part.match(/^\](\d+(?:;\d+)?);(rgba?:[0-9a-fA-F/]+)/)
    const [, code, value] = match ?? []
    if (code && value) {
      colors.set(code, value)
    }
  }
  return colors
}

export function restoreOsc(saved: ReadonlyMap<string, string>): string {
  return [...saved].map(([code, value]) => `\x1b]${code};${value}\x1b\\`).join('')
}

export async function queryTerminalColors(): Promise<Map<string, string>> {
  let fd: number
  let stream: ReadStream
  try {
    fd = openSync('/dev/tty', 'r+')
    stream = new ReadStream(fd)
    stream.setRawMode(true)
  } catch {
    return new Map()
  }
  try {
    writeSync(fd, QUERY_CODES.map((code) => `\x1b]${code};?\x1b\\`).join(''))
    let buffer = ''
    await new Promise<void>((resolve) => {
      const deadline = setTimeout(resolve, 120)
      stream.on('data', (chunk: Buffer) => {
        buffer += chunk.toString()
        if (parseOscColors(buffer).size >= QUERY_CODES.length) {
          clearTimeout(deadline)
          resolve()
        }
      })
    })
    return parseOscColors(buffer)
  } finally {
    stream.setRawMode(false)
    stream.destroy()
  }
}
