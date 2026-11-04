import { TileTicks } from '@/components/work-parts'
import { html } from '@/lib/render'
import { lookStyle, type SearchPalette } from '@/lib/search'
import { fill } from './dom'
import { afterPaint } from './palettes'
import { heldIndex, searchIndex } from './search-index'

interface Scrub {
  tile: HTMLElement
  left: number
  width: number
  palettes: SearchPalette[]
  resting: string | null
  at: number
}

const CURSOR = 2

function palettesOf(tile: HTMLElement): SearchPalette[] {
  const id = tile.closest<HTMLElement>('[data-work]')?.dataset.work

  return heldIndex()?.works.find((work) => work.id === id)?.palettes ?? []
}

export function tileScrub(host: HTMLElement): () => void {
  let scrub: Scrub | null = null
  let warmed = false

  const end = () => {
    if (!scrub) return
    const { tile, resting } = scrub
    scrub = null

    if (resting === null) tile.removeAttribute('style')
    else tile.setAttribute('style', resting)
    tile.removeAttribute('data-scrubbing')

    const native = tile.querySelector<HTMLElement>('[data-tile-native]')
    const palette = tile.querySelector<HTMLElement>('[data-tile-palette]')

    if (native) native.hidden = false

    if (palette) palette.hidden = true
  }

  const warm = () => {
    if (warmed) return
    warmed = true
    afterPaint(() => {
      searchIndex().catch(() => {
        warmed = false
      })
    })
  }

  const begin = (tile: HTMLElement) => {
    const palettes = palettesOf(tile)

    if (!heldIndex()) warm()

    if (palettes.length < 2) return
    const { left, width } = tile.getBoundingClientRect()

    scrub = { tile, left, width, palettes, resting: tile.getAttribute('style'), at: -1 }
    tile.setAttribute('data-scrubbing', '')
    const native = tile.querySelector<HTMLElement>('[data-tile-native]')
    const palette = tile.querySelector<HTMLElement>('[data-tile-palette]')

    if (native) native.hidden = true

    if (palette) palette.hidden = false
    fill(
      tile.querySelector('[data-ticks]'),
      html(TileTicks({ colors: palettes.map((one) => one.look[CURSOR] ?? ''), at: -1 })),
    )
  }

  const go = (x: number) => {
    if (!scrub) return
    const { tile, left, width, palettes } = scrub
    const count = palettes.length
    const at = Math.max(0, Math.min(count - 1, Math.floor(((x - left) / width) * count)))

    if (at === scrub.at) return
    scrub.at = at
    const palette = palettes[at] as SearchPalette
    tile.setAttribute('style', lookStyle(palette.look))
    const name = tile.querySelector('[data-tile-palette]')

    if (name) name.textContent = palette.slug
    const ticks = tile.querySelector('[data-ticks]')?.children ?? []

    for (const [index, tick] of [...ticks].entries()) tick.toggleAttribute('data-on', index === at)
  }

  const moved = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return
    const tile = (event.target as Element).closest<HTMLElement>('[data-tile]')

    if (tile !== (scrub?.tile ?? null)) {
      end()

      if (tile) begin(tile)
    }

    go(event.clientX)
  }

  host.addEventListener('pointermove', moved, { passive: true })
  host.addEventListener('pointerleave', end)
  window.addEventListener('pagehide', end)

  return () => {
    end()
    host.removeEventListener('pointermove', moved)
    host.removeEventListener('pointerleave', end)
    window.removeEventListener('pagehide', end)
  }
}
