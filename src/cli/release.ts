import { execFile, spawn, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import pkg from '../../package.json' with { type: 'json' }
import { writeAtomic } from '../store/edits.ts'
import { configHome } from '../store/paths.ts'
import { colorless } from '../terminals/osc.ts'
import { advise, outdated, type ReleaseLine, type Standing, standingLine, UPDATE_HERE } from '../tui/notice.ts'
import { markOf } from '../tui/parts.ts'
import { painter } from '../tui/style.ts'

export const UPDATE_COMMAND = `npx ${pkg.name}@latest init`

const DAY = 24 * 60 * 60 * 1000
const RETRY = 60 * 60 * 1000
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
  return join(process.env.XDG_STATE_HOME ?? join(homedir(), '.local', 'state'), 'ttheme', 'release.json')
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

function npmDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ttheme-npm-'))
  mkdirSync(join(dir, 'node_modules'))

  return dir
}

function fetchLatest(timeout = TIMEOUT): Promise<string> {
  const cwd = npmDir()

  return new Promise((resolve, reject) => {
    execFile(
      'npm',
      ['view', `${pkg.name}@latest`, 'version', '--prefer-online'],
      { cwd, encoding: 'utf8', timeout, env: { ...process.env, npm_config_update_notifier: 'false' } },
      (error, stdout, stderr) => {
        rmSync(cwd, { recursive: true, force: true })

        if (error) {
          const said = stderr
            .split('\n')
            .find((line) => /\S/.test(line))
            ?.replace(/^npm (error|ERR!) /, '')

          const { code, killed } = error as NodeJS.ErrnoException & { killed?: boolean }
          reject(
            new Error(
              code === 'ENOENT'
                ? 'cannot run npm'
                : killed
                  ? `npm did not answer within ${timeout / 1000} s`
                  : `npm could not ask its registry — ${said ?? 'it gave no reason'}`,
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

export function startReleaseCheck(now = Date.now()): void {
  const seen = readSeen()

  if (!autoWanted() || now - seen.checked < DAY) {
    return
  }

  try {
    writeSeen({ ...seen, checked: now, trying: now })
    spawn(process.execPath, [process.argv[1] as string, 'latest'], {
      detached: true,
      stdio: 'ignore',
      env: process.env,
    }).unref()
  } catch {}
}

function settled(seen: Seen): Seen {
  return {
    checked: seen.checked,
    ...(seen.latest !== undefined ? { latest: seen.latest } : {}),
    ...(seen.told !== undefined ? { told: seen.told } : {}),
  }
}

export async function checkLatest(): Promise<number> {
  try {
    const latest = await fetchLatest()
    writeSeen({ ...settled(readSeen()), checked: Date.now(), latest })

    return 0
  } catch {
    const now = Date.now()
    writeSeen({ ...settled(readSeen()), checked: now - DAY + RETRY, failed: now })

    return 1
  }
}

export function standingOf(seen: Seen, now: number, running: string = pkg.version): Standing {
  if (seen.trying !== undefined && now - seen.trying < BUSY) {
    return 'checking'
  }

  if (seen.failed !== undefined) {
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

function howToUpdate(): string {
  return runsInstalled() ? UPDATE_HERE : `\`${UPDATE_COMMAND}\` updates it`
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
    writeSeen({ ...seen, told: now })
  }

  const mark = markOf(painter(process.stderr.isTTY === true && !colorless()))

  advise([`${mark ? `${mark} ` : ''}${outdatedLine(seen.latest)}`])
}

export function upgradeTo(latest: string, args: readonly string[]): number {
  console.log(`Updating ttheme ${pkg.version} → ${latest}`)

  const cwd = npmDir()

  const npx = spawnSync('npx', ['--yes', `${pkg.name}@${latest}`, 'init', '--yes'], {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, npm_config_prefer_online: 'true' },
  })

  rmSync(cwd, { recursive: true, force: true })

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

  writeSeen({ ...settled(readSeen()), checked: Date.now(), latest })

  if (!isNewer(latest, pkg.version)) {
    return { note: `  ttheme ${pkg.version} — up to date` }
  }

  return runsInstalled() ? { latest, note: '' } : { note: `  ${outdatedLine(latest)}` }
}
