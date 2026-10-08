import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { backgroundsDir } from '../backdrop.ts'
import { kitty as emitter } from '../emit/index.ts'
import { kittyWatcher } from '../emit/kitty.ts'
import { owned } from '../theme.ts'
import { fromHome, GENERATED, MANAGED, removeBlock, upsertBlock, userSets } from '../wiring.ts'
import { blockKeys, readText, stripped, tilde } from './common.ts'
import type { At, Now, Wiring } from './types.ts'

export function kittyBlock(tthemeDir: string, home: string): string {
  const own = join(tthemeDir, 'kitty.conf')
  return `# ${MANAGED}\ninclude ${fromHome(own, home, '~') ?? own}`
}

export function kittyOwnText(theme: string | undefined, watcher: string, user = ''): string {
  return [
    `# ${GENERATED}`,
    ...(theme ? [`include ${theme}`] : []),
    `watcher ${watcher}`,
    ...['window_logo_scale 100', 'window_logo_alpha 1'].filter((line) => !userSets(user, line.split(' ')[0] as string)),
    '',
  ].join('\n')
}

function kittyConfig(configHome: string): string {
  return join(configHome, 'kitty', 'kitty.conf')
}

function kittyOwn(configHome: string): string {
  return join(configHome, 'ttheme', 'kitty.conf')
}

function kittyWatcherPath(configHome: string): string {
  return join(configHome, 'ttheme', 'kitty.py')
}

function themes(at: At): string {
  return join(at.configHome, 'kitty', 'themes')
}

function ownText(now: Now): string {
  return kittyOwnText(
    now.startup && join(themes(now), `${owned(now.startup)}.conf`),
    kittyWatcherPath(now.configHome),
    readText(kittyConfig(now.configHome)),
  )
}

export const kitty: Wiring = {
  id: 'kitty',
  name: 'kitty',
  emitter,
  shelf: { from: 'themes', dir: themes },
  offered: () => true,
  present: (setup) => existsSync(join(setup.configHome, 'kitty')),
  sync(ctx, out) {
    out.themes(kitty)
    out.write(
      kittyWatcherPath(ctx.configHome),
      kittyWatcher({ themes: themes(ctx), backgrounds: backgroundsDir(ctx.configHome) }),
    )
    out.write(kittyOwn(ctx.configHome), ownText(ctx))
    const file = kittyConfig(ctx.configHome)
    out.wire(file, upsertBlock(readText(file), kittyBlock(join(ctx.configHome, 'ttheme'), ctx.home)))
  },
  plan(now) {
    return [
      `Edit ${tilde(kittyConfig(now.configHome), now.home)} — a ttheme block: include`,
      `Write ${tilde(kittyOwn(now.configHome), now.home)} — ${blockKeys(ownText(now))}`,
    ]
  },
  notes(now) {
    const user = readText(kittyConfig(now.configHome))
    return userSets(user, 'window_logo_scale') || userSets(user, 'window_logo_alpha')
      ? ['kitty.conf sets its own window_logo_scale or window_logo_alpha — pictures are drawn with them']
      : []
  },
  next: () => ['New kitty window  Pictures follow it — kitty reloads its colors by itself'],
  unwire: (at) => ({ edits: stripped(kittyConfig(at.configHome), removeBlock), removals: [], touches: [] }),
}
