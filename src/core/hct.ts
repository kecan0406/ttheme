import { argbFromHex, Hct, hexFromArgb } from '@material/material-color-utilities'
import type { Hex } from './color.ts'

export interface Hued {
  hue: number
  chroma: number
  tone: number
}

export interface Solved extends Hued {
  hex: Hex
}

export function hctOf(hex: Hex): Hued {
  const read = Hct.fromInt(argbFromHex(hex))

  return { hue: read.hue, chroma: read.chroma, tone: read.tone }
}

export function solve(hue: number, chroma: number, tone: number): Solved {
  const made = Hct.from(hue, chroma, tone)

  return { hex: hexFromArgb(made.toInt()).toLowerCase(), hue: made.hue, chroma: made.chroma, tone: made.tone }
}

export function hctHex(hue: number, chroma: number, tone: number): Hex {
  return hexFromArgb(Hct.from(hue, chroma, tone).toInt()).toLowerCase()
}
