import assert from 'node:assert/strict'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import pkg from '../../package.json' with { type: 'json' }
import { standingLine } from '../tui/notice.ts'
import {
  answered,
  autoWanted,
  checkLatest,
  checkOf,
  isNewer,
  newerRelease,
  Replaced,
  releaseLine,
  ripest,
  standingOf,
  upgradeTo,
} from './release.ts'

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
  const on = () => 'on'
  assert.equal(autoWanted({}, on), true)
  assert.equal(autoWanted({ CI: 'false' }, on), true)
  assert.equal(autoWanted({ TTHEME_AUTO_UPDATE: 'off' }, on), false)
  assert.equal(autoWanted({ CI: 'true' }, on), false)
  assert.equal(
    autoWanted({}, () => 'off'),
    false,
  )
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

test('a newer release is known since it was first seen, while more come out', () => {
  const day = 24 * 60 * 60 * 1000
  const now = 10 * day
  const seen = answered({ checked: now - day, latest: '1.2.30', since: now - day }, now, '1.2.30', '1.2.29')
  assert.equal(seen.since, now - day)
  assert.equal(answered(seen, now, '1.2.31', '1.2.29').since, now - day)
  assert.equal(answered(seen, now, '1.2.31', '1.2.30').since, now)
})

test('the release that installs itself is the newest one out for a day, however long a newer one was known', () => {
  const day = 24 * 60 * 60 * 1000
  const now = Date.parse('2031-03-10T00:00:00.000Z')
  const at = (ago: number) => new Date(now - ago).toISOString()

  const times = {
    created: at(90 * day),
    modified: at(0),
    '1.2.29': at(9 * day),
    '1.2.30': at(3 * day),
    '1.2.31': at(day),
    '1.2.32': at(day - 1),
    '1.3.0-beta.1': at(5 * day),
  }

  assert.equal(ripest(times, now, '1.2.29'), '1.2.31')
  assert.equal(ripest([times], now, '1.2.29'), '1.2.31')
  assert.equal(ripest(times, now, '1.2.31'), undefined)
  assert.equal(ripest({ '1.2.32': 'soon' }, now, '1.2.29'), undefined)
  assert.equal(ripest('1.2.32', now, '1.2.29'), undefined)
})

test('the standing line names the newer release where there is one', () => {
  assert.match(standingLine('newer', '1.2.29', '1.2.30'), /1\.2\.30/)
  assert.doesNotMatch(standingLine('unknown', '1.2.29', '1.2.30'), /1\.2\.30/)
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

test('npm asks its registry from a folder of its own, never from the shared temp folder another user can leave an .npmrc in', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ttheme-release-'))

  const was = {
    PATH: process.env.PATH,
    XDG_STATE_HOME: process.env.XDG_STATE_HOME,
    TTHEME_UPDATED: process.env.TTHEME_UPDATED,
    TMPDIR: process.env.TMPDIR,
  }

  try {
    const shared = join(dir, 'tmp')
    const ran = join(dir, 'ran')
    mkdirSync(join(shared, 'node_modules'), { recursive: true })
    writeFileSync(join(shared, '.npmrc'), 'registry=https://registry.example.test/\n')
    mkdirSync(join(dir, 'bin'))
    writeFileSync(join(dir, 'bin', 'npm'), `#!/bin/sh\npwd -P > '${ran}'\nls -A >> '${ran}'\necho ${pkg.version}\n`)
    chmodSync(join(dir, 'bin', 'npm'), 0o755)
    process.env.PATH = `${join(dir, 'bin')}:${process.env.PATH}`
    process.env.XDG_STATE_HOME = join(dir, 'state')
    process.env.TMPDIR = shared
    delete process.env.TTHEME_UPDATED
    assert.equal((await newerRelease()).note, `  ttheme ${pkg.version} — up to date`)
    const [cwd, ...held] = readFileSync(ran, 'utf8').trim().split('\n')
    assert.deepEqual(held, ['node_modules'])
    assert.equal(existsSync(cwd as string), false)
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

test('a release check is due a day after the registry answered, an hour after a try failed, and an hour after one that never settled', () => {
  const day = 86_400_000
  const hour = 3_600_000
  const now = 10 * day
  assert.equal(checkOf({ checked: 0 }, now), 'due')
  assert.equal(checkOf({ checked: now - day + 1, latest: '1.2.30' }, now), 'waiting')
  assert.equal(checkOf({ checked: now - day, latest: '1.2.30' }, now), 'due')
  assert.equal(checkOf({ checked: now - 2 * day, failed: now - hour + 1 }, now), 'waiting')
  assert.equal(checkOf({ checked: now - 2 * day, failed: now - hour }, now), 'due')
  assert.equal(checkOf({ checked: now - 2 * day, trying: now - 29_000 }, now), 'trying')
  assert.equal(checkOf({ checked: now - 2 * day, trying: now - 31_000 }, now), 'waiting')
  assert.equal(standingOf({ checked: now - 2 * day, trying: now - 31_000, latest: '1.2.29' }, now, '1.2.29'), 'failed')
  assert.equal(checkOf({ checked: now - 2 * day, trying: now - hour }, now), 'due')
})

test('a background check that fails keeps when the registry last answered, so the next try is an hour away', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ttheme-release-'))
  const was = { PATH: process.env.PATH, XDG_STATE_HOME: process.env.XDG_STATE_HOME }

  try {
    mkdirSync(join(dir, 'bin'))
    writeFileSync(join(dir, 'bin', 'npm'), '#!/bin/sh\necho offline >&2\nexit 1\n')
    chmodSync(join(dir, 'bin', 'npm'), 0o755)
    mkdirSync(join(dir, 'state', 'ttheme'), { recursive: true })
    const stamp = join(dir, 'state', 'ttheme', 'release.json')
    const answered = Date.now() - 2 * 86_400_000
    writeFileSync(stamp, `${JSON.stringify({ checked: answered, latest: pkg.version, trying: Date.now() })}\n`)
    process.env.PATH = `${join(dir, 'bin')}:${process.env.PATH}`
    process.env.XDG_STATE_HOME = join(dir, 'state')
    assert.equal(await checkLatest(), 1)
    const seen = JSON.parse(readFileSync(stamp, 'utf8'))
    assert.equal(seen.checked, answered)
    assert.equal(seen.trying, undefined)
    assert.equal(checkOf(seen, seen.failed + 1), 'waiting')
    assert.equal(checkOf(seen, seen.failed + 3_600_000), 'due')
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

test('an update that leaves another ttheme installed than the one asked for stops the old one, and one that changed nothing does not', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ttheme-release-'))

  const was = {
    PATH: process.env.PATH,
    XDG_STATE_HOME: process.env.XDG_STATE_HOME,
    XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
    npm_config_user_agent: process.env.npm_config_user_agent,
  }

  const log = console.log

  try {
    const home = join(dir, 'config', 'ttheme')
    const npx = join(dir, 'bin', 'npx')
    mkdirSync(join(dir, 'bin'))
    mkdirSync(join(dir, 'config', 'ttheme'), { recursive: true })
    process.env.PATH = `${join(dir, 'bin')}:${process.env.PATH}`
    process.env.XDG_STATE_HOME = join(dir, 'state')
    process.env.XDG_CONFIG_HOME = join(dir, 'config')
    delete process.env.npm_config_user_agent
    console.log = () => {}

    const left = (status: number, version: string): Error | undefined => {
      writeFileSync(npx, `#!/bin/sh\nexit ${status}\n`)
      chmodSync(npx, 0o755)
      mkdirSync(join(home, 'versions', version), { recursive: true })
      rmSync(join(home, 'current'), { force: true })
      symlinkSync(join('versions', version), join(home, 'current'))

      try {
        upgradeTo('99.0.1', [])
      } catch (error) {
        return error instanceof Error ? error : new Error(String(error))
      }

      return undefined
    }

    assert.ok(left(0, '99.0.0') instanceof Replaced)
    assert.ok(left(1, '99.0.0') instanceof Replaced)
    assert.ok(left(1, '99.0.1') instanceof Replaced)
    const still = left(1, pkg.version)
    assert.ok(still && !(still instanceof Replaced))
    assert.match(still.message, /is still installed$/)
    const same = left(0, pkg.version)
    assert.ok(same && !(same instanceof Replaced))
  } finally {
    console.log = log

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
