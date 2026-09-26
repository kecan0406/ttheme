import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { isMainThread, parentPort, Worker } from 'node:worker_threads'
import { type Colors, type Hue, installBackdrop, type Picture, type Tone, tryOn } from './backdrop.ts'
import { MAX_PIXELS } from './booru.ts'
import type { Hex } from './color.ts'
import { paletteMatch } from './fit.ts'
import { redrawOne } from './pictures.ts'
import { contain, decodeImage, encodePng, transparency } from './png.ts'
import { shape } from './works.ts'

interface Thumb {
  job: 'thumb'
  from: string
  to: string
  width: number
  height: number
}

interface Match {
  job: 'match'
  from: string
  colors: Hex[]
}

interface Show {
  job: 'show'
  from: string
  to: string
  width: number
  height: number
  colors: Colors
  tone: Tone
  blur: number
}

interface Backdrop {
  job: 'backdrop'
  from: string
  source: string
  home: string
  colors: Colors
  tone: Tone
  origin: { site: string; id: number; ext: string; from: string }
  width: number
  height: number
  blur: number
}

interface Redraw {
  job: 'redraw'
  home: string
  user: string
  name: string
  key: string
  hue: Hue
  blur: number
  aligns: boolean
}

export interface Look {
  match: number
  hash: string
}

type Task = Thumb | Match | Show | Backdrop | Redraw
type Lane = 'tile' | 'view'
type Result<T extends Task> = T extends Match ? Look : T extends Redraw ? Picture | null : number

const LANES: Record<Task['job'], Lane> = {
  thumb: 'tile',
  match: 'tile',
  show: 'view',
  backdrop: 'view',
  redraw: 'view',
}

async function work(task: Task): Promise<number | Look | Picture | null> {
  if (task.job === 'redraw') {
    return redrawOne(task.home, task.name, task.key, task.hue, task.blur, task.aligns, task.user)
  }
  const image = decodeImage(new Uint8Array(readFileSync(task.from)), MAX_PIXELS)
  if (task.job === 'backdrop') {
    installBackdrop(
      task.home,
      task.colors,
      task.tone,
      image,
      {
        ...task.origin,
        bytes: new Uint8Array(readFileSync(task.source)),
        cut: task.from !== task.source,
      },
      task,
      task.blur,
    )
    return 0
  }
  if (task.job === 'match') {
    return { match: paletteMatch(image, task.colors), hash: shape(image) }
  }
  if (task.job === 'thumb') {
    mkdirSync(dirname(task.to), { recursive: true })
    writeFileSync(task.to, encodePng(contain(image, task.width, task.height)))
    return 0
  }
  const clear = transparency(image)
  mkdirSync(dirname(task.to), { recursive: true })
  writeFileSync(task.to, encodePng(tryOn(image, task.colors, task.tone, task.width, task.height, task.blur)))
  return clear
}

export function serveRenders(port: NonNullable<typeof parentPort>): void {
  port.on('message', async (task: Task & { id: number }) => {
    try {
      port.postMessage({ id: task.id, value: await work(task) })
    } catch (error) {
      port.postMessage({ id: task.id, error: error instanceof Error ? error.message : String(error) })
    }
  })
}

class Line {
  private worker?: Worker
  private next = 1
  private readonly waiting = new Map<number, { ok: (value: unknown) => void; no: (error: Error) => void }>()

  send(task: Task): Promise<unknown> {
    const id = this.next++
    return new Promise((ok, no) => {
      const worker = this.open()
      this.waiting.set(id, { ok, no })
      worker.ref()
      worker.postMessage({ ...task, id })
    })
  }

  close(): void {
    void this.worker?.terminate()
    this.worker = undefined
    this.drop(new Error('renderer closed'))
  }

  private open(): Worker {
    if (this.worker) {
      return this.worker
    }
    const worker = new Worker(import.meta.filename)
    worker.unref()
    worker.on('message', ({ id, value, error }: { id: number; value?: unknown; error?: string }) => {
      const held = this.waiting.get(id)
      this.waiting.delete(id)
      if (this.waiting.size === 0) {
        worker.unref()
      }
      if (error !== undefined) {
        held?.no(new Error(error))
      } else {
        held?.ok(value)
      }
    })
    const lost = (error: unknown) => {
      if (this.worker === worker) {
        this.worker = undefined
      }
      this.drop(error instanceof Error ? error : new Error('renderer stopped'))
    }
    worker.on('error', lost)
    worker.on('exit', () => lost(undefined))
    this.worker = worker
    return worker
  }

  private drop(error: Error): void {
    for (const held of this.waiting.values()) {
      held.no(error)
    }
    this.waiting.clear()
  }
}

export class Renderer {
  private readonly lines = new Map<Lane, Line>()

  run<T extends Task>(task: T): Promise<Result<T>> {
    const lane = LANES[task.job]
    let line = this.lines.get(lane)
    if (!line) {
      line = new Line()
      this.lines.set(lane, line)
    }
    return line.send(task) as Promise<Result<T>>
  }

  close(): void {
    for (const line of this.lines.values()) {
      line.close()
    }
    this.lines.clear()
  }
}

export class Pool {
  private readonly lines: Line[]

  constructor(size: number) {
    this.lines = Array.from({ length: Math.max(1, size) }, () => new Line())
  }

  async map<T extends Task>(tasks: T[]): Promise<(Result<T> | Error)[]> {
    const results: (Result<T> | Error)[] = []
    let next = 0
    await Promise.all(
      this.lines.map(async (line) => {
        while (next < tasks.length) {
          const at = next++
          try {
            results[at] = (await line.send(tasks[at] as T)) as Result<T>
          } catch (error) {
            results[at] = error instanceof Error ? error : new Error(String(error))
          }
        }
      }),
    )
    return results
  }

  close(): void {
    for (const line of this.lines) {
      line.close()
    }
  }
}

if (!isMainThread && parentPort) {
  serveRenders(parentPort)
}
