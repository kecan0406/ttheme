#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { isMainThread } from 'node:worker_threads'
import { runCli } from './cli/cli.ts'
import { capsFor, useCaps } from './tui/keycaps.ts'

function closedPipe(error: NodeJS.ErrnoException): void {
  if (error.code !== 'EPIPE') {
    throw error
  }
}

if (isMainThread) {
  process.stdout.on('error', closedPipe)
  process.stderr.on('error', closedPipe)

  if (process.env.TTHEME_DEBUG && typeof Bun === 'undefined' && !process.sourceMapsEnabled) {
    const child = spawnSync(process.execPath, ['--enable-source-maps', ...process.argv.slice(1)], { stdio: 'inherit' })
    process.exitCode = child.status ?? 1
  } else {
    useCaps(capsFor(process.env, process.platform))
    process.exitCode = await runCli(process.argv.slice(2))
  }
}
