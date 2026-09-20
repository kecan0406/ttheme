import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { isMainThread, parentPort, Worker } from 'node:worker_threads'
import { type Colors, installBackdrop, type Tone, tryOn } from './backdrop.ts'
import { MAX_PIXELS } from './booru.ts'
import { contain, decodeImage, encodePng, transparency } from './png.ts'

interface Thumb {
  job: 'thumb'
  from: string
  to: string
  width: number
  height: number
}

interface Show {
  job: 'show'
  from: string
  to: string
  width: number
  height: number
  colors: Colors
  tone: Tone
}

interface Backdrop {
  job: 'backdrop'
  from: string
  source: string
  home: string
  colors: Colors
  tone: Tone
  origin: { site: string; id: number; ext: string; from: string }
}

type Task = Thumb | Show | Backdrop
type Lane = 'tile' | 'view'

const LANES: Record<Task['job'], Lane> = { thumb: 'tile', show: 'view', backdrop: 'view' }

function work(task: Task): number {
  const image = decodeImage(new Uint8Array(readFileSync(task.from)), MAX_PIXELS)
  if (task.job === 'backdrop') {
    installBackdrop(task.home, task.colors, task.tone, image, {
      ...task.origin,
      bytes: new Uint8Array(readFileSync(task.source)),
    })
    return 0
  }
  if (task.job === 'thumb') {
    mkdirSync(dirname(task.to), { recursive: true })
    writeFileSync(task.to, encodePng(contain(image, task.width, task.height)))
    return 0
  }
  const clear = transparency(image)
  mkdirSync(dirname(task.to), { recursive: true })
  writeFileSync(task.to, encodePng(tryOn(image, task.colors, task.tone, task.width, task.height, clear)))
  return clear
}

export function serveRenders(port: NonNullable<typeof parentPort>): void {
  port.on('message', (task: Task & { id: number }) => {
    try {
      port.postMessage({ id: task.id, value: work(task) })
    } catch (error) {
      port.postMessage({ id: task.id, error: error instanceof Error ? error.message : String(error) })
    }
  })
}

class Line {
  private worker?: Worker
  private next = 1
  private readonly waiting = new Map<number, { ok: (value: number) => void; no: (error: Error) => void }>()

  send(task: Task): Promise<number> {
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
    worker.on('message', ({ id, value, error }: { id: number; value?: number; error?: string }) => {
      const held = this.waiting.get(id)
      this.waiting.delete(id)
      if (this.waiting.size === 0) {
        worker.unref()
      }
      if (error !== undefined) {
        held?.no(new Error(error))
      } else {
        held?.ok(value as number)
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

  run(task: Task): Promise<number> {
    const lane = LANES[task.job]
    let line = this.lines.get(lane)
    if (!line) {
      line = new Line()
      this.lines.set(lane, line)
    }
    return line.send(task)
  }

  close(): void {
    for (const line of this.lines.values()) {
      line.close()
    }
    this.lines.clear()
  }
}

if (!isMainThread && parentPort) {
  serveRenders(parentPort)
}
