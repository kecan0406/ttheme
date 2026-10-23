import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { decodePng, encodeRgb, flatten, type Rgba } from '../core/png.ts'
import { owned, stem } from '../core/theme.ts'
import { backgroundsDir } from '../pictures/backdrop.ts'
import { readBackdrop } from '../pictures/conf.ts'
import { rewrite } from '../store/edits.ts'
import { readInstalled } from '../store/installed.ts'
import { colorless, paletteOsc, queryTerminalColors, restoreOsc, specColors } from './osc.ts'
import { detectTerminal, type Live, SETTLE_MS } from './terminal.ts'
import { canvasFor, heldIn, terminalPictures, terminalProfile, terminalScript, windowOf } from './terminal-app.ts'

type Env = Record<string, string | undefined>

export function terminalLive(
  env: Env,
  tty: boolean,
  configHome: string,
  home = homedir(),
  write: (text: string) => void = (text) => {
    process.stdout.write(text)
  },
): Live | undefined {
  if (!tty || colorless(env) || env.TMUX || detectTerminal(env) !== 'terminal-app') {
    return undefined
  }

  const [name = '', version = '-'] = (env.TTHEME_TERMINAL_SHOWN ?? '').split(' ')
  const at = env.TTHEME_TTY
  const picture = name ? readBackdrop(backgroundsDir(configHome), name, home) : undefined
  const files = heldIn(terminalPictures(configHome)).get(stem(name)) ?? []
  const file = files.find((one) => one === `${owned(name)}.${version}.png`) ?? files[0]

  if (!at || !picture || version === '-' || !file || !existsSync(picture.image)) {
    return undefined
  }

  const own = join(terminalPictures(configHome), file)
  const args = ['-l', 'JavaScript', terminalScript(configHome), 'tab', at, terminalProfile(name)]
  const base = readInstalled(configHome).terminalBase ?? 'Basic'
  const window = windowOf(env, home)
  const kept = readFileSync(own)
  let source: Rgba | undefined
  let held = own
  let made = 0
  let settle: NodeJS.Timeout | undefined
  let busy = false
  let over = false
  let next: (() => void) | undefined

  const tell = (osc: string) => {
    busy = true
    spawn('osascript', [...args, base], { stdio: 'ignore' }).on('close', () => {
      busy = false

      if (over) {
        return
      }

      write(osc)
      const run = next
      next = undefined
      run?.()
    })
  }

  const show = (background: string, osc: string) => {
    source ??= decodePng(new Uint8Array(readFileSync(picture.image)))
    const out = join(terminalPictures(configHome), `${owned(name)}.h${process.pid}-${++made}.png`)
    rewrite(
      held,
      out,
      encodeRgb(flatten(source, background, picture.opacity, canvasFor(source.width, source.height, picture, window))),
    )
    held = out
    tell(osc)
  }

  const back = () => {
    if (held !== own) {
      rewrite(held, own, kept)
      held = own
    }
  }

  const queue = (run: () => void) => {
    clearTimeout(settle)
    settle = setTimeout(() => {
      if (busy) {
        next = run
      } else {
        run()
      }
    }, SETTLE_MS)
  }

  const stop = () => {
    clearTimeout(settle)
    next = undefined
    over = true
    back()
  }

  return {
    slots: [],
    paint(entry) {
      queue(
        entry.name === name
          ? () => {
              back()
              tell(paletteOsc(entry))
            }
          : () => show(entry.background, paletteOsc(entry)),
      )

      return ''
    },
    wear(entry) {
      const told = spawnSync('osascript', [...args.slice(0, -1), terminalProfile(entry.name), base], {
        encoding: 'utf8',
      })

      return told.stdout?.trim() === 'worn' ? '' : paletteOsc(entry)
    },
    saved: async (look) => (look === undefined ? queryTerminalColors() : specColors(look)),
    restore(saved) {
      stop()
      const told = spawnSync('osascript', [...args, base], { encoding: 'utf8' })

      return told.stdout?.trim() === 'worn' ? '' : restoreOsc(saved)
    },
    stop,
  }
}
