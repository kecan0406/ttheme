import { createInterface } from 'node:readline'
import { find, readCatalog, untuned } from './catalog.ts'
import type { Hex } from './color.ts'
import { renderTone, TONE_COLS, TONE_ROWS, toneFooter } from './editor-screen.ts'
import type { PaletteEntry } from './emit/manifest.ts'
import { PaletteEditor } from './palette-editor.ts'
import { configHome, readInstalled, sync } from './palettes.ts'
import type { Colors } from './seeds.ts'
import { overrideOf, readTone, tonedEntry, withTone, writeTone } from './tone.ts'

const FIELD = '\x1f'
const ITEM = '\x1e'

const NAMED = new Set([
  'up',
  'down',
  'left',
  'right',
  'home',
  'end',
  'pgup',
  'pgdn',
  'tab',
  'shift-tab',
  'shift-left',
  'shift-right',
  'enter',
  'esc',
  'backspace',
  'ctrl-c',
])

function colorsOf(entry: PaletteEntry): Colors {
  return {
    background: entry.background as Hex,
    foreground: entry.foreground as Hex,
    cursor: entry.cursor as Hex,
    selection: entry.selection as Hex,
    ansi: entry.ansi as Hex[],
  }
}

export class ToneSession {
  readonly editor: PaletteEditor
  private readonly base: PaletteEntry
  private cols = TONE_COLS
  private rows = TONE_ROWS
  private focused = true

  private readonly home: string
  private readonly name: string
  private readonly color: boolean

  constructor(home: string, name: string, color: boolean) {
    this.home = home
    this.name = name
    this.color = color
    this.base = find(untuned(home, readCatalog(home), false).palettes, name)
    const worn = tonedEntry(this.base, readTone(home)[name])
    this.editor = new PaletteEditor({
      title: 'Tone',
      name,
      colors: colorsOf(worn),
      original: colorsOf(this.base),
      variant: 'theme',
      signature: worn.signatureSlots,
      ...(worn.waived ? { waive: worn.waived } : {}),
      check: () => undefined,
    })
  }

  save(): string | undefined {
    try {
      const over = overrideOf(this.base, this.editor.list)
      writeTone(this.home, withTone(readTone(this.home), this.name, over))
      sync(this.home, readCatalog(this.home), readInstalled(this.home))
      this.editor.markSaved()
      return undefined
    } catch (error) {
      return error instanceof Error ? error.message : String(error)
    }
  }

  frame(status = 'ok', note?: string): string {
    const footer = toneFooter(this.editor)
    const act = this.editor.act ?? '-'
    this.editor.act = undefined
    const { lines, at } = renderTone(this.editor, this.cols, this.rows, this.color, this.focused)
    return [
      status,
      act,
      footer.mode,
      this.editor.dirty() ? '1' : '0',
      this.editor.shown().join(' '),
      footer.keys.map(([key]) => key).join(ITEM),
      footer.keys.map(([, label]) => label).join(ITEM),
      note ?? footer.note,
      String(at),
      ...lines,
    ].join(FIELD)
  }

  handle(line: string): string | undefined {
    const [verb = '', ...rest] = line.split(' ')
    const arg = rest.join(' ')
    if (verb === 'quit') {
      return undefined
    }
    if (verb === 'size') {
      const [cols, rows] = arg.split(' ').map(Number)
      this.cols = Math.max(30, cols ?? TONE_COLS)
      this.rows = Math.max(10, rows ?? TONE_ROWS)
    } else if (verb === 'focus') {
      this.focused = arg === '1'
    } else if (verb === 'key' && NAMED.has(arg)) {
      this.editor.press(arg)
    } else if (verb === 'ch') {
      const code = Number(arg)
      if (Number.isInteger(code) && code > 0) {
        this.editor.press(String.fromCharCode(code))
      }
    } else if (verb === 'save') {
      const problem = this.save()
      return problem === undefined ? this.frame('saved', 'Saved') : this.frame('error', problem)
    }
    return this.frame()
  }
}

export async function runTone(name: string): Promise<number> {
  const session = new ToneSession(configHome(), name, process.env.NO_COLOR === undefined)
  const lines = createInterface({ input: process.stdin })
  for await (const line of lines) {
    const reply = session.handle(line)
    if (reply === undefined) {
      break
    }
    process.stdout.write(`${reply}\n`)
  }
  lines.close()
  process.stdin.destroy()
  return 0
}
