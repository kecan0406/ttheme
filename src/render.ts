import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { isMainThread, parentPort, Worker } from 'node:worker_threads'
import {
  backgroundsDir,
  type Coloring,
  type Colors,
  type Framing,
  type Inked,
  imageKey,
  inked,
  installBackdrop,
  type Paint,
  type Picture,
  rackOf,
  type Tone,
  type Tune,
  tryOn,
  writeTune,
} from './backdrop.ts'
import { MAX_PIXELS } from './booru.ts'
import type { Hex } from './color.ts'
import { writeAtomic } from './edits.ts'
import { paletteMatch } from './fit.ts'
import { redrawOne } from './pictures.ts'
import { contain, decodeImage, encodeRgba, transparency } from './png.ts'
import { sameArtwork, shape } from './works.ts'

interface Thumb {
  job: 'thumb'
  from: string
  to: string
  width: number
  height: number
}

interface Band {
  job: 'band'
  from: string
  to: string
  y: number
  height: number
}

interface Match {
  job: 'match'
  from: string
  colors: Hex[]
}

interface Twin {
  job: 'twin'
  cut: string
  whole: string
}

interface Show {
  job: 'show'
  from: string
  cut: boolean
  to: string
  width: number
  height: number
  colors: Colors
  tone: Tone
  blur: number
  coloring: Coloring
  tune?: Partial<Framing>
}

interface Backdrop {
  job: 'backdrop'
  from: string
  source: string
  home: string
  colors: Colors
  tone: Tone
  origin: {
    site: string
    id: number
    ext: string
    from: string
    artist: string[]
    profiles: Record<string, string[]>
    source: string
  }
  width: number
  height: number
  blur: number
  coloring: Coloring
  tune?: Tune
  aligns?: boolean
  user?: string
}

export interface Shown {
  clear: number
  fill: number
  opacity: number
}

interface Redraw {
  job: 'redraw'
  home: string
  user: string
  name: string
  key: string
  paint: Paint
  blur: number
  aligns: boolean
}

export interface Look {
  match: number
  hash: string
}

type Task = Thumb | Band | Match | Twin | Show | Backdrop | Redraw
type Lane = 'tile' | 'band' | 'view'
type Result<T extends Task> = T extends Match
  ? Look
  : T extends Twin
    ? boolean
    : T extends Redraw
      ? Picture | null
      : T extends Show
        ? Shown
        : number

const LANES: Record<Task['job'], Lane> = {
  thumb: 'tile',
  band: 'band',
  match: 'tile',
  twin: 'view',
  show: 'view',
  backdrop: 'view',
  redraw: 'view',
}

let held: { from: string; clear: number; inked: Inked } | undefined

async function work(task: Task): Promise<number | boolean | Look | Picture | Shown | null> {
  if (task.job === 'twin') {
    const whole =
      held?.from === task.whole ? held.inked.image : decodeImage(new Uint8Array(readFileSync(task.whole)), MAX_PIXELS)
    return sameArtwork(decodeImage(new Uint8Array(readFileSync(task.cut)), MAX_PIXELS), whole)
  }
  if (task.job === 'redraw') {
    return redrawOne(task.home, task.name, task.key, task.paint, task.blur, task.aligns, task.user)
  }
  if (task.job === 'show') {
    if (held?.from !== task.from) {
      const image = decodeImage(new Uint8Array(readFileSync(task.from)), MAX_PIXELS)
      held = { from: task.from, clear: transparency(image), inked: inked(image, task.cut) }
    }
    const { image, fill, opacity } = tryOn(
      held.inked,
      task.colors,
      task.tone,
      task.width,
      task.height,
      task.blur,
      task.tune,
      task.coloring,
    )
    mkdirSync(dirname(task.to), { recursive: true })
    writeFileSync(task.to, encodeRgba(image))
    return { clear: held.clear, fill, opacity }
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
      task.coloring,
    )
    const picture = task.tune && rackOf(task.home, task.colors.name).find((p) => p.key === imageKey(task.origin))
    if (task.tune && picture) {
      writeTune(backgroundsDir(task.home), picture, task.tune, task.aligns ?? true, task.user ?? task.home)
    }
    return 0
  }
  if (task.job === 'match') {
    return { match: paletteMatch(image, task.colors), hash: shape(image) }
  }
  if (task.job === 'thumb') {
    writeAtomic(task.to, encodeRgba(contain(image, task.width, task.height)))
    return 0
  }
  const data = image.data.subarray(task.y * image.width * 4, (task.y + task.height) * image.width * 4)
  writeFileSync(task.to, encodeRgba({ width: image.width, height: task.height, data }))
  return 0
}

function serveRenders(port: NonNullable<typeof parentPort>): void {
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
