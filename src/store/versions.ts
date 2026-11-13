import { existsSync, mkdirSync, readdirSync, realpathSync, renameSync, rmSync, symlinkSync } from 'node:fs'
import { basename, join } from 'node:path'

const RELEASE = /^\d+\.\d+\.\d+$/

export function versionsDir(configHome: string): string {
  return join(configHome, 'ttheme', 'versions')
}

export function currentDir(configHome: string): string {
  return join(configHome, 'ttheme', 'current')
}

export function currentVersion(configHome: string): string | undefined {
  try {
    const version = basename(realpathSync(currentDir(configHome)))

    return RELEASE.test(version) ? version : undefined
  } catch {
    return undefined
  }
}

export function placeVersion(configHome: string, version: string, fill: (dir: string) => void): string {
  const root = versionsDir(configHome)
  const target = join(root, version)
  const fresh = join(root, `.${version}-${process.pid}`)
  const stale = join(root, `.${version}-${process.pid}-old`)

  mkdirSync(root, { recursive: true })
  rmSync(fresh, { recursive: true, force: true })
  mkdirSync(fresh)
  fill(fresh)

  if (existsSync(target)) {
    renameSync(target, stale)
  }

  renameSync(fresh, target)
  rmSync(stale, { recursive: true, force: true })

  return target
}

export function pointCurrent(configHome: string, version: string): string | undefined {
  const was = currentVersion(configHome)
  const link = currentDir(configHome)
  const next = `${link}.${process.pid}`

  rmSync(next, { force: true })
  symlinkSync(join('versions', version), next)
  renameSync(next, link)

  return was
}

export function pruneVersions(configHome: string, keep: readonly (string | undefined)[]): void {
  const root = versionsDir(configHome)

  if (!existsSync(root)) {
    return
  }

  for (const name of readdirSync(root)) {
    if (!name.startsWith('.') && !keep.includes(name)) {
      rmSync(join(root, name), { recursive: true, force: true })
    }
  }
}
