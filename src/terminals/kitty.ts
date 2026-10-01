import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { backgroundsDir } from '../backdrop.ts'
import { kitty as emitter } from '../emit/index.ts'
import { kittyWatcher } from '../emit/kitty.ts'
import { owned } from '../theme.ts'
import { removeBlock, upsertBlock, userSets } from '../wiring.ts'
import { blockKeys, readText, stripped, tilde } from './common.ts'
import type { At, Wiring } from './types.ts'

export function kittyBlock(palette: string | undefined, watcher: string, user = ''): string {
  return [
    ...(palette ? [`include themes/${owned(palette)}.conf`] : []),
    `watcher ${watcher}`,
    ...['window_logo_scale 100', 'window_logo_alpha 1'].filter((line) => !userSets(user, line.split(' ')[0] as string)),
  ].join('\n')
}

export function kittyConfig(configHome: string): string {
  return join(configHome, 'kitty', 'kitty.conf')
}

export function kittyWatcherPath(configHome: string): string {
  return join(configHome, 'ttheme', 'kitty.py')
}

function themes(at: At): string {
  return join(at.configHome, 'kitty', 'themes')
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
    const file = kittyConfig(ctx.configHome)
    const user = readText(file)
    out.wire(file, upsertBlock(user, kittyBlock(ctx.startup, kittyWatcherPath(ctx.configHome), user)))
  },
  plan(ctx) {
    const file = kittyConfig(ctx.configHome)
    const body = kittyBlock(ctx.startup, kittyWatcherPath(ctx.configHome), readText(file))
    return [`Edit ${tilde(file, ctx.home)} — a ttheme block: ${blockKeys(body)}`]
  },
  notes(ctx) {
    const user = readText(kittyConfig(ctx.configHome))
    return userSets(user, 'window_logo_scale') || userSets(user, 'window_logo_alpha')
      ? ['kitty.conf sets its own window_logo_scale or window_logo_alpha — pictures are drawn with them']
      : []
  },
  next: () => ['New kitty window  Pictures follow it — kitty reloads its colors by itself'],
  unwire: (at) => ({ edits: stripped(kittyConfig(at.configHome), removeBlock), removals: [], touches: [] }),
}
