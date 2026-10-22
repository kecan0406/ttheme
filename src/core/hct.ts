import { argbFromHex, Hct, hexFromArgb } from '@material/material-color-utilities'
import type { Hex } from './color.ts'

export interface Hued {
  hue: number
  chroma: number
  tone: number
}

const SEEN_MOST = 65_536

const READ = new Map<Hex, Hued>()

const SOLVED = new Map<number, Map<number, Map<number, Hex>>>()

let solved = 0

function remember(hex: Hex, hct: Hct): Hued {
  if (READ.size >= SEEN_MOST) {
    READ.clear()
  }

  const hued = Object.freeze({ hue: hct.hue, chroma: hct.chroma, tone: hct.tone })
  READ.set(hex, hued)

  return hued
}

export function hctOf(hex: Hex): Hued {
  return READ.get(hex) ?? remember(hex, Hct.fromInt(argbFromHex(hex)))
}

export function hctHex(hue: number, chroma: number, tone: number): Hex {
  let byChroma = SOLVED.get(hue)
  let byTone = byChroma?.get(chroma)
  const found = byTone?.get(tone)

  if (found !== undefined) return found

  if (solved >= SEEN_MOST) {
    SOLVED.clear()
    solved = 0
    byChroma = undefined
    byTone = undefined
  }

  if (byChroma === undefined) {
    byChroma = new Map()
    SOLVED.set(hue, byChroma)
  }

  if (byTone === undefined) {
    byTone = new Map()
    byChroma.set(chroma, byTone)
  }

  const made = Hct.from(hue, chroma, tone)
  const hex = hexFromArgb(made.toInt()).toLowerCase()
  byTone.set(tone, hex)
  solved++

  if (!READ.has(hex)) remember(hex, made)

  return hex
}
