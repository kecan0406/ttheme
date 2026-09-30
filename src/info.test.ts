import assert from 'node:assert/strict'
import { test } from 'node:test'
import { describeTerminal } from './info.ts'

test('a terminal reports its version from TERM_PROGRAM_VERSION', () => {
  assert.equal(
    describeTerminal({ TERM_PROGRAM: 'ghostty', TERM_PROGRAM_VERSION: '1.3.1' }),
    'ghostty 1.3.1 · tmux no · ssh no',
  )
})

test('inside tmux the version in TERM_PROGRAM_VERSION is tmux, not the terminal', () => {
  assert.equal(
    describeTerminal({
      GHOSTTY_RESOURCES_DIR: '/x',
      TERM_PROGRAM: 'tmux',
      TERM_PROGRAM_VERSION: '3.5a',
      TMUX: '/tmp/tmux-501/default,1,0',
    }),
    'ghostty (version unknown) · tmux 3.5a · ssh no',
  )
})

test('Konsole spells its version out of KONSOLE_VERSION', () => {
  assert.equal(describeTerminal({ KONSOLE_VERSION: '230805' }), 'konsole 23.08.5 · tmux no · ssh no')
})

test('an unknown terminal names its TERM_PROGRAM and an ssh session says so', () => {
  assert.equal(
    describeTerminal({ TERM_PROGRAM: 'vscode', SSH_TTY: '/dev/pts/0' }),
    'unknown (TERM_PROGRAM=vscode) · tmux no · ssh yes',
  )
})
