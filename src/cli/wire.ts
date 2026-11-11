import { homedir } from 'node:os'
import { Cancelled } from '../core/cancelled.ts'
import { WIRED, type Wired } from '../core/wired.ts'
import { readMarketplaces } from '../store/available.ts'
import { systemHost } from '../store/host.ts'
import { readInstalled } from '../store/installed.ts'
import { configHome } from '../store/paths.ts'
import { WIRINGS } from '../terminals/index.ts'
import { interactive } from '../tui/terminal.ts'
import { InputError } from './answer.ts'
import * as p from './ask.ts'
import { launch } from './release.ts'
import { commit, wiringNext, wiringNotes, wiringPlan } from './sync.ts'

export async function runWire(name: string): Promise<number> {
  if (!(WIRED as readonly string[]).includes(name)) {
    throw new InputError(`no terminal ${name} — one of ${WIRED.join(', ')}`)
  }

  const id = name as Wired
  const wiring = WIRINGS[id]
  const config = configHome()
  const home = homedir()
  const host = systemHost()
  const state = readInstalled(config)

  if (state.terminals.includes(id)) {
    console.log(`${wiring.name} is wired already`)

    return 0
  }

  const setup = { configHome: config, home }

  if (!wiring.offered(setup, host)) {
    throw new Error(`${wiring.name} cannot be wired on this system`)
  }

  if (!interactive()) {
    throw new Error('wire asks before it edits your configs — run it in a terminal')
  }

  const alone = { ...state, ...(wiring.installs?.(setup) ?? {}), terminals: [id] }
  p.note(
    [
      ...wiringPlan(config, alone, home),
      ...wiringNotes(config, alone, home),
      `Each config is backed up once to <file>.ttheme.bak before the first edit — \`${launch(state.runner ?? 'npx', 'uninstall')}\` takes it all out`,
    ].join('\n'),
    `Wiring ${wiring.name}`,
  )
  const ok = await p.confirm({ message: `Wire ${wiring.name} now?`, initialValue: false })

  if (p.isCancel(ok) || !ok) {
    p.cancel('Nothing changed')
    throw new Cancelled()
  }

  const wired = { ...alone, terminals: [...state.terminals, id] }
  const pointed = commit(config, readMarketplaces(config), state, wired, [id], host, home)
  const next = wiringNext(config, { ...readInstalled(config), terminals: [id] }, pointed, home)

  if (next.length > 0) {
    p.note(next.join('\n'), 'Next')
  }

  p.outro(`Wired ${wiring.name}`)

  return 0
}
