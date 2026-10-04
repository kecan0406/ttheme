import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

export function tarballOf(files: Record<string, string>, top = 'ttheme-pastel-HEAD'): Uint8Array {
  const base = mkdtempSync(join(tmpdir(), 'ttheme-tarball-'))
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(base, top, path)), { recursive: true })
    writeFileSync(join(base, top, path), text)
  }
  return new Uint8Array(
    execFileSync('tar', ['-czf', '-', '-C', base, top], { env: { ...process.env, COPYFILE_DISABLE: '1' } }),
  )
}
