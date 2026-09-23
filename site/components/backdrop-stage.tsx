'use client'

import { type CSSProperties, type DragEvent, type RefObject, useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { isCutout, layer, type Picture, paint, readPicture } from '@/lib/backdrop'
import type { Placement, Theme } from '@/lib/themes'
import { cn } from '@/lib/utils'
import { type Tab, TerminalWindow } from './terminal-window'

const TILE = 'aspect-[1880/1008] max-w-full'
const PRESS = 'rounded-[2px] aria-pressed:border-primary aria-pressed:text-foreground'

function pixels(element: Element): { width: number; height: number } {
  const box = element.getBoundingClientRect()
  const ratio = Math.min(2, window.devicePixelRatio || 1)
  return { width: Math.max(1, Math.round(box.width * ratio)), height: Math.max(1, Math.round(box.height * ratio)) }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`${file.name} is not an image this browser can read`))
    image.src = url
  }).finally(() => URL.revokeObjectURL(url))
}

function useRepaint(target: RefObject<Element | null>, draw: () => void) {
  useEffect(() => {
    const element = target.current
    if (!element) return
    let frame = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(draw)
    })
    observer.observe(element)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [target, draw])
}

function Backdrop({ theme, picture, placement }: { theme: Theme; picture: Picture | null; placement: Placement }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const draw = useCallback(() => {
    const element = canvas.current
    if (!element) return
    const { width, height } = pixels(element)
    element.width = width
    element.height = height
    paint(
      element,
      picture && layer(picture, placement, width, height),
      theme.background,
      theme.backdrop,
      theme.backdrop.opacity,
    )
  }, [theme, picture, placement])
  useEffect(draw, [draw])
  useRepaint(canvas, draw)
  return <canvas ref={canvas} className="absolute inset-0 size-full" />
}

function Wall({
  themes,
  current,
  picture,
  placement,
  full,
  onPick,
}: {
  themes: Theme[]
  current: Theme
  picture: Picture | null
  placement: Placement
  full: boolean
  onPick: (theme: Theme) => void
}) {
  const grid = useRef<HTMLDivElement>(null)
  const draw = useCallback(() => {
    const canvases = grid.current?.querySelectorAll('canvas')
    const first = canvases?.[0]
    if (!canvases || !first) return
    const { width, height } = pixels(first)
    const gray = picture && layer(picture, placement, width, height)
    canvases.forEach((element, index) => {
      const theme = themes[index] as Theme
      element.width = width
      element.height = height
      paint(element, gray, theme.background, theme.backdrop, full ? 1 : theme.backdrop.opacity)
    })
  }, [themes, picture, placement, full])
  useEffect(draw, [draw])
  useRepaint(grid, draw)

  return (
    <div ref={grid} className="grid grid-cols-[repeat(auto-fill,minmax(164px,1fr))] gap-1 @max-[560px]:grid-cols-2">
      {themes.map((theme) => (
        <button
          key={theme.name}
          type="button"
          aria-label={`${theme.name}, ${theme.group}`}
          aria-current={theme === current}
          onClick={() => onPick(theme)}
          style={{ '--pf': theme.foreground, '--pc': theme.cursor } as CSSProperties}
          className={cn(
            TILE,
            'group relative cursor-pointer overflow-hidden rounded-[2px] outline-offset-[-2px] hover:outline-1 hover:outline-(--pc) aria-[current=true]:outline-2 aria-[current=true]:outline-ring',
          )}
        >
          <canvas className="size-full" />
          <span className="absolute bottom-1 left-1.5 text-[10.5px] text-(--pf) opacity-0 transition-opacity group-hover:opacity-90 group-focus-visible:opacity-90 group-aria-[current=true]:opacity-90">
            {theme.name}
          </span>
        </button>
      ))}
    </div>
  )
}

export function BackdropStage({
  theme,
  themes,
  placement,
  picture,
  tabs,
  active,
  onSelect,
  onOpen,
  onPicture,
  onPick,
}: {
  theme: Theme
  themes: Theme[]
  placement: Placement
  picture: Picture | null
  tabs: Tab[]
  active: number
  onSelect: (id: number) => void
  onOpen: () => void
  onPicture: (picture: Picture) => void
  onPick: (theme: Theme) => void
}) {
  const [full, setFull] = useState(true)
  const [over, setOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const take = useCallback(
    async (file: File | undefined) => {
      if (!file) return
      if (!file.type.startsWith('image/')) {
        setError(`${file.name} is not an image — drop a PNG, JPEG or WebP`)
        return
      }
      try {
        onPicture(readPicture(await loadImage(file)))
        setError(null)
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason))
      }
    },
    [onPicture],
  )

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const file = [...(event.clipboardData?.files ?? [])].find((item) => item.type.startsWith('image/'))
      if (file) void take(file)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [take])

  const drag = (event: DragEvent<HTMLElement>, on: boolean) => {
    event.preventDefault()
    setOver(on)
  }

  const cutout = picture !== null && isCutout(picture, placement)
  const tone = theme.backdrop

  return (
    <section
      aria-label="backdrop"
      className="board-grid @container relative flex min-h-0 flex-col overflow-auto"
      onDragEnter={(event) => drag(event, true)}
      onDragOver={(event) => drag(event, true)}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setOver(false)
      }}
      onDrop={(event) => {
        drag(event, false)
        void take(event.dataTransfer.files[0])
      }}
    >
      <div className="mx-auto grid w-full max-w-[1180px] grid-cols-[minmax(0,1fr)_236px] items-start gap-x-7 gap-y-5 px-5 py-6 @max-[860px]:grid-cols-1 @max-[560px]:px-4">
        <TerminalWindow
          theme={theme}
          tabs={tabs}
          active={active}
          focus={null}
          onSelect={onSelect}
          onOpen={onOpen}
          backdrop={<Backdrop theme={theme} picture={picture} placement={placement} />}
        />

        <aside className="grid content-start gap-5 text-xs text-muted-foreground">
          <label
            className={cn(
              'grid cursor-pointer place-items-center gap-1 rounded-[3px] border border-dashed border-input bg-background px-3 py-5 text-center transition-colors hover:border-primary hover:text-foreground has-focus-visible:outline-2 has-focus-visible:outline-ring',
              over && 'border-primary text-foreground',
            )}
          >
            <input
              id="backdrop-file"
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => void take(event.target.files?.[0])}
            />
            <span className="text-[13px] text-foreground">{picture ? 'Try another picture' : 'Drop a picture'}</span>
            <span>or paste one, or click to choose</span>
            <span className="text-muted-foreground/70">tinted on this page — it never leaves your browser</span>
          </label>
          {error ? <p className="text-destructive">{error}</p> : null}

          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 tabular-nums">
            <dt>tint</dt>
            <dd className="flex items-center gap-2 text-foreground">
              <i className="size-3 rounded-full border" style={{ background: tone.color }} />
              {tone.slot}
            </dd>
            <dt>opacity</dt>
            <dd className="text-foreground">{tone.opacity.toFixed(2)}</dd>
            <dt>fit</dt>
            <dd className="text-foreground">cover · top-right</dd>
            <dt>picture</dt>
            <dd className="text-foreground">
              {picture ? `${cutout ? 'cut-out' : 'wallpaper'} · ${picture.clear}% clear` : 'none yet'}
            </dd>
          </dl>

          <p className="leading-relaxed">
            {cutout
              ? `A cut-out stands whole from its head, ${Math.round(placement.tall * 100)}% of the window tall and against the right edge.`
              : picture
                ? `Under ${placement.stands}% transparent, a picture is a wallpaper and covers the window from its top.`
                : 'ttheme tints a picture into each palette’s background and one signature color, as faint as its contrast floors allow.'}
          </p>
        </aside>
      </div>

      <section
        aria-label="every palette"
        className="mx-auto grid w-full max-w-[1180px] gap-3 px-5 pb-8 @max-[560px]:px-4"
      >
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
          <h2 className="font-pixel text-[17px] leading-none text-foreground">Every palette</h2>
          <span className="text-xs text-muted-foreground tabular-nums">
            {picture
              ? `${themes.length} palettes wearing it`
              : `${themes.length} palettes — drop a picture to dress them`}
          </span>
          <span className="ml-auto flex gap-1">
            <Button variant="line" size="xs" aria-pressed={full} className={PRESS} onClick={() => setFull(true)}>
              full tint
            </Button>
            <Button variant="line" size="xs" aria-pressed={!full} className={PRESS} onClick={() => setFull(false)}>
              as the terminal shows it
            </Button>
          </span>
        </div>
        <Wall themes={themes} current={theme} picture={picture} placement={placement} full={full} onPick={onPick} />
      </section>

      {over ? (
        <div className="pointer-events-none absolute inset-2 grid place-items-center rounded-md border-2 border-dashed border-primary bg-background/70 text-sm text-foreground">
          drop to tint it into every palette
        </div>
      ) : null}
    </section>
  )
}
