import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { Mode } from '../core/mode.ts'
import { owned } from '../core/theme.ts'
import { backgroundsDir } from '../pictures/backdrop.ts'
import { appearancePath } from '../store/appearance.ts'
import {
  fromHome,
  GENERATED,
  MANAGED,
  modeFor,
  modeSetting,
  removeBlock,
  upsertBlock,
  userSets,
} from '../store/wiring.ts'
import { blockKeys, pruneThemes, readText, stripped, tilde } from './common.ts'
import { kitty as emitter, kittyWatcher } from './emit/kitty.ts'
import type { At, Now, Wiring } from './types.ts'

export function kittyBlock(tthemeDir: string, home: string): string {
  const own = join(tthemeDir, 'kitty.conf')

  return `# ${MANAGED}\ninclude ${fromHome(own, home, '$HOME') ?? own}`
}

export function kittyOwnText(
  theme: string | undefined,
  watcher: string,
  mode: Mode,
  user = '',
  appearance?: string,
): string {
  return [
    `# ${GENERATED}`,
    `# mode ${mode}`,
    ...(appearance ? [`# appearance ${appearance}`] : []),
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
  const mode = modeFor(now.configHome)

  return kittyOwnText(
    now.startup && join(themes(now), `${owned(now.startup)}.${mode}.conf`),
    kittyWatcherPath(now.configHome),
    mode,
    readText(kittyConfig(now.configHome)),
    modeSetting(now.configHome) === 'auto' ? appearancePath() : undefined,
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
    pruneThemes(kitty, ctx, out)
    out.write(
      kittyWatcherPath(ctx.configHome),
      kittyWatcher({ themes: themes(ctx), backgrounds: backgroundsDir(ctx.configHome), own: kittyOwn(ctx.configHome) }),
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
