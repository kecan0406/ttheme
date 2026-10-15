import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { promisify } from 'node:util'
import { TOPIC } from './sources.ts'

const exec = promisify(execFile)

export interface Repo {
  owner: string
  name: string
}

export function repoText({ owner, name }: Repo): string {
  return `${owner}/${name}`
}

export function repoUrl(repo: Repo): string {
  return `https://github.com/${repoText(repo)}`
}

async function works(command: string, args: string[], cwd?: string): Promise<boolean> {
  try {
    await exec(command, args, { cwd, timeout: 30_000 })

    return true
  } catch {
    return false
  }
}

async function run(command: string, args: string[], cwd?: string): Promise<string> {
  try {
    const { stdout } = await exec(command, args, { cwd, encoding: 'utf8', timeout: 120_000, maxBuffer: 1 << 22 })

    return stdout.trim()
  } catch (error) {
    const { stderr, message } = error as { stderr?: string; message: string }

    const said = (stderr ?? '')
      .split('\n')
      .map((line) => line.trim())
      .find(Boolean)

    throw new Error(`${command} ${args[0]} failed — ${said ?? message.split('\n')[0]}`)
  }
}

export async function toolsProblem(): Promise<string | undefined> {
  if (!(await works('git', ['--version']))) {
    return 'sharing a marketplace needs git'
  }

  if (!(await works('gh', ['--version']))) {
    return 'sharing a marketplace needs the GitHub CLI — install gh, then run `gh auth login`'
  }

  if (!(await works('gh', ['auth', 'status']))) {
    return 'gh is not logged in to GitHub — run `gh auth login` first'
  }

  return undefined
}

export async function remoteOf(dir: string): Promise<Repo | 'elsewhere' | undefined> {
  if (!existsSync(join(dir, '.git'))) {
    return undefined
  }

  let url: string

  try {
    url = (await exec('git', ['config', '--get', 'remote.origin.url'], { cwd: dir, encoding: 'utf8' })).stdout.trim()
  } catch {
    return undefined
  }

  const [, owner, name] = /github\.com[:/]([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i.exec(url) ?? []

  return owner && name ? { owner: owner.toLowerCase(), name } : 'elsewhere'
}

export function repoExists(repo: Repo): Promise<boolean> {
  return works('gh', ['repo', 'view', repoText(repo), '--json', 'name'])
}

export async function isPublic(repo: Repo): Promise<boolean> {
  try {
    return (
      (await run('gh', ['repo', 'view', repoText(repo), '--json', 'visibility', '--jq', '.visibility'])) === 'PUBLIC'
    )
  } catch {
    return false
  }
}

export interface Unsaved {
  fresh: string[]
  changed: string[]
}

export async function unsaved(dir: string, paths: readonly string[]): Promise<Unsaved> {
  if (paths.length === 0 || !existsSync(join(dir, '.git'))) {
    return { fresh: [...paths], changed: [] }
  }

  try {
    const named = paths.map((path) => relative(dir, path))

    const listed = async (args: string[]) =>
      new Set((await exec('git', [...args, '--', ...named], { cwd: dir, encoding: 'utf8' })).stdout.split('\0'))

    const known = await listed(['ls-tree', '-r', '-z', '--name-only', '--full-name', 'HEAD'])
    const moved = await listed(['diff', '--name-only', '-z', 'HEAD'])

    return {
      fresh: paths.filter((_, i) => !known.has(named[i] ?? '')),
      changed: paths.filter((_, i) => known.has(named[i] ?? '') && moved.has(named[i] ?? '')),
    }
  } catch {
    return { fresh: [...paths], changed: [] }
  }
}

export async function commitAll(dir: string, message: string): Promise<boolean> {
  if (!existsSync(join(dir, '.git'))) {
    await run('git', ['init', '-b', 'main'], dir)
  }

  await run('git', ['add', '-A'], dir)

  if (!(await run('git', ['status', '--porcelain'], dir))) {
    return false
  }

  await run('git', ['commit', '-m', message], dir)

  return true
}

export async function createRepo(
  dir: string,
  repo: Repo,
  open: boolean,
  description: string | undefined,
): Promise<void> {
  await run(
    'gh',
    [
      'repo',
      'create',
      repoText(repo),
      open ? '--public' : '--private',
      '--source',
      dir,
      '--remote',
      'origin',
      '--push',
      ...(description ? ['--description', description] : []),
    ],
    dir,
  )
}

export async function pushRepo(dir: string): Promise<void> {
  await run('git', ['push', '--set-upstream', 'origin', 'HEAD'], dir)
}

export async function describeRepo(repo: Repo, description: string | undefined, listed: boolean): Promise<void> {
  await run('gh', [
    'repo',
    'edit',
    repoText(repo),
    '--description',
    description ?? '',
    ...(listed ? ['--add-topic', TOPIC] : []),
  ])
}

function head(text: string): { top: string; rest: string } {
  const at = text.search(/^\s*\[/m)

  return at < 0 ? { top: text, rest: '' } : { top: text.slice(0, at), rest: text.slice(at) }
}

export function withDescription(text: string, description: string | undefined): string {
  const { top, rest } = head(text)
  const line = description ? `description = ${JSON.stringify(description)}\n` : ''

  if (/^description\s*=.*$/m.test(top)) {
    return top.replace(/^description\s*=.*\n?/m, line) + rest
  }

  if (!line) {
    return text
  }

  const name = /^name\s*=.*\n?/m.exec(top)

  if (!name) {
    return `${top.replace(/\n*$/, '\n')}${line}${rest ? `\n${rest}` : ''}`
  }

  const at = name.index + name[0].length

  return `${top.slice(0, at)}${name[0].endsWith('\n') ? '' : '\n'}${line}${top.slice(at)}${rest}`
}

export function withCatalogs(text: string, catalogs: readonly { name: string; native: string }[]): string {
  return catalogs.reduce(
    (out, c) =>
      `${out.replace(/\n*$/, '\n')}\n[[catalog]]\nname = ${JSON.stringify(c.name)}\nnative = ${JSON.stringify(c.native)}\n`,
    text,
  )
}

export function withoutCatalogs(text: string, names: ReadonlySet<string>): string {
  if (names.size === 0) {
    return text
  }

  const lines = text.split('\n')
  const kept: string[] = []
  let dropping = false

  for (const [i, line] of lines.entries()) {
    if (/^\s*\[/.test(line)) {
      if (dropping && kept.length > 0 && kept.at(-1)?.trim() !== '') {
        kept.push('')
      }

      dropping = false

      if (/^\s*\[\[\s*catalog\s*\]\]/.test(line)) {
        const end = lines.findIndex((next, j) => j > i && /^\s*\[/.test(next))
        const block = lines.slice(i + 1, end < 0 ? undefined : end).join('\n')
        const name = /^\s*name\s*=\s*"((?:[^"\\]|\\.)*)"/m.exec(block)?.[1]
        dropping = name !== undefined && names.has(JSON.parse(`"${name}"`) as string)

        if (dropping) {
          while (kept.length > 0 && kept.at(-1)?.trim() === '') {
            kept.pop()
          }
        }
      }
    }

    if (!dropping) {
      kept.push(line)
    }
  }

  return `${kept.join('\n').replace(/\n*$/, '')}\n`
}
