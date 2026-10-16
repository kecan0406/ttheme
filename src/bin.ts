#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { isMainThread } from 'node:worker_threads'
import { runCli } from './cli/cli.ts'
import { keepDerived, saveDerived } from './store/derived.ts'
import { cacheRoot } from './store/paths.ts'

if (isMainThread) {
  if (process.env.TTHEME_DEBUG && typeof Bun === 'undefined' && !process.sourceMapsEnabled) {
    const child = spawnSync(process.execPath, ['--enable-source-maps', ...process.argv.slice(1)], { stdio: 'inherit' })
    process.exitCode = child.status ?? 1
  } else {
    keepDerived(import.meta.url, cacheRoot())
    process.exitCode = await runCli(process.argv.slice(2))
    saveDerived()
  }
}
