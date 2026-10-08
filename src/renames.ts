import type { MarketplaceInfo } from './sources.ts'

type Renames = MarketplaceInfo['renames']

export interface Moves {
  renamed: Map<string, string>
  removed: string[]
}

function follow(renames: Renames, slug: string): string | false | undefined {
  let at = slug
  const seen = new Set<string>()
  while (Object.hasOwn(renames, at) && !seen.has(at)) {
    seen.add(at)
    const to = renames[at] as string | false
    if (to === false) {
      return false
    }
    at = to
  }
  return seen.has(at) || at === slug ? undefined : at
}

export function plan(
  id: string,
  info: Pick<MarketplaceInfo, 'renames' | 'forceRemove'>,
  slugs: ReadonlySet<string>,
  installed: readonly string[],
  moves: Moves,
): void {
  const prefix = `${id}/`
  for (const name of installed) {
    const slug = name.startsWith(prefix) ? name.slice(prefix.length) : undefined
    if (slug === undefined || slugs.has(slug)) {
      continue
    }
    const to = follow(info.renames, slug)
    if (to === false) {
      moves.removed.push(name)
    } else if (to !== undefined && slugs.has(to)) {
      moves.renamed.set(name, `${prefix}${to}`)
    } else if (info.forceRemove) {
      moves.removed.push(name)
    }
  }
}

export function renameProblems(renames: Renames, slugs: ReadonlySet<string>): { errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []
  for (const from of Object.keys(renames)) {
    if (slugs.has(from)) {
      warnings.push(`renames.${from}: ${from} is still a palette here, so the rename never applies`)
      continue
    }
    const to = follow(renames, from)
    if (to === undefined) {
      errors.push(`renames.${from}: the chain comes back to a name it already passed`)
    } else if (to !== false && !slugs.has(to)) {
      errors.push(`renames.${from}: the chain ends at ${to}, which is not a palette here — end it at one, or at false`)
    }
  }
  return { errors, warnings }
}
