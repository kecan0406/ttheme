import assert from 'node:assert/strict'
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { heldElsewhere, placedSkills, placeSkill, SKILL, skillPath } from './agent-skills.ts'

function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'ttheme-skill-'))
  const root = join(dir, 'package')
  const homes = { home: join(dir, 'home'), claude: join(dir, 'home', '.claude') }

  mkdirSync(join(root, 'skills', SKILL), { recursive: true })
  writeFileSync(join(root, 'skills', SKILL, 'SKILL.md'), '---\nname: ttheme-palette\n---\n')
  mkdirSync(homes.claude, { recursive: true })

  return { dir, root, homes }
}

test('placeSkill keeps one copy in ~/.agents/skills and links Claude Code to it', () => {
  const { dir, root, homes } = setup()

  assert.deepEqual(placeSkill(root, ['claude', 'agents'], homes), { placed: ['agents', 'claude'], failed: [] })
  assert.ok(lstatSync(skillPath('claude', homes)).isSymbolicLink())
  assert.match(readFileSync(join(skillPath('claude', homes), 'SKILL.md'), 'utf8'), /ttheme-palette/)
  assert.deepEqual(placedSkills(['agents', 'claude'], homes), [skillPath('agents', homes), skillPath('claude', homes)])
  rmSync(dir, { recursive: true, force: true })
})

test('placeSkill copies into Claude Code alone when the other agents are not asked for', () => {
  const { dir, root, homes } = setup()

  placeSkill(root, ['claude'], homes)
  assert.ok(lstatSync(skillPath('claude', homes)).isDirectory())
  assert.deepEqual(placedSkills(['agents'], homes), [])
  rmSync(dir, { recursive: true, force: true })
})

test('placeSkill leaves the copy alone where ~/.claude/skills is a link to ~/.agents/skills', () => {
  const { dir, root, homes } = setup()

  mkdirSync(join(homes.home, '.agents', 'skills'), { recursive: true })
  symlinkSync(join(homes.home, '.agents', 'skills'), join(homes.claude, 'skills'), 'dir')
  placeSkill(root, ['agents', 'claude'], homes)
  assert.match(readFileSync(join(skillPath('agents', homes), 'SKILL.md'), 'utf8'), /ttheme-palette/)
  rmSync(dir, { recursive: true, force: true })
})

test('a skill another installer put there, or a Claude Code plugin, is not ours to replace', () => {
  const { dir, homes } = setup()

  mkdirSync(skillPath('agents', homes), { recursive: true })
  assert.equal(heldElsewhere('agents', homes, []), true)
  assert.equal(heldElsewhere('agents', homes, ['agents']), false)
  mkdirSync(join(homes.claude, 'plugins'), { recursive: true })
  writeFileSync(join(homes.claude, 'plugins', 'installed_plugins.json'), `{"plugins": {"${SKILL}@ttheme": []}}`)
  assert.equal(heldElsewhere('claude', homes, ['claude']), true)
  rmSync(dir, { recursive: true, force: true })
})
