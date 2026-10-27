import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { listed } from '../core/manifest.ts'
import { backgroundsDir } from '../pictures/backdrop.ts'
import { type ProfileBackground, readBackdrop } from '../pictures/conf.ts'
import type { Host } from '../store/host.ts'
import type { Installed } from '../store/installed.ts'
import { modeSetting } from '../store/wiring.ts'
import { tilde } from './common.ts'
import { iterm2 as emitter, itermProfiles } from './emit/iterm2.ts'
import type { Ctx, Defaults, Moment, Wiring } from './types.ts'

const ITERM_DEFAULT = 'ttheme-default'

export function itermProfilesPath(home: string): string {
  return join(itermSupport(home), 'DynamicProfiles', 'ttheme.json')
}

function itermSupport(home: string): string {
  return join(home, 'Library', 'Application Support', 'iTerm2')
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
    modeSetting(ctx.configHome) === 'auto',
  )
}

function suite(host: Host): string {
  return host.env.TTHEME_ITERM_SUITE ?? 'com.googlecode.iterm2'
}

function current(host: Host): string | undefined {
  return host.run('defaults', ['read', suite(host), 'Default Bookmark Guid']) || undefined
}

function switches(host: Host): boolean {
  return host.run('defaults', ['read', suite(host), 'PreventEscapeSequenceFromChangingProfile']) === '0'
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
  present: (setup) => existsSync(itermSupport(setup.home)),
  sync(ctx, out) {
    out.write(itermProfilesPath(ctx.home), profiles(ctx), itermSupport(ctx.home))
  },
  pictures(ctx, out) {
    out.write(itermProfilesPath(ctx.home), profiles(ctx), itermSupport(ctx.home))
  },
  layer: (now, host) => ({
    TTHEME_ITERM_SWITCH: switches(host) ? '1' : '',
    TTHEME_ITERM_PROFILES: itermProfilesPath(now.home),
  }),
  plan: (ctx) => [`Write ${tilde(itermProfilesPath(ctx.home), ctx.home)} — a "ttheme · <palette>" profile per palette`],
  notes: () => [],
  next(ctx, pointed) {
    const lines = ['iTerm2 profiles   A "ttheme · <palette>" per palette in Settings › Profiles']

    if (ctx.startup) {
      lines.push(
        pointed?.restart
          ? `Restart iTerm2    New tabs open on "ttheme · default", which shows ${ctx.startup}`
          : `iTerm2 default    "ttheme · default" shows ${ctx.startup} and follows \`ttheme default\``,
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
