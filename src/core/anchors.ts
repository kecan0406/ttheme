import { type Hex, isHex } from './color.ts'
import { SLOT_NAMES } from './slots.ts'
import { nameProblem, textProblem } from './theme.ts'

export interface Anchor {
  part: string
  hex: Hex
}

export interface Anchors {
  name: string
  slots: [string, Anchor][]
  booru?: string
  nativeNames?: string[]
  source?: string
}

export interface Reading {
  anchors: Anchors[]
  problems: Problem[]
}

export interface Problem {
  path: string
  problem: string
}

export const ANCHOR_FIELDS = ['slots', 'booru', 'native_names', 'source']

const SIGNATURE_SIZE = 3
const TAG = /^[\p{L}\p{N}_()'.:!?~&+-]+$/u

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function anchorOf(path: string, value: unknown, problems: Problem[]): Anchor | undefined {
  if (!Array.isArray(value) || value.length !== 2) {
    problems.push({ path, problem: 'must be ["<part>", "#rrggbb"]' })

    return undefined
  }

  const [part, color] = value as unknown[]
  const named = typeof part === 'string' && part.length > 0 ? textProblem(part) : 'must be a non-empty string'
  const hex = typeof color === 'string' ? color.toLowerCase() : undefined

  if (named !== undefined) problems.push({ path: `${path}[0]`, problem: named })

  if (hex === undefined || !isHex(hex)) problems.push({ path: `${path}[1]`, problem: 'must be a "#rrggbb" color' })

  return named === undefined && hex !== undefined && isHex(hex) ? { part: part as string, hex } : undefined
}

function slotsOf(path: string, value: unknown, problems: Problem[]): [string, Anchor][] {
  if (!isRecord(value)) {
    problems.push({ path, problem: `must map ${SIGNATURE_SIZE} colors to ["<part>", "#rrggbb"]` })

    return []
  }

  const keys = Object.keys(value)

  if (keys.length !== SIGNATURE_SIZE) {
    problems.push({
      path,
      problem: `names ${keys.length} colors — the signature is ${SIGNATURE_SIZE}, in the order the character reads`,
    })
  }

  return keys.flatMap((slot): [string, Anchor][] => {
    if (!SLOT_NAMES.includes(slot)) {
      problems.push({
        path: `${path}.${slot}`,
        problem: `is not one of the palette's colors: ${SLOT_NAMES.join(', ')}`,
      })

      return []
    }

    const anchor = anchorOf(`${path}.${slot}`, value[slot], problems)

    return anchor ? [[slot, anchor]] : []
  })
}

function namesOf(path: string, value: unknown, problems: Problem[]): string[] | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    problems.push({ path, problem: 'must be a list of names' })

    return undefined
  }

  const names = (value as unknown[]).flatMap((name, i) => {
    const problem =
      typeof name !== 'string' || name.length === 0
        ? 'must be a non-empty string'
        : name.includes('|')
          ? 'holds a |'
          : textProblem(name)

    if (problem !== undefined) problems.push({ path: `${path}[${i}]`, problem })

    return problem === undefined ? [name as string] : []
  })

  return names.length === value.length ? names : undefined
}

function entryOf(name: string, value: unknown, problems: Problem[]): Anchors | undefined {
  const before = problems.length
  const slug = nameProblem(name)

  if (slug !== undefined || name.includes('/')) {
    problems.push({ path: name, problem: `is not a palette name — it ${slug ?? 'names a marketplace'}` })
  }

  if (!isRecord(value)) {
    problems.push({ path: name, problem: `must be an object with ${ANCHOR_FIELDS.join(', ')}` })

    return undefined
  }

  for (const key of Object.keys(value).filter((k) => !ANCHOR_FIELDS.includes(k))) {
    problems.push({ path: `${name}.${key}`, problem: `is not a field — one of ${ANCHOR_FIELDS.join(', ')}` })
  }

  const slots = slotsOf(`${name}.slots`, value.slots, problems)
  const { booru, source } = value

  if (booru !== undefined && (typeof booru !== 'string' || !TAG.test(booru))) {
    problems.push({ path: `${name}.booru`, problem: 'must be a danbooru tag, such as gotoh_hitori' })
  }

  if (source !== undefined && (typeof source !== 'string' || source.length === 0)) {
    problems.push({ path: `${name}.source`, problem: 'must be a non-empty string' })
  }

  const nativeNames =
    value.native_names === undefined ? undefined : namesOf(`${name}.native_names`, value.native_names, problems)

  if (problems.length > before) return undefined

  return {
    name,
    slots,
    ...(typeof booru === 'string' ? { booru } : {}),
    ...(nativeNames ? { nativeNames } : {}),
    ...(typeof source === 'string' ? { source } : {}),
  }
}

export function readAnchors(doc: unknown): Reading {
  const problems: Problem[] = []

  if (!isRecord(doc) || Object.keys(doc).length === 0) {
    return { anchors: [], problems: [{ path: '', problem: 'must map each palette name to its anchors' }] }
  }

  const anchors = Object.entries(doc).flatMap(([name, value]) => entryOf(name, value, problems) ?? [])

  return { anchors, problems }
}
