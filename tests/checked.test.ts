import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { ROOT } from '../src/root.ts'

function repository() {
  const dir = mkdtempSync(join(tmpdir(), 'ttheme-checked-'))

  const git = (...args: string[]) => {
    const run = spawnSync('git', ['-c', 'commit.gpgsign=false', ...args], { cwd: dir, encoding: 'utf8' })

    assert.equal(run.status, 0, run.stderr)

    return run.stdout.trim()
  }

  const commit = (subject: string, files: Record<string, string>) => {
    for (const [file, text] of Object.entries(files)) {
      writeFileSync(join(dir, file), text)
    }

    git('add', '-A')
    git('commit', '-q', '-m', subject)

    return git('rev-parse', 'HEAD')
  }

  git('init', '-q', '-b', 'main')
  git('config', 'user.email', 'tester@example.test')
  git('config', 'user.name', 'Tester')
  mkdirSync(join(dir, 'tests'))
  copyFileSync(join(ROOT, 'tests', 'checked.zsh'), join(dir, 'tests', 'checked.zsh'))
  copyFileSync(join(ROOT, 'tests', 'lane'), join(dir, 'tests', 'lane'))

  const base = commit('base', { 'package.json': '{}\n', 'CHANGELOG.md': '# Changelog\n', 'code.ts': 'one\n' })
  commit('work', { 'code.ts': 'two\n' })
  writeFileSync(
    git('rev-parse', '--git-path', 'ttheme-checked').replace(/^(?!\/)/, `${dir}/`),
    git('rev-parse', 'HEAD^{tree}'),
  )

  const push = (head: string) =>
    spawnSync('zsh', ['tests/checked.zsh', 'push'], {
      cwd: dir,
      encoding: 'utf8',
      input: `refs/heads/main ${head} refs/heads/main ${base}\n`,
    })

  return { commit, git, push }
}

test('a release commit over the tree ci passed goes through the push check', () => {
  const { commit, push } = repository()

  const pushed = push(
    commit('release: 1.0.1', { 'package.json': '{"version":"1.0.1"}\n', 'CHANGELOG.md': '# Changed\n' }),
  )

  assert.equal(pushed.status, 0, pushed.stderr)
  assert.match(pushed.stderr, /a release commit over the tree/)
})

test('a release commit that changes anything else is refused', () => {
  const { commit, push } = repository()
  const pushed = push(commit('release: 1.0.1', { 'package.json': '{"version":"1.0.1"}\n', 'code.ts': 'three\n' }))
  assert.notEqual(pushed.status, 0)
  assert.match(pushed.stderr, /refused/)
})

test('a push that moves code under site/ is refused', () => {
  const { git, push } = repository()
  mkdirSync(join(git('rev-parse', '--show-toplevel'), 'site'))
  git('mv', 'code.ts', 'site/code.ts')
  git('commit', '-q', '-m', 'site: move the code')
  const pushed = push(git('rev-parse', 'HEAD'))
  assert.notEqual(pushed.status, 0)
  assert.match(pushed.stderr, /code\.ts/)
})
