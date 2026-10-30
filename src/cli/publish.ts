import { execFile } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { promisify } from 'node:util'
import { parse } from 'smol-toml'
import { aboutOf, type Character, type Work, workOf, workToml } from '../core/commons.ts'
import { readWorkFiles } from '../core/own.ts'
import { available, readBundled, readMarketplaces } from '../store/available.ts'
import { writeAtomic } from '../store/edits.ts'
import { warning, workFiles, worksDir } from '../store/local.ts'
import { TOPIC } from '../store/sources.ts'

const exec = promisify(execFile)
const DESCRIPTION = /^description\s*=\s*(?:"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\\n]|\\.)*"|'[^'\n]*'|)[^\n]*\n?/m

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

function readable(text: string): boolean {
  try {
    parse(text)

    return true
  } catch {
    return false
  }
}

function head(text: string): { top: string; rest: string } {
  const starts = [...text.matchAll(/^[ \t]*\[/gm)].map((match) => match.index)
  const at = starts.find((start) => readable(text.slice(0, start))) ?? starts[0] ?? -1

  return at < 0 ? { top: text, rest: '' } : { top: text.slice(0, at), rest: text.slice(at) }
}

export function withDescription(text: string, description: string | undefined): string {
  const { top, rest } = head(text)
  const line = description ? `description = ${JSON.stringify(description)}\n` : ''

  if (DESCRIPTION.test(top)) {
    return top.replace(DESCRIPTION, line) + rest
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

export function withCharacter(work: Work, character: Character | undefined): Work {
  return character === undefined || work.characters.some((c) => c.id === character.id)
    ? work
    : { ...work, characters: [...work.characters, character] }
}

export interface Proposal {
  work: Work
  path: string
}

function bare({ id, name, native, danbooru }: Work): Work {
  return { id, name, ...(native ? { native } : {}), ...(danbooru ? { danbooru } : {}), characters: [] }
}

export function proposalsFor(
  known: readonly Work[],
  commons: readonly Work[],
  dir: string,
  subjects: readonly (string | undefined)[],
): Proposal[] {
  const files = workFiles(dir)
  const texts = new Map(files.map((file) => [file.id, readFileSync(file.path, 'utf8')]))
  const held = new Map(readWorkFiles(files, (file) => texts.get(file.id) ?? '', warning(false)).map((w) => [w.id, w]))
  const proposed = new Map<string, Work>()

  for (const subject of subjects) {
    const about = aboutOf(known, subject)

    if (!about || aboutOf(commons, subject)?.known || (texts.has(about.work.id) && !held.has(about.work.id))) {
      continue
    }

    const id = about.work.id
    const at = proposed.get(id) ?? held.get(id) ?? bare(workOf(commons, id) ?? about.work)
    proposed.set(id, withCharacter(at, about.character))
  }

  return [...proposed.values()].flatMap((work) =>
    texts.get(work.id) === workToml(work) ? [] : [{ work, path: join(worksDir(dir), `${work.id}.toml`) }],
  )
}

export function writeProposals(home: string, dir: string, subjects: readonly (string | undefined)[]): Proposal[] {
  const proposals = proposalsFor(
    available(home, readMarketplaces(home, false), false).works,
    readBundled(home).commons.works,
    dir,
    subjects,
  )

  for (const { work, path } of proposals) {
    writeAtomic(path, workToml(work))
  }

  return proposals
}
