import { existsSync, utimesSync } from 'node:fs'
import { join } from 'node:path'
import { BLOCK, BLOCK_BEGIN, BLOCK_END, GENERATED, MANAGED, removeBlock } from '../store/wiring.ts'
import { pruneThemes, readText, stripped, tilde } from './common.ts'
import { rio as emitter, rioTheme } from './emit/rio.ts'
import type { At, Ctx, Wiring } from './types.ts'

const TOML_TABLE = /^[ \t]*\[/m
const TOML_THEME = /^[ \t]*theme[ \t]*=/m
const TOML_COLORS = /^[ \t]*\[colors\][ \t]*(?:#.*)?$/m
const TOML_ADAPTIVE = /^[ \t]*\[adaptive-theme\]/m

const NAME = 'ttheme'

function rioDir(at: At): string {
  return join(at.configHome, 'rio')
}

export function rioConfig(at: At): string {
  return join(rioDir(at), 'config.toml')
}

function themes(at: At): string {
  return join(rioDir(at), 'themes')
}

function rioOwn(at: At): string {
  return join(themes(at), `${NAME}.toml`)
}

export function upsertRioTheme(content: string): string | undefined {
  const block = `${BLOCK_BEGIN}\n# ${MANAGED}\ntheme = ${JSON.stringify(NAME)}\n${BLOCK_END}\n`

  if (BLOCK.test(content)) {
    return content.replace(BLOCK, block)
  }

  const first = content.search(TOML_TABLE)

  if (TOML_THEME.test(first < 0 ? content : content.slice(0, first))) {
    return undefined
  }

  return content === '' ? block : `${block}\n${content}`
}

export function ownColors(config: string): string {
  const outside = config.replace(BLOCK, '')
  const at = outside.search(TOML_COLORS)

  if (at < 0) {
    return ''
  }

  const body = outside.slice(outside.indexOf('\n', at) + 1)
  const next = body.search(TOML_TABLE)

  return `[colors]\n${(next < 0 ? body : body.slice(0, next)).trimEnd()}\n`
}

function ownText(ctx: Ctx): string {
  const theme = ctx.startup ? ctx.themes.find((t) => t.name === ctx.startup) : undefined
  const own = theme ? rioTheme(theme) : ownColors(readText(rioConfig(ctx)))

  return own ? `# ${GENERATED}\n${own}` : `# ${GENERATED}\n`
}

export const rio: Wiring = {
  id: 'rio',
  name: 'Rio',
  emitter,
  shelf: { from: 'themes', dir: themes },
  offered: () => true,
  present: (setup) => existsSync(rioDir(setup)),
  sync(ctx, out) {
    out.themes(rio)
    pruneThemes(rio, ctx, out)
    const config = rioConfig(ctx)

    if (out.write(rioOwn(ctx), ownText(ctx)) && existsSync(config)) {
      const now = new Date()
      utimesSync(config, now, now)
    }

    const wired = upsertRioTheme(readText(config))

    if (wired !== undefined) {
      out.wire(config, wired)
    }
  },
  plan(now) {
    return upsertRioTheme(readText(rioConfig(now))) !== undefined
      ? [
          `Edit ${tilde(rioConfig(now), now.home)} — a ttheme block: theme`,
          `Write ${tilde(rioOwn(now), now.home)} — the theme it names`,
        ]
      : []
  },
  notes(now) {
    const config = rioConfig(now)
    const content = readText(config)

    return [
      ...(existsSync(config) && upsertRioTheme(content) === undefined
        ? [
            `${tilde(config, now.home)} names its own theme — ttheme left it alone; set \`theme = "${NAME}"\` there to open with ttheme's`,
          ]
        : []),
      ...(TOML_ADAPTIVE.test(content.replace(BLOCK, ''))
        ? [
            `${tilde(config, now.home)} sets an [adaptive-theme], whose colors win over the theme — remove it to open with ttheme's`,
          ]
        : []),
    ]
  },
  next: () => ['Rio               Reloads its config by itself'],
  unwire: (at) => ({
    edits: stripped(rioConfig(at), removeBlock),
    removals: existsSync(rioOwn(at)) ? [rioOwn(at)] : [],
    touches: [],
  }),
}
