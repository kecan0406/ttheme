#!/usr/bin/env node
import { isMainThread } from 'node:worker_threads'
import { runCli } from './cli.ts'

if (isMainThread) {
  process.exitCode = await runCli(process.argv.slice(2))
}
