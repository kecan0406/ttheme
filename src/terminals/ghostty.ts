import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { ghostty as emitter } from '../emit/index.ts'
import { owned } from '../theme.ts'
import { removeBlock, upsertBlock, userSets } from '../wiring.ts'
import { blockKeys, readText, stripped, tilde } from './common.ts'
import type { At, Wiring } from './types.ts'

export function ghosttyBlock(tthemeDir: string, palette: string | undefined, user = ''): string {
  const lines: string[] = []
  if (!userSets(user, 'command')) {
    lines.push(`command = ${tthemeDir}/launch-tab.zsh`)
    if (!userSets(user, 'shell-integration')) {
      lines.push('shell-integration = zsh')
    }
  }
  if (palette) {
    lines.push(`theme = ${owned(palette)}`)
  }
  lines.push(`config-file = ?${tthemeDir}/backgrounds/shown.conf`)
  return lines.join('\n')
}

export function ghosttyConfig(configHome: string): string {
  return join(configHome, 'ghostty', 'config')
}

function block(at: At, startup: string | undefined, user: string): string {
  return ghosttyBlock(join(at.configHome, 'ttheme'), startup, user)
}

export const ghostty: Wiring = {
  id: 'ghostty',
  name: 'Ghostty',
  emitter,
  shelf: { from: 'themes', dir: (at) => join(at.configHome, 'ghostty', 'themes') },
  offered: () => true,
  present: (setup) => existsSync(join(setup.configHome, 'ghostty')),
  sync(ctx, out) {
    out.themes(ghostty)
    const file = ghosttyConfig(ctx.configHome)
    const user = readText(file)
    out.wire(file, upsertBlock(user, block(ctx, ctx.startup, user)))
  },
  plan(ctx) {
    const file = ghosttyConfig(ctx.configHome)
    return [`Edit ${tilde(file, ctx.home)} — a ttheme block: ${blockKeys(block(ctx, ctx.startup, readText(file)))}`]
  },
  notes(ctx) {
    const file = ghosttyConfig(ctx.configHome)
    return userSets(readText(file), 'command')
      ? [
          `${tilde(file, ctx.home)} sets its own command — ttheme leaves it, so a new tab takes its palette once zsh starts`,
        ]
      : []
  },
  next: () => ['Restart Ghostty   New tabs pick up its config'],
  unwire: (at) => ({ edits: stripped(ghosttyConfig(at.configHome), removeBlock), removals: [], touches: [] }),
}
