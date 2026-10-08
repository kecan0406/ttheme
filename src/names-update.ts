import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { catalogPath, readAvailable } from './catalog.ts'
import { writeAtomic } from './edits.ts'
import { knowAliases, namesDir, primeNames } from './names.ts'
import { configHome, refreshAliases } from './palettes.ts'

const NAMES_RELEASE = 'https://github.com/kecan0406/aninames/releases/latest/download'

const DAY = 24 * 60 * 60 * 1000

const RETRY = 60 * 60 * 1000

const TIMEOUT = 120_000

interface Release {
  layers: Record<string, { file: string; sha256: string }>
}

function checked(home: string): string {
  return join(namesDir(home), '.checked')
}

function namesWanted(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.TTHEME_NAMES !== 'off'
}

function namesDue(home: string): boolean {
  try {
    return Date.now() - statSync(checked(home)).mtimeMs >= DAY
  } catch {
    return true
  }
}

function stamp(home: string, at: number): void {
  const file = checked(home)
  mkdirSync(namesDir(home), { recursive: true })
  if (!existsSync(file)) writeFileSync(file, '')
  utimesSync(file, at / 1000, at / 1000)
}

export function startNamesUpdate(home = homedir()): void {
  if (!namesWanted() || !namesDue(home)) return
  try {
    stamp(home, Date.now())
    spawn(process.execPath, [process.argv[1] as string, 'names'], {
      detached: true,
      stdio: 'ignore',
      env: process.env,
    }).unref()
  } catch {}
}

function sha256(data: Uint8Array): string {
  return createHash('sha256').update(data).digest('hex')
}

async function download(url: string): Promise<Uint8Array> {
  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) })
  if (!response.ok) throw new Error(`${url} answered ${response.status}`)
  return new Uint8Array(await response.arrayBuffer())
}

export async function updateNames(home = homedir()): Promise<number> {
  const dir = namesDir(home)
  try {
    const release = JSON.parse(new TextDecoder().decode(await download(`${NAMES_RELEASE}/ttheme.json`))) as Release
    for (const [layer, { file, sha256: want }] of Object.entries(release.layers)) {
      const target = join(dir, `ttheme-${layer}.json`)
      if (existsSync(target) && sha256(readFileSync(target)) === want) continue
      const data = gunzipSync(await download(`${NAMES_RELEASE}/${file}`))
      if (sha256(data) !== want) throw new Error(`${file} does not match its hash`)
      writeAtomic(target, data)
    }
    stamp(home, Date.now())
  } catch {
    stamp(home, Date.now() - DAY + RETRY)
    return 1
  }
  primeNames(home)
  const config = configHome()
  if (existsSync(catalogPath(config))) {
    knowAliases(readAvailable(config).palettes, home)
    refreshAliases(config, home)
  }
  return 0
}
