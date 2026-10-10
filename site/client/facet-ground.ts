import {
  type Corners,
  FACET_DRIFT,
  FACET_HEIGHT,
  FACET_LAMP,
  FACET_WIDTH,
  facetCenter,
  facetCorners,
  facetMesh,
  type Lean,
  type Point,
  raise,
  type Shade,
  shade,
} from '@/lib/facets'
import type { Theme } from '@/lib/themes'
import { SHOW_EVENT } from '@/lib/wear'
import { reducedMotion } from './dom'
import { current } from './wear'

type Lab = [number, number, number]

type Paint = { bg: Lab; tones: Lab[] }

type Turn = { from: Paint; to: Paint; start: number; lean: Point }

type Face = { paint: Paint; squash: number; lean: Lean; under: Paint | null }

const MESH = facetMesh()
const CENTERS = MESH.facets.map((facet) => facetCenter(facetCorners(MESH.points, facet)))
const SPAN = FACET_HEIGHT + FACET_DRIFT
const SPEED = 2
const TURN_MS = 360
const SHADOW = 0.06
const FOLLOW_MS = 120
const RISE_MS = 200
const PRESS_MS = 1000
const BUDGET = 8_000_000
const STAGE = '[data-lead-preview], sheet-browser [data-session]'

function linear(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

function encode(value: number): number {
  const clamped = Math.min(1, Math.max(0, value))
  return (clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055) * 255
}

function toLab(hex: string): Lab {
  const [r, g, b] = [1, 3, 5].map((at) => linear(Number.parseInt(hex.slice(at, at + 2), 16) / 255)) as Lab
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

function toRgb([lightness, a, b]: Lab): string {
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3
  const red = encode(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)
  const green = encode(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)
  const blue = encode(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)
  return `rgb(${red.toFixed(1)} ${green.toFixed(1)} ${blue.toFixed(1)})`
}

function colorOf(paint: Paint, tone: number, { tint, lift }: Shade): string {
  const [bl, ba, bb] = paint.bg
  const [tl, ta, tb] = paint.tones[tone] as Lab
  return toRgb([Math.min(1, Math.max(0, bl + (tl - bl) * tint + lift)), ba + (ta - ba) * tint, bb + (tb - bb) * tint])
}

function trace(
  context: CanvasRenderingContext2D,
  corners: Corners,
  center: Point,
  lean: Point,
  squash: number,
  color: string,
) {
  context.fillStyle = color
  context.strokeStyle = color
  context.beginPath()
  for (const corner of corners) {
    const fold = ((corner.x - center.x) * lean.x + (corner.y - center.y) * lean.y) * (1 - squash)
    context.lineTo(corner.x - fold * lean.x, corner.y - fold * lean.y)
  }
  context.closePath()
  context.fill()
  context.stroke()
}

class FacetGround extends HTMLElement {
  #canvas: HTMLCanvasElement | null = null
  #context: CanvasRenderingContext2D | null = null
  #resize: ResizeObserver | null = null
  #shown: Paint[] = []
  #turns: Turn[][] = []
  #client: Point | null = null
  #lamp: Point = { ...FACET_LAMP }
  #rise = 0
  #press: (Point & { at: number }) | null = null
  #frame = 0
  #last = 0

  connectedCallback() {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) return
    canvas.setAttribute('aria-hidden', 'true')
    this.append(canvas)
    this.#canvas = canvas
    this.#context = context
    const root = getComputedStyle(document.documentElement)
    const slot = (name: string) => root.getPropertyValue(name).trim()
    const paint = this.#paint(
      slot('--bg'),
      [0, 1, 2].map((index) => slot(`--sg${index}`) || slot('--cu')),
    )
    this.#shown = MESH.facets.map(() => paint)
    this.#turns = MESH.facets.map(() => [])
    this.#fit()
    this.#draw(performance.now(), null)
    this.querySelector('svg')?.remove()
    this.#resize = new ResizeObserver(() => {
      if (this.#fit()) this.#draw(performance.now(), this.#pointer())
    })
    this.#resize.observe(canvas)
    window.addEventListener('pointermove', this.#move, { passive: true })
    window.addEventListener('pointerdown', this.#down, { capture: true, passive: true })
    window.addEventListener('scroll', this.#scroll, { passive: true })
    document.addEventListener('pointerout', this.#out)
    document.addEventListener(SHOW_EVENT, this.#show)
  }

  disconnectedCallback() {
    this.#resize?.disconnect()
    cancelAnimationFrame(this.#frame)
    this.#frame = 0
    this.#canvas?.remove()
    this.#canvas = null
    window.removeEventListener('pointermove', this.#move)
    window.removeEventListener('pointerdown', this.#down, { capture: true })
    window.removeEventListener('scroll', this.#scroll)
    document.removeEventListener('pointerout', this.#out)
    document.removeEventListener(SHOW_EVENT, this.#show)
  }

  #paint(bg: string, tones: string[]): Paint {
    const context = this.#context as CanvasRenderingContext2D
    const hex = (color: string) => {
      context.fillStyle = '#000000'
      context.fillStyle = color
      return toLab(String(context.fillStyle))
    }
    return { bg: hex(bg), tones: tones.map(hex) }
  }

  #fit(): boolean {
    const canvas = this.#canvas as HTMLCanvasElement
    const area = Math.max(1, canvas.clientWidth * canvas.clientHeight)
    const scale = Math.min(2, window.devicePixelRatio || 1, Math.sqrt(BUDGET / area))
    const width = Math.round(canvas.clientWidth * scale)
    const height = Math.round(canvas.clientHeight * scale)
    if (canvas.width === width && canvas.height === height) return false
    canvas.width = width
    canvas.height = height
    return true
  }

  #view(): { scale: number; left: number; width: number } {
    const canvas = this.#canvas as HTMLCanvasElement
    const scale = canvas.height / SPAN
    const width = canvas.width / scale
    return { scale, left: (FACET_WIDTH - width) / 2, width }
  }

  #local(client: Point): Point {
    const box = (this.#canvas as HTMLCanvasElement).getBoundingClientRect()
    const { left, width } = this.#view()
    return { x: left + ((client.x - box.left) / box.width) * width, y: ((client.y - box.top) / box.height) * SPAN }
  }

  #pointer(): Point | null {
    return this.#client ? this.#local(this.#client) : null
  }

  #kick() {
    if (this.#frame) return
    this.#last = performance.now()
    this.#frame = requestAnimationFrame(this.#step)
  }

  #step = (now: number) => {
    this.#frame = 0
    const elapsed = Math.min(50, Math.max(0, now - this.#last))
    this.#last = now
    const pointer = this.#pointer()
    const goal = pointer ?? FACET_LAMP
    const follow = 1 - Math.exp(-elapsed / FOLLOW_MS)
    this.#lamp = {
      x: this.#lamp.x + (goal.x - this.#lamp.x) * follow,
      y: this.#lamp.y + (goal.y - this.#lamp.y) * follow,
    }
    const rise = pointer ? 1 : 0
    this.#rise += (rise - this.#rise) * (1 - Math.exp(-elapsed / RISE_MS))
    const turning = this.#draw(now, pointer)
    const resting =
      Math.hypot(goal.x - this.#lamp.x, goal.y - this.#lamp.y) < 0.5 && Math.abs(rise - this.#rise) < 0.003
    if (turning || !resting) this.#frame = requestAnimationFrame(this.#step)
  }

  #face(index: number, now: number): Face {
    const turns = this.#turns[index] as Turn[]
    while (turns[0] && now >= turns[0].start + TURN_MS) this.#shown[index] = (turns.shift() as Turn).to
    const turn = turns[0]
    if (!turn || now < turn.start)
      return { paint: this.#shown[index] as Paint, squash: 1, lean: { x: 0, y: -1, angle: 0 }, under: null }
    const progress = (now - turn.start) / TURN_MS
    const angle = Math.PI * progress * progress * (3 - 2 * progress)
    const front = angle < Math.PI / 2
    return {
      paint: front ? turn.from : turn.to,
      squash: Math.abs(Math.cos(angle)),
      lean: { ...turn.lean, angle: front ? angle : angle - Math.PI },
      under: turn.to,
    }
  }

  #draw(now: number, pointer: Point | null): boolean {
    const context = this.#context as CanvasRenderingContext2D
    const { scale, left, width } = this.#view()
    context.setTransform(scale, 0, 0, scale, -left * scale, 0)
    context.clearRect(left, 0, width, SPAN)
    context.lineWidth = 0.9
    context.lineJoin = 'round'
    const rise = this.#rise
    const points = pointer && rise > 0.001 ? MESH.points.map((point) => raise(point, pointer, rise)) : MESH.points
    let turning = false
    for (const [index, facet] of MESH.facets.entries()) {
      const { paint, squash, lean, under } = this.#face(index, now)
      turning ||= (this.#turns[index] as Turn[]).length > 0
      const corners = facetCorners(points, facet)
      if (corners.every((corner) => corner.x < left) || corners.every((corner) => corner.x > left + width)) continue
      const center = CENTERS[index] as Point
      if (under) {
        const { tint, lift } = shade(facet.tint, corners, this.#lamp)
        trace(
          context,
          corners,
          center,
          lean,
          1,
          colorOf(under, facet.tone, { tint, lift: lift - (1 - squash) * SHADOW }),
        )
      }
      const color = colorOf(paint, facet.tone, shade(facet.tint, corners, this.#lamp, lean))
      trace(context, corners, center, lean, squash, color)
    }
    return turning
  }

  #move = (event: PointerEvent) => {
    if (event.pointerType === 'touch' || reducedMotion()) return
    this.#client = { x: event.clientX, y: event.clientY }
    this.#kick()
  }

  #out = (event: PointerEvent) => {
    if (event.relatedTarget || !this.#client) return
    this.#client = null
    this.#kick()
  }

  #down = (event: PointerEvent) => {
    this.#press = { x: event.clientX, y: event.clientY, at: performance.now() }
  }

  #scroll = () => {
    if (this.#client) this.#kick()
  }

  #show = (event: Event) => {
    const theme = (event as CustomEvent<Theme>).detail
    if (!this.#canvas || theme.name === current()) return
    const to = this.#paint(
      theme.background,
      [0, 1, 2].map((index) => theme.signature[index] ?? theme.cursor),
    )
    const now = performance.now()
    if (reducedMotion()) {
      this.#shown = MESH.facets.map(() => to)
      this.#turns = MESH.facets.map(() => [])
      this.#draw(now, null)
      return
    }
    const origin = this.#local(this.#origin())
    for (const [index, center] of CENTERS.entries()) {
      const turns = this.#turns[index] as Turn[]
      const distance = Math.hypot(center.x - origin.x, center.y - origin.y)
      const lean =
        distance > 1 ? { x: (center.x - origin.x) / distance, y: (center.y - origin.y) / distance } : { x: 0, y: -1 }
      const arrive = now + distance / SPEED
      const active = turns[0] && turns[0].start <= now ? turns[0] : null
      this.#turns[index] = active
        ? [active, { from: active.to, to, start: Math.max(arrive, active.start + TURN_MS), lean }]
        : [{ from: this.#shown[index] as Paint, to, start: arrive, lean }]
    }
    this.#kick()
  }

  #origin(): Point {
    const press = this.#press
    if (press && performance.now() - press.at < PRESS_MS) return press
    const stage = document.querySelector(STAGE)?.getBoundingClientRect()
    if (stage && stage.bottom > 0 && stage.top < window.innerHeight)
      return { x: stage.left + stage.width / 2, y: stage.top + stage.height / 2 }
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 }
  }
}

customElements.define('facet-ground', FacetGround)
