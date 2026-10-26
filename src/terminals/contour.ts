import { existsSync, utimesSync } from 'node:fs'
import { join } from 'node:path'
import { type Mode, modeOf } from '../core/mode.ts'
import { inOther } from '../core/theme.ts'
import { BLOCK, BLOCK_BEGIN, BLOCK_END, GENERATED, MANAGED, modeSetting } from '../store/wiring.ts'
import { pruneThemes, readText, stripped, tilde } from './common.ts'
import { contourScheme, contour as emitter } from './emit/contour.ts'
import type { At, Ctx, Now, Wiring } from './types.ts'

const NAME = 'ttheme'
const MODES: readonly Mode[] = ['dark', 'light']
const DEFAULT_LINE = /^default_profile[ \t]*:.*(?:\n|$)/m
const WAS = /^# was: (default_profile[ \t]*:.*)$/m
const OURS = /^default_profile[ \t]*:[ \t]*["']?ttheme["']?[ \t]*$/

function contourDir(at: At): string {
  return join(at.configHome, 'contour')
}

export function contourSettings(at: At): string {
  return join(contourDir(at), 'settings.yml')
}

function contourConfig(at: At): string {
  return join(contourDir(at), 'contour.yml')
}

function schemes(at: At): string {
  return join(contourDir(at), 'colorschemes')
}

function profile(at: At): string {
  return join(contourDir(at), 'profiles', `${NAME}.yml`)
}

function scheme(at: At, mode: Mode): string {
  return join(schemes(at), `${NAME}.${mode}.yml`)
}

export function upsertContourDefault(content: string): string | undefined {
  const was = WAS.exec(BLOCK.exec(content)?.[0] ?? '')?.[1]
  const outside = content.replace(BLOCK, '')

  if (/^\s*[{[]/.test(outside)) {
    return undefined
  }

  const own = DEFAULT_LINE.exec(outside)?.[0].trimEnd()
  const kept = was ?? (own && !OURS.test(own) ? own : undefined)
  const rest = outside.replace(DEFAULT_LINE, '').replace(/^\n+/, '')

  const block = [
    BLOCK_BEGIN,
    `# ${MANAGED}`,
    ...(kept ? [`# was: ${kept}`] : []),
    `default_profile: ${NAME}`,
    `${BLOCK_END}\n`,
  ].join('\n')

  return rest ? `${block}${rest}` : block
}

export function removeContourDefault(content: string): string {
  const inner = BLOCK.exec(content)?.[0]

  if (inner === undefined) {
    return content
  }

  const was = WAS.exec(inner)?.[1]
  const out = content.replace(BLOCK, was ? `${was}\n` : '')

  return out.trim() === '' ? '' : out.replace(/\n*$/, '\n')
}

function shadeIn(ctx: Ctx, mode: Mode) {
  const theme = ctx.startup ? ctx.themes.find((t) => t.name === ctx.startup) : undefined

  return theme ? ([theme, ...inOther(theme)].find((shade) => modeOf(shade) === mode) ?? theme) : undefined
}

function profileText(ctx: Ctx): string {
  if (!ctx.startup) {
    return `# ${GENERATED}\n{}\n`
  }

  const setting = modeSetting(ctx.configHome)

  return setting === 'auto'
    ? `# ${GENERATED}\ncolors:\n    dark: ${NAME}.dark\n    light: ${NAME}.light\n`
    : `# ${GENERATED}\ncolors: ${NAME}.${setting}\n`
}

export const contour: Wiring = {
  id: 'contour',
  name: 'Contour',
  emitter,
  shelf: { from: 'colorschemes', dir: schemes },
  offered: () => true,
  present: (setup) => existsSync(contourDir(setup)),
  sync(ctx, out) {
    out.themes(contour)
    pruneThemes(contour, ctx, out)
    let moved = false

    for (const mode of MODES) {
      const shade = shadeIn(ctx, mode)

      if (shade) {
        moved = out.write(scheme(ctx, mode), `# ${GENERATED}\n${contourScheme(shade)}`) || moved
      } else if (existsSync(scheme(ctx, mode))) {
        out.remove(scheme(ctx, mode))
      }
    }

    moved = out.write(profile(ctx), profileText(ctx)) || moved
    const config = contourConfig(ctx)

    if (moved && existsSync(config)) {
      const now = new Date()
      utimesSync(config, now, now)
    }

    const settings = contourSettings(ctx)
    const wired = upsertContourDefault(readText(settings))

    if (wired !== undefined) {
      out.wire(settings, wired)
    }
  },
  plan(now) {
    return upsertContourDefault(readText(contourSettings(now))) !== undefined
      ? [
          `Edit ${tilde(contourSettings(now), now.home)} — a ttheme block: default_profile`,
          `Write ${tilde(profile(now), now.home)} — colors, over your default profile`,
        ]
      : []
  },
  notes(now: Now) {
    const settings = contourSettings(now)

    return existsSync(settings) && upsertContourDefault(readText(settings)) === undefined
      ? [
          `${tilde(settings, now.home)} is not a plain YAML map — ttheme left it alone; set \`default_profile: ${NAME}\` there to open with ttheme's`,
        ]
      : []
  },
  next: () => ['Restart Contour   New tabs pick up its profile'],
  unwire: (at) => ({
    edits: stripped(contourSettings(at), removeContourDefault),
    removals: [profile(at), scheme(at, 'dark'), scheme(at, 'light')].filter((file) => existsSync(file)),
    touches: [],
  }),
}
