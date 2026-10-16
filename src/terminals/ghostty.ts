import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { ghostty as emitter } from '../emit/ghostty.ts'
import type { Mode, Setting } from '../mode.ts'
import { owned } from '../theme.ts'
import {
  fromHome,
  GENERATED,
  MANAGED,
  modeSetting,
  removeBlock,
  settingValue,
  upsertBlock,
  userSets,
} from '../wiring.ts'
import { blockKeys, readText, stripped, themeFiles, tilde } from './common.ts'
import type { At, Now, Wiring } from './types.ts'

const COLOR_KEYS = [
  'background',
  'foreground',
  'palette',
  'cursor-color',
  'cursor-text',
  'selection-background',
  'selection-foreground',
]

function ghosttyConfig(configHome: string): string {
  return join(configHome, 'ghostty', 'config')
}

function ghosttyOwn(configHome: string): string {
  return join(configHome, 'ttheme', 'ghostty.conf')
}

function ghosttyFiles(at: At, platform: NodeJS.Platform = process.platform): string[] {
  const support = join(at.home, 'Library', 'Application Support', 'com.mitchellh.ghostty')

  return [
    ghosttyConfig(at.configHome),
    join(at.configHome, 'ghostty', 'config.ghostty'),
    ...(platform === 'darwin' ? [join(support, 'config'), join(support, 'config.ghostty')] : []),
  ]
}

function setBy(at: At, key: string): string | undefined {
  return ghosttyFiles(at).find((file) => userSets(readText(file), key))
}

export function ghosttyBlock(tthemeDir: string, home: string): string {
  const own = join(tthemeDir, 'ghostty.conf')

  return `# ${MANAGED}\nconfig-file = ?${fromHome(own, home, '~') ?? own}`
}

export function ghosttyTheme(palette: string, setting: Setting): string {
  const named = (mode: Mode) => `${owned(palette)}.${mode}`

  return setting === 'auto' ? `light:${named('light')},dark:${named('dark')}` : named(setting)
}

export function ghosttyOwnText(
  tthemeDir: string,
  theme: string | undefined,
  launch: boolean,
  integrate: boolean,
): string {
  return [
    `# ${GENERATED}`,
    ...(launch ? [`command = ${tthemeDir}/launch-tab.zsh`, ...(integrate ? ['shell-integration = zsh'] : [])] : []),
    ...(theme ? [`theme = ${theme}`] : []),
    'config-file = ?backgrounds/shown.conf',
    '',
  ].join('\n')
}

function rotates(now: Now): boolean {
  return settingValue(now.configHome, 'TTHEME_TAB_PALETTE') !== 'off'
}

function ownText(now: Now): string {
  return ghosttyOwnText(
    join(now.configHome, 'ttheme'),
    now.startup && ghosttyTheme(now.startup, modeSetting(now.configHome)),
    rotates(now) && setBy(now, 'command') === undefined,
    setBy(now, 'shell-integration') === undefined,
  )
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
    const dir = join(ctx.configHome, 'ghostty', 'themes')
    const kept = new Set(ctx.themes.flatMap((theme) => themeFiles(ghostty, theme).map(({ file }) => file)))

    for (const file of existsSync(dir) ? readdirSync(dir) : []) {
      if (file.startsWith(owned('')) && !kept.has(file)) {
        out.remove(join(dir, file))
      }
    }

    out.write(ghosttyOwn(ctx.configHome), ownText(ctx))
    const file = ghosttyConfig(ctx.configHome)
    out.wire(file, upsertBlock(readText(file), ghosttyBlock(join(ctx.configHome, 'ttheme'), ctx.home)))
  },
  plan(now) {
    return [
      `Edit ${tilde(ghosttyConfig(now.configHome), now.home)} — a ttheme block: config-file`,
      `Write ${tilde(ghosttyOwn(now.configHome), now.home)} — ${blockKeys(ownText(now))}`,
    ]
  },
  notes(now) {
    const command = setBy(now, 'command')
    const colors = now.startup ? COLOR_KEYS.map((key) => setBy(now, key)).find(Boolean) : undefined

    return [
      ...(command && rotates(now)
        ? [
            `${tilde(command, now.home)} sets its own command — ttheme leaves it, so a new tab takes its palette once zsh starts`,
          ]
        : []),
      ...(colors
        ? [`${tilde(colors, now.home)} sets its own colors, which win over a theme — remove them to open with ttheme's`]
        : []),
    ]
  },
  next: () => ['Restart Ghostty   New tabs pick up its config'],
  unwire: (at) => ({ edits: stripped(ghosttyConfig(at.configHome), removeBlock), removals: [], touches: [] }),
}
