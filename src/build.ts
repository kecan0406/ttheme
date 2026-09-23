import { rmSync } from 'node:fs'
import { basename, join } from 'node:path'
import { checkAll } from './contrast.ts'
import {
  alacritty,
  type Emitter,
  ghostty,
  iterm2,
  kitty,
  meta,
  shell,
  warp,
  wezterm,
  windowsTerminal,
} from './emit/index.ts'
import { loadThemes, rotation } from './theme.ts'

const root = join(import.meta.dirname, '..')
const THEMES = join(root, 'themes')
const DIST = join(root, 'dist')

const TERMINAL_EMITTERS: Emitter[] = [ghostty, kitty, alacritty, wezterm, iterm2, windowsTerminal, warp]
const SHARED_EMITTERS: Emitter[] = [shell, meta]

export const EMITTED = TERMINAL_EMITTERS.map((e) => e.id)

export async function build({ only }: { only?: string[] } = {}): Promise<void> {
  if (typeof Bun === 'undefined') {
    throw new Error('needs bun — run it from a checkout: bun src/bin.ts build')
  }
  const terminals = only && only.length > 0 ? TERMINAL_EMITTERS.filter((e) => only.includes(e.id)) : TERMINAL_EMITTERS

  const themes = loadThemes(THEMES)

  const violations = checkAll(themes)
  if (violations.length > 0) {
    for (const v of violations) {
      console.error(`  ✗ ${v.theme} [${v.rule}] ${v.detail}`)
    }
    throw new Error(
      `${violations.length} contrast violation(s). Fix the palette, or waive the rule in its [contrast] section with a reason.`,
    )
  }

  if (terminals.length === TERMINAL_EMITTERS.length) {
    rmSync(DIST, { recursive: true, force: true })
  } else {
    for (const e of terminals) {
      rmSync(join(DIST, e.id), { recursive: true, force: true })
    }
  }

  let count = 0
  for (const emitter of [...terminals, ...SHARED_EMITTERS]) {
    const perTheme = themes.flatMap((t) => emitter.emit?.(t) ?? [])
    const sharedOutputs = emitter.emitShared?.(themes) ?? []
    for (const out of [...perTheme, ...sharedOutputs]) {
      await Bun.write(join(DIST, out.path), out.content)
      count++
    }
    const label =
      perTheme.length > 0
        ? `${themes.length} themes${emitter.limits ? `  (${emitter.limits})` : ''}`
        : sharedOutputs.map((out) => basename(out.path)).join(' ')
    console.log(`  ${emitter.id.padEnd(16)} ${label}`)
  }

  console.log(
    `\n${themes.length} themes (${rotation(themes).length} in the new-tab rotation) -> ${count} files in dist/`,
  )
}
