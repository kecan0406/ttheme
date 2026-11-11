import { execFile, spawn, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import pkg from '../../package.json' with { type: 'json' }
import { freshnessOf } from '../core/freshness.ts'
import { type Runner, runnerOf } from '../core/runner.ts'
import { writeAtomic } from '../store/edits.ts'
import { readInstalled } from '../store/installed.ts'
import { configHome } from '../store/paths.ts'
import { colorless } from '../terminals/osc.ts'
import {
  advise,
  outdated,
  outdatedLines,
  type ReleaseLine,
  type Standing,
  standingLine,
  UPDATE_HERE,
} from '../tui/notice.ts'
import { painter } from '../tui/style.ts'

interface Tool {
  name: string
  asks: readonly [string, ...string[]]
  flags: readonly string[]
}

const TOOLS: Record<Runner, Tool> = {
  npx: { name: 'npm', asks: ['npm', 'view', `${pkg.name}@latest`, 'version', '--prefer-online'], flags: ['--yes'] },
  bunx: { name: 'Bun', asks: ['bun', 'info', `${pkg.name}@latest`, 'version'], flags: [] },
}

export function launch(runner: Runner, verb: string): string {
  return `${runner} ${pkg.name}@latest ${verb}`
}

const DAY = 24 * 60 * 60 * 1000
const TIMEOUT = 10_000
const BUSY = 30_000

interface Seen {
  checked: number
  latest?: string
  told?: number
  trying?: number
  failed?: number
}

const RELEASE = /^(\d+)\.(\d+)\.(\d+)$/

export function isNewer(latest: string, running: string): boolean {
  const a = RELEASE.exec(latest)
  const b = RELEASE.exec(running)

  if (!a || !b) {
    return false
  }

  const gap = [1, 2, 3].map((part) => Number(a[part]) - Number(b[part])).find((step) => step !== 0)

  return (gap ?? 0) > 0
}

export function autoWanted(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.TTHEME_AUTO_UPDATE !== 'off' && (env.CI === undefined || env.CI === '' || env.CI === 'false')
}

function seenPath(): string {
  return join(process.env.XDG_STATE_HOME || join(homedir(), '.local', 'state'), 'ttheme', 'release.json')
}

function readSeen(): Seen {
  try {
    const doc = JSON.parse(readFileSync(seenPath(), 'utf8')) as Partial<Seen>

    return {
      checked: typeof doc.checked === 'number' ? doc.checked : 0,
      ...(typeof doc.latest === 'string' ? { latest: doc.latest } : {}),
      ...(typeof doc.told === 'number' ? { told: doc.told } : {}),
      ...(typeof doc.trying === 'number' ? { trying: doc.trying } : {}),
      ...(typeof doc.failed === 'number' ? { failed: doc.failed } : {}),
    }
  } catch {
    return { checked: 0 }
  }
}

function writeSeen(seen: Seen): void {
  mkdirSync(dirname(seenPath()), { recursive: true })
  writeAtomic(seenPath(), `${JSON.stringify(seen)}\n`)
}

function askDir(runner: Runner): string {
  const dir = mkdtempSync(join(tmpdir(), 'ttheme-npm-'))
  mkdirSync(join(dir, 'node_modules'))

  if (runner === 'bunx') {
    writeFileSync(join(dir, 'package.json'), '{}\n')
  }

  return dir
}

function fetchLatest(timeout = TIMEOUT): Promise<string> {
  const by = runner()
  const [tool, ...args] = TOOLS[by].asks
  const cwd = askDir(by)

  return new Promise((resolve, reject) => {
    execFile(
      tool,
      args,
      { cwd, encoding: 'utf8', timeout, env: { ...process.env, npm_config_update_notifier: 'false' } },
      (error, stdout, stderr) => {
        rmSync(cwd, { recursive: true, force: true })

        if (error) {
          const said = stderr
            .split('\n')
            .find((line) => /\S/.test(line))
            ?.replace(/^(npm (error|ERR!)|error:) /, '')

          const { code, killed } = error as NodeJS.ErrnoException & { killed?: boolean }
          reject(
            new Error(
              code === 'ENOENT'
                ? `cannot run ${tool}`
                : killed
                  ? `${tool} did not answer within ${timeout / 1000} s`
                  : `${tool} could not ask its registry — ${said ?? 'it gave no reason'}`,
            ),
          )

          return
        }

        const version = stdout.trim()

        if (!RELEASE.test(version)) {
          reject(new Error('the npm registry named no version'))

          return
        }

        resolve(version)
      },
    )
  })
}

function failedAt(seen: Seen, now: number): number | undefined {
  if (seen.failed !== undefined) {
    return seen.failed
  }

  return seen.trying !== undefined && now - seen.trying >= BUSY && seen.trying > seen.checked ? seen.trying : undefined
}

export type Check = 'trying' | 'due' | 'waiting'

export function checkOf(seen: Seen, now: number): Check {
  if (seen.trying !== undefined && now - seen.trying < BUSY) {
    return 'trying'
  }

  return freshnessOf(seen.checked || undefined, failedAt(seen, now), now).due ? 'due' : 'waiting'
}

function began(seen: Seen, now: number): Seen {
  return { ...seen, trying: now }
}

function answered(seen: Seen, now: number, latest: string): Seen {
  return { checked: now, latest, ...(seen.told !== undefined ? { told: seen.told } : {}) }
}

function failing(seen: Seen, now: number): Seen {
  return {
    checked: seen.checked,
    ...(seen.latest !== undefined ? { latest: seen.latest } : {}),
    ...(seen.told !== undefined ? { told: seen.told } : {}),
    failed: now,
  }
}

export function startReleaseCheck(now = Date.now()): void {
  const seen = readSeen()

  if (!autoWanted() || checkOf(seen, now) !== 'due') {
    return
  }

  try {
    writeSeen(began(seen, now))
    spawn(process.execPath, [process.argv[1] as string, 'latest'], {
      detached: true,
      stdio: 'ignore',
      env: process.env,
    }).unref()
  } catch {}
}

export async function checkLatest(): Promise<number> {
  try {
    const latest = await fetchLatest()
    writeSeen(answered(readSeen(), Date.now(), latest))

    return 0
  } catch {
    writeSeen(failing(readSeen(), Date.now()))

    return 1
  }
}

export function standingOf(seen: Seen, now: number, running: string = pkg.version): Standing {
  if (checkOf(seen, now) === 'trying') {
    return 'checking'
  }

  if (failedAt(seen, now) !== undefined) {
    return 'failed'
  }

  if (seen.latest === undefined) {
    return 'unknown'
  }

  return isNewer(seen.latest, running) ? 'newer' : 'current'
}

export function releaseLine(now = Date.now(), env: NodeJS.ProcessEnv = process.env): ReleaseLine {
  const seen = readSeen()
  const standing = autoWanted(env) ? standingOf(seen, now) : 'unknown'

  return { standing, line: standingLine(standing, pkg.version, seen.latest) }
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

function runner(): Runner {
  if (!runsInstalled()) {
    return runnerOf(process.env.npm_config_user_agent)
  }

  try {
    return readInstalled(configHome()).runner ?? 'npx'
  } catch {
    return 'npx'
  }
}

export function initCommand(): string {
  return launch(runner(), 'init')
}

function howToUpdate(): string {
  return runsInstalled() ? UPDATE_HERE : `\`${initCommand()}\` updates it`
}

function updateCommand(): string {
  return runsInstalled() ? 'ttheme update' : initCommand()
}

function outdatedLine(latest: string, running: string = pkg.version): string {
  return outdated(latest, running, howToUpdate())
}

export function tellRelease(now = Date.now()): void {
  const seen = readSeen()

  if (!autoWanted() || !seen.latest || !isNewer(seen.latest, pkg.version) || now - (seen.told ?? 0) < DAY) {
    return
  }

  if (process.stderr.isTTY) {
    try {
      writeSeen({ ...seen, told: now })
    } catch {}
  }

  advise(
    outdatedLines(painter(process.stderr.isTTY === true && !colorless()), seen.latest, pkg.version, updateCommand()),
  )
}

export class Replaced extends Error {}

export function upgradeTo(latest: string, args: readonly string[]): number {
  console.log(`Updating ttheme ${pkg.version} → ${latest}`)

  const by = runner()
  const again = launch(by, 'init')
  const cwd = askDir(by)

  const ran = spawnSync(by, [...TOOLS[by].flags, `${pkg.name}@${latest}`, 'init', '--yes'], {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, npm_config_prefer_online: 'true' },
  })

  rmSync(cwd, { recursive: true, force: true })

  if (ran.error) {
    throw new Error(
      `cannot run ${by} — ${ran.error.message}; \`${again}\` updates ttheme once ${TOOLS[by].name} is there`,
    )
  }

  const cli = installedCli()
  const now = spawnSync(process.execPath, [cli, '--version'], { encoding: 'utf8' }).stdout?.trim()

  if (ran.status !== 0 && now === pkg.version) {
    throw new Error(`${by} stopped with status ${ran.status} — ttheme ${pkg.version} is still installed`)
  }

  if (ran.status !== 0) {
    throw new Replaced(
      `${by} stopped with status ${ran.status} and left ${cli} at ${now || 'a version that does not read'} — \`${again}\` finishes the update`,
    )
  }

  if (now !== latest) {
    throw new (now === pkg.version ? Error : Replaced)(
      `${cli} is ${now || 'unreadable'} after the update, not ${latest} — \`${again}\` tries again`,
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

export async function newerRelease(): Promise<{ latest?: string; note: string; failed?: true }> {
  if (process.env.TTHEME_UPDATED) {
    return { note: `  ttheme ${pkg.version} — updated` }
  }

  let latest: string

  try {
    latest = await fetchLatest()
  } catch (error) {
    return {
      note: `  ttheme ${pkg.version} — could not check for a newer one: ${(error as Error).message}`,
      failed: true,
    }
  }

  writeSeen(answered(readSeen(), Date.now(), latest))

  if (!isNewer(latest, pkg.version)) {
    return { note: `  ttheme ${pkg.version} — up to date` }
  }

  return runsInstalled() ? { latest, note: '' } : { note: `  ${outdatedLine(latest)}` }
}
