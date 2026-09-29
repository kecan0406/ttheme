import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { backgroundsDir, readBackdrop } from '../backdrop.ts'
import { iterm2 as emitter } from '../emit/index.ts'
import { itermProfiles, type ProfileBackground } from '../emit/iterm2.ts'
import { listed } from '../emit/manifest.ts'
import type { Installed } from '../palettes.ts'
import { tilde } from './common.ts'
import type { Ctx, Defaults, Host, Moment, Wiring } from './types.ts'

export const ITERM_DEFAULT = 'ttheme-default'

export function itermProfilesPath(home: string): string {
  return join(home, 'Library', 'Application Support', 'iTerm2', 'DynamicProfiles', 'ttheme.json')
}

function keeps(state: Installed): boolean {
  return state.itermBase !== undefined && state.palettes.length > 0
}

function profiles(ctx: Ctx): string {
  const dir = backgroundsDir(ctx.configHome)
  const pictures = new Map<string, ProfileBackground>()
  for (const theme of ctx.themes) {
    const picture = readBackdrop(dir, theme.name, ctx.home)
    if (picture) {
      pictures.set(theme.name, picture)
    }
  }
  const shown = new Set(listed(ctx.entries).map((entry) => entry.name))
  return itermProfiles(
    ctx.themes.filter((theme) => shown.has(theme.name)),
    pictures,
    ctx.themes.find((theme) => theme.name === ctx.startup),
    ctx.state.itermBase,
    keeps(ctx.state),
  )
}

function suite(host: Host): string {
  return host.env.TTHEME_ITERM_SUITE ?? 'com.googlecode.iterm2'
}

function current(host: Host): string | undefined {
  return host.run('defaults', ['read', suite(host), 'Default Bookmark Guid']) || undefined
}

const defaults: Defaults = {
  key: 'itermBase',
  profile: () => 'ttheme · default',
  base(moment: Moment) {
    const guid = current(moment.host)
    return guid && !guid.startsWith('ttheme-') ? { ...moment.state, itermBase: guid } : moment.state
  },
  point(moment: Moment, take: boolean) {
    const now = current(moment.host)
    const want = moment.startup
      ? take || now === ITERM_DEFAULT
        ? ITERM_DEFAULT
        : undefined
      : now === ITERM_DEFAULT && !keeps(moment.state)
        ? moment.state.itermBase
        : undefined
    if (!want || want === now) {
      return undefined
    }
    moment.host.run('defaults', ['write', suite(moment.host), 'Default Bookmark Guid', '-string', want])
    return { restart: Boolean(moment.host.run('pgrep', ['-x', 'iTerm2'])) }
  },
}

export const iterm2: Wiring = {
  id: 'iterm2',
  name: 'iTerm2',
  emitter,
  bakes: true,
  offered: (_, host) => host.platform === 'darwin',
  present: (setup) => existsSync(join(setup.home, 'Library', 'Application Support', 'iTerm2')),
  sync(ctx, out) {
    out.write(itermProfilesPath(ctx.home), profiles(ctx))
  },
  pictures(ctx, out) {
    out.write(itermProfilesPath(ctx.home), profiles(ctx))
  },
  plan: (ctx) => [`Write ${tilde(itermProfilesPath(ctx.home), ctx.home)} — a "ttheme · <palette>" profile per palette`],
  notes: () => [],
  next(ctx, pointed) {
    const lines = ['iTerm2 profiles   A "ttheme · <palette>" per palette in Settings › Profiles']
    if (ctx.startup) {
      lines.push(
        pointed?.restart
          ? `Restart iTerm2    New tabs open on "ttheme · default", which wears ${ctx.startup}`
          : `iTerm2 default    "ttheme · default" wears ${ctx.startup} and follows \`ttheme default\``,
      )
    }
    return lines
  },
  unwire: (at) => ({
    edits: [],
    removals: existsSync(itermProfilesPath(at.home)) ? [itermProfilesPath(at.home)] : [],
    touches: [],
  }),
  defaults,
}
