import { existsSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { type Bundled, builtinPath, writeCommons } from '../src/store/available.ts'

export function writeBundled(configHome: string, { builtin, commons }: Bundled): void {
  const current = join(configHome, 'ttheme', 'current')

  if (!existsSync(current)) {
    mkdirSync(join(configHome, 'ttheme', 'versions', '0.0.0'), { recursive: true })
    symlinkSync(join('versions', '0.0.0'), current)
  }

  writeFileSync(builtinPath(configHome), `${JSON.stringify(builtin, null, 2)}\n`)
  writeCommons(configHome, commons)
}
