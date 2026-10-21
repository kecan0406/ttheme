import { type Identity, MARKETPLACE_SCHEMA_URL, marketplaceId, nameProblem } from './theme.ts'

export function marketplaceToml({ owner, name }: Identity, description?: string): string {
  const about = description ? `description = ${JSON.stringify(description)}\n` : ''

  return `"$schema" = ${JSON.stringify(MARKETPLACE_SCHEMA_URL)}\nname = ${JSON.stringify(name)}\n${about}\n[owner]\nname = ${JSON.stringify(owner)}\n`
}

export function repoFor({ name }: Identity): string {
  return `ttheme-${name}`
}

export function readmeOf(identity: Identity, repo = repoFor(identity)): string {
  return `# ${marketplaceId(identity)}\n\nA [ttheme](https://github.com/kecan0406/ttheme) marketplace:\n\n\`\`\`sh\nttheme marketplace add ${identity.owner}/${repo}\nttheme\n\`\`\`\n`
}

export function marketplaceNameProblem(name: string): string | undefined {
  return nameProblem(`x@${name}/x`) ? 'takes lowercase letters, digits and single hyphens' : undefined
}
