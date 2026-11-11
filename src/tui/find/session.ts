import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { extension, previewOf, type Site } from '../../core/booru.ts'
import type * as booru from '../../pictures/booru-net.ts'
import type { Pick } from '../../pictures/fit.ts'

type Booru = typeof booru

export interface Net {
  fetchBytes: Booru['fetchBytes']
  fetchCount: Booru['fetchCount']
  fetchCredits: Booru['fetchCredits']
  fetchLent: Booru['fetchLent']
  fetchPost: Booru['fetchPost']
  fetchPosts: Booru['fetchPosts']
  fetchProfiles: Booru['fetchProfiles']
  fetchRelated: Booru['fetchRelated']
  fetchSuggestions: Booru['fetchSuggestions']
  headOf: Booru['headOf']
  locate: Booru['locate']
  pausedUntil: Booru['pausedUntil']
}

export interface Grid {
  cols: number
  rows: number
  cell: { w: number; h: number }
}

export function describe(error: Error | string): string {
  if (!(error instanceof Error)) {
    return error
  }

  const [inner] = error instanceof AggregateError ? error.errors : []

  if (inner) {
    return describe(inner instanceof Error ? inner : String(inner))
  }

  if (error.cause) {
    return describe(error.cause instanceof Error ? error.cause : String(error.cause))
  }

  if (error.name === 'TimeoutError') {
    return 'no answer in time'
  }

  const code = 'code' in error ? error.code : undefined

  if (code === String(code)) {
    return code
  }

  const first = (error.message || error.name).split(/\.(?:\s|$)/)[0] ?? ''

  return first.length > 56 ? `${first.slice(0, 55)}…` : first
}

export function reason(name: string, error: Error | string): string {
  const told = describe(error)

  return told.startsWith(`${name} `) ? told : `${name}: ${told}`
}

export function previewStem(id: number, url: string): string {
  return `${id}-${createHash('sha1').update(url).digest('hex').slice(0, 8)}`
}

export function heldPath(scratch: string, site: Site, kind: string, file: string): string {
  return join(scratch, site.key, kind, file)
}

export function origPath(scratch: string, site: Site, id: number, ext: string): string {
  return heldPath(scratch, site, 'orig', `${id}.${ext}`)
}

export function previewPath(scratch: string, pick: Pick): string {
  const { url } = previewOf(pick.site, pick.post)

  return heldPath(scratch, pick.site, 'thumb', `${previewStem(pick.post.id, url)}.${extension(url)}`)
}
