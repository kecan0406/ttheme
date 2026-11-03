export const STORE = 'ttheme-builder'

export const MOST_DRAFTS = 30

export const DRAFT_KEY = 'draft'

export interface DraftLine {
  id: string
  name: string
  made: string[]
  at: number
}

function isLine(value: unknown): value is DraftLine {
  if (typeof value !== 'object' || value === null) return false
  const line = value as Record<string, unknown>

  return (
    typeof line.id === 'string' &&
    typeof line.name === 'string' &&
    typeof line.at === 'number' &&
    Array.isArray(line.made) &&
    line.made.every((color) => typeof color === 'string')
  )
}

export function draftLines(text: string | null): DraftLine[] {
  try {
    const value: unknown = JSON.parse(text ?? 'null')
    const drafts = typeof value === 'object' && value !== null ? (value as { drafts?: unknown }).drafts : null

    return Array.isArray(drafts) ? drafts.filter(isLine) : []
  } catch {
    return []
  }
}
