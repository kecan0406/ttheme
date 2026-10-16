import assert from 'node:assert/strict'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import pkg from '../../package.json' with { type: 'json' }
import { standingLine } from '../tui/notice.ts'
import { autoWanted, checkLatest, isNewer, newerRelease, releaseLine, standingOf } from './release.ts'

test('isNewer compares releases part by part and stays quiet about a version that is not a plain release', () => {
  assert.equal(isNewer('1.0.51', '1.0.50'), true)
  assert.equal(isNewer('1.1.0', '1.0.99'), true)
  assert.equal(isNewer('2.0.0', '1.99.99'), true)
  assert.equal(isNewer('1.0.10', '1.0.9'), true)
  assert.equal(isNewer('1.0.50', '1.0.50'), false)
  assert.equal(isNewer('1.0.49', '1.0.50'), false)
  assert.equal(isNewer('1.0.51-rc.1', '1.0.50'), false)
  assert.equal(isNewer('1.0.51', 'dev'), false)
})

test('nothing is checked in the background with TTHEME_AUTO_UPDATE off or on CI', () => {
  assert.equal(autoWanted({}), true)
  assert.equal(autoWanted({ CI: 'false' }), true)
  assert.equal(autoWanted({ TTHEME_AUTO_UPDATE: 'off' }), false)
  assert.equal(autoWanted({ CI: 'true' }), false)
})

test('a release check stands as under way, failed, newer, current or unknown by what its stamp holds', () => {
  const now = 1_000_000
  assert.equal(standingOf({ checked: now, trying: now - 5_000 }, now, '1.2.29'), 'checking')
  assert.equal(standingOf({ checked: now, trying: now - 40_000, latest: '1.2.29' }, now, '1.2.29'), 'current')
  assert.equal(standingOf({ checked: now, trying: now - 5_000, failed: now - 90_000 }, now, '1.2.29'), 'checking')
  assert.equal(standingOf({ checked: now, failed: now, latest: '1.2.30' }, now, '1.2.29'), 'failed')
  assert.equal(standingOf({ checked: now, latest: '1.2.30' }, now, '1.2.29'), 'newer')
  assert.equal(standingOf({ checked: now, latest: '1.2.28' }, now, '1.2.29'), 'current')
  assert.equal(standingOf({ checked: now }, now, '1.2.29'), 'unknown')
})

test('the standing line names the running release and, when there is one, the newer', () => {
  assert.equal(standingLine('unknown', '1.2.29', '1.2.30'), 'ttheme 1.2.29')
  assert.equal(standingLine('checking', '1.2.29'), 'ttheme 1.2.29  checking…')
  assert.equal(standingLine('current', '1.2.29', '1.2.29'), 'ttheme 1.2.29  ✓ up to date')
  assert.equal(standingLine('newer', '1.2.29', '1.2.30'), 'ttheme 1.2.29  ⇡ 1.2.30 available')
  assert.equal(standingLine('failed', '1.2.29'), 'ttheme 1.2.29  ✗ check failed')
})

test('ttheme update finding the latest release clears a background check that failed before it', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ttheme-release-'))

  const was = {
    PATH: process.env.PATH,
    XDG_STATE_HOME: process.env.XDG_STATE_HOME,
    TTHEME_UPDATED: process.env.TTHEME_UPDATED,
  }

  try {
    mkdirSync(join(dir, 'bin'))
    writeFileSync(join(dir, 'bin', 'npm'), `#!/bin/sh\necho ${pkg.version}\n`)
    chmodSync(join(dir, 'bin', 'npm'), 0o755)
    mkdirSync(join(dir, 'state', 'ttheme'), { recursive: true })
    const stamp = join(dir, 'state', 'ttheme', 'release.json')
    const failed = Date.now() - 60_000
    writeFileSync(stamp, `${JSON.stringify({ checked: failed - 86_400_000 + 3_600_000, failed })}\n`)
    process.env.PATH = `${join(dir, 'bin')}:${process.env.PATH}`
    process.env.XDG_STATE_HOME = join(dir, 'state')
    delete process.env.TTHEME_UPDATED
    assert.equal(releaseLine(Date.now(), {}).standing, 'failed')
    assert.equal((await newerRelease()).note, `  ttheme ${pkg.version} — up to date`)
    assert.equal(JSON.parse(readFileSync(stamp, 'utf8')).failed, undefined)
    assert.equal(releaseLine(Date.now(), {}).standing, 'current')
  } finally {
    for (const [key, value] of Object.entries(was)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }

    rmSync(dir, { recursive: true, force: true })
  }
})

test('a release told while the background check asked npm stays told', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ttheme-release-'))
  const was = { PATH: process.env.PATH, XDG_STATE_HOME: process.env.XDG_STATE_HOME }

  try {
    mkdirSync(join(dir, 'bin'))
    mkdirSync(join(dir, 'state', 'ttheme'), { recursive: true })
    const stamp = join(dir, 'state', 'ttheme', 'release.json')
    const told = Date.now() - 1000
    const latest = `${pkg.version.replace(/\d+$/, (patch) => String(Number(patch) + 1))}`
    writeFileSync(stamp, `${JSON.stringify({ checked: Date.now(), latest, trying: Date.now() })}\n`)
    writeFileSync(
      join(dir, 'bin', 'npm'),
      `#!/bin/sh\nprintf '%s\\n' '${JSON.stringify({ checked: Date.now(), latest, told, trying: Date.now() })}' > "$XDG_STATE_HOME/ttheme/release.json"\necho ${latest}\n`,
    )
    chmodSync(join(dir, 'bin', 'npm'), 0o755)
    process.env.PATH = `${join(dir, 'bin')}:${process.env.PATH}`
    process.env.XDG_STATE_HOME = join(dir, 'state')
    assert.equal(await checkLatest(), 0)
    const seen = JSON.parse(readFileSync(stamp, 'utf8'))
    assert.equal(seen.told, told)
    assert.equal(seen.latest, latest)
    assert.equal(seen.trying, undefined)
  } finally {
    for (const [key, value] of Object.entries(was)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }

    rmSync(dir, { recursive: true, force: true })
  }
})
