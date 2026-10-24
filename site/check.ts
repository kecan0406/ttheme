import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const SITE = import.meta.dirname
const stand = mkdtempSync(join(tmpdir(), 'ttheme-site-check-'))
let failed = 0

try {
  writeFileSync(join(stand, 'assets.json'), JSON.stringify({ css: '', js: '', builder: '', fonts: [], reload: '' }))
  writeFileSync(join(stand, 'marketplaces.json'), '[]')
  writeFileSync(join(stand, 'commands.json'), JSON.stringify({ sections: [], exits: [] }))
  writeFileSync(
    join(stand, 'tsconfig.json'),
    JSON.stringify({
      extends: join(SITE, 'tsconfig.json'),
      compilerOptions: {
        typeRoots: [join(SITE, 'node_modules', '@types')],
        paths: {
          '@/assets.json': [join(stand, 'assets.json')],
          '@/marketplaces.json': [join(stand, 'marketplaces.json')],
          '@/commands.json': [join(stand, 'commands.json')],
          '@/*': [join(SITE, '*')],
        },
      },
    }),
  )

  for (const project of [join(stand, 'tsconfig.json'), join(SITE, 'client')]) {
    const run = Bun.spawnSync([join(SITE, 'node_modules', '.bin', 'tsc'), '--noEmit', '-p', project], {
      stdout: 'inherit',
      stderr: 'inherit',
    })

    if (run.exitCode !== 0) {
      failed = run.exitCode
      break
    }
  }
} finally {
  rmSync(stand, { recursive: true, force: true })
}

process.exitCode = failed
