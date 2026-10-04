import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, realpathSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import pkg from '../package.json' with { type: 'json' }
import { writeAtomic } from './edits.ts'
import { advise } from './notice.ts'
import { configHome } from './palettes.ts'

export const LATEST_URL = `https://registry.npmjs.org/${pkg.name}/latest`
export const UPDATE_COMMAND = `npx ${pkg.name}@latest init`

const DAY = 24 * 60 * 60 * 1000
const RETRY = 60 * 60 * 1000
const TIMEOUT = 10_000

interface Seen {
  checked: number
  latest?: string
  told?: number
}

const RELEASE = /^(\d+)\.(\d+)\.(\d+)$/

export function isNewer(latest: string, running: string): boolean {
  const a = RELEASE.exec(latest)
  const b = RELEASE.exec(running)
  if (!a || !b) {
    return false
  }
  for (const part of [1, 2, 3]) {
    const gap = Number(a[part]) - Number(b[part])
    if (gap !== 0) {
      return gap > 0
    }
  }
  return false
}

export function autoWanted(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.TTHEME_AUTO_UPDATE !== 'off' && (env.CI === undefined || env.CI === '' || env.CI === 'false')
}

function seenPath(): string {
  return join(process.env.XDG_STATE_HOME ?? join(homedir(), '.local', 'state'), 'ttheme', 'release.json')
}

function readSeen(): Seen {
  try {
    const doc = JSON.parse(readFileSync(seenPath(), 'utf8')) as Partial<Seen>
    return {
      checked: typeof doc.checked === 'number' ? doc.checked : 0,
      ...(typeof doc.latest === 'string' ? { latest: doc.latest } : {}),
      ...(typeof doc.told === 'number' ? { told: doc.told } : {}),
    }
  } catch {
    return { checked: 0 }
  }
}

function writeSeen(seen: Seen): void {
  mkdirSync(dirname(seenPath()), { recursive: true })
  writeAtomic(seenPath(), `${JSON.stringify(seen)}\n`)
}

export async function fetchLatest(timeout = TIMEOUT): Promise<string> {
  let response: Response
  try {
    response = await fetch(LATEST_URL, { signal: AbortSignal.timeout(timeout) })
  } catch (error) {
    throw new Error(`cannot reach the npm registry — ${error instanceof Error ? error.message : String(error)}`)
  }
  if (!response.ok) {
    throw new Error(`the npm registry answered ${response.status}`)
  }
  const { version } = (await response.json()) as { version?: unknown }
  if (typeof version !== 'string' || !RELEASE.test(version)) {
    throw new Error('the npm registry named no version')
  }
  return version
}

export function startReleaseCheck(now = Date.now()): void {
  const seen = readSeen()
  if (!autoWanted() || now - seen.checked < DAY) {
    return
  }
  try {
    writeSeen({ ...seen, checked: now })
    spawn(process.execPath, [process.argv[1] as string, 'latest'], {
      detached: true,
      stdio: 'ignore',
      env: process.env,
    }).unref()
  } catch {}
}

export async function checkLatest(): Promise<number> {
  const seen = readSeen()
  try {
    writeSeen({ ...seen, checked: Date.now(), latest: await fetchLatest() })
    return 0
  } catch {
    writeSeen({ ...seen, checked: Date.now() - DAY + RETRY })
    return 1
  }
}

function installedCli(home = configHome()): string {
  return join(home, 'ttheme', 'ttheme.js')
}

function runsInstalled(): boolean {
  try {
    return realpathSync(process.argv[1] as string) === realpathSync(installedCli())
  } catch {
    return false
  }
}

function howToUpdate(): string {
  return runsInstalled() ? '`ttheme update` updates it' : `\`${UPDATE_COMMAND}\` updates it`
}

function outdatedLine(latest: string, running: string = pkg.version): string {
  return `ttheme ${latest} is out, you have ${running} — ${howToUpdate()}`
}

export function tellRelease(now = Date.now()): void {
  const seen = readSeen()
  if (!autoWanted() || !seen.latest || !isNewer(seen.latest, pkg.version) || now - (seen.told ?? 0) < DAY) {
    return
  }
  if (process.stderr.isTTY) {
    writeSeen({ ...seen, told: now })
  }
  advise([outdatedLine(seen.latest)])
}

export function upgradeTo(latest: string, args: readonly string[]): number {
  console.log(`Updating ttheme ${pkg.version} → ${latest}`)
  const npx = spawnSync('npx', ['--yes', `${pkg.name}@${latest}`, 'init', '--yes'], {
    cwd: tmpdir(),
    stdio: 'inherit',
    env: { ...process.env, npm_config_prefer_online: 'true' },
  })
  if (npx.error) {
    throw new Error(`cannot run npx — ${npx.error.message}; \`${UPDATE_COMMAND}\` updates ttheme once npm is there`)
  }
  if (npx.status !== 0) {
    throw new Error(`npx stopped with status ${npx.status} — ttheme ${pkg.version} is still installed`)
  }
  const cli = installedCli()
  const now = spawnSync(process.execPath, [cli, '--version'], { encoding: 'utf8' }).stdout?.trim()
  if (now !== latest) {
    throw new Error(
      `${cli} is ${now || 'unreadable'} after the update, not ${latest} — \`${UPDATE_COMMAND}\` tries again`,
    )
  }
  const seen = readSeen()
  writeSeen({ ...seen, latest })
  const next = spawnSync(process.execPath, [cli, 'update', ...args], {
    stdio: 'inherit',
    env: { ...process.env, TTHEME_UPDATED: latest },
  })
  return next.status ?? 1
}

export async function newerRelease(): Promise<{ latest?: string; note: string }> {
  if (process.env.TTHEME_UPDATED) {
    return { note: `  ttheme ${pkg.version} — updated` }
  }
  let latest: string
  try {
    latest = await fetchLatest()
  } catch (error) {
    return { note: `  ttheme ${pkg.version} — could not check for a newer one: ${(error as Error).message}` }
  }
  writeSeen({ ...readSeen(), checked: Date.now(), latest })
  if (!isNewer(latest, pkg.version)) {
    return { note: `  ttheme ${pkg.version} — up to date` }
  }
  return runsInstalled() ? { latest, note: '' } : { note: `  ${outdatedLine(latest)}` }
}
