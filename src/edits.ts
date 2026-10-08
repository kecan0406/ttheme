import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname } from 'node:path'

export function backupPath(path: string): string {
  return `${path}.ttheme.bak`
}

const MARKED = /^(?:#|--) ttheme begin$|path = "ttheme-|^DefaultProfile=ttheme-/m

export function backupOnce(path: string): void {
  const backup = backupPath(path)
  if (existsSync(path) && !existsSync(backup) && !MARKED.test(readFileSync(path, 'utf8'))) {
    copyFileSync(path, backup)
  }
}

export function writeAtomic(path: string, content: string | Uint8Array): void {
  const real = existsSync(path) ? realpathSync(path) : path
  mkdirSync(dirname(real), { recursive: true })
  const tmp = `${real}.ttheme-${process.pid}`
  writeFileSync(tmp, content)
  if (existsSync(real)) {
    chmodSync(tmp, statSync(real).mode & 0o7777)
  }
  renameSync(tmp, real)
}

export function rewrite(from: string, to: string, content: Uint8Array): void {
  writeFileSync(from, content)
  if (from !== to) {
    renameSync(from, to)
  }
}

export function editUserFile(path: string, content: string): boolean {
  const before = existsSync(path) ? readFileSync(path, 'utf8') : undefined
  if (before === content) {
    return false
  }
  backupOnce(path)
  writeAtomic(path, content)
  return true
}

function alike(a: string, b: string): boolean {
  return a.replace(/\n*$/, '') === b.replace(/\n*$/, '')
}

export function restoreUserFile(path: string, content: string): 'removed' | 'restored' | 'kept backup' {
  const backup = backupPath(path)
  const saved = existsSync(backup) ? readFileSync(backup, 'utf8') : undefined
  if (content === '' && saved === undefined) {
    rmSync(path, { force: true })
    return 'removed'
  }
  const same = saved !== undefined && alike(saved, content)
  writeAtomic(path, same ? saved : content)
  if (saved === undefined || same) {
    rmSync(backup, { force: true })
    return 'restored'
  }
  return 'kept backup'
}
