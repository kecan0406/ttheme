import { homedir } from 'node:os'
import * as p from '@clack/prompts'
import { Cancelled } from '../core/cancelled.ts'
import { WIRED, type Wired } from '../core/wired.ts'
import { readMarketplaces } from '../store/available.ts'
import { systemHost } from '../store/host.ts'
import { readInstalled, writeInstalled } from '../store/installed.ts'
import { configHome } from '../store/paths.ts'
import { WIRINGS } from '../terminals/index.ts'
import { interactive } from '../tui/terminal.ts'
import { pointDefaults, sync, wiringNext, wiringNotes, wiringPlan, withBases } from './sync.ts'

export async function runWire(name: string): Promise<number> {
  if (!(WIRED as readonly string[]).includes(name)) {
    throw new Error(`no terminal ${name} — one of ${WIRED.join(', ')}`)
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
      'Each config is backed up once to <file>.ttheme.bak before the first edit — `npx @kecan0406/ttheme uninstall` takes it all out',
    ].join('\n'),
    `Wiring ${wiring.name}`,
  )
  const ok = await p.confirm({ message: `Wire ${wiring.name} now?`, initialValue: false })

  if (p.isCancel(ok) || !ok) {
    p.cancel('Nothing changed')
    throw new Cancelled()
  }

  const based = withBases(config, alone, host, home)
  const installed = { ...based, terminals: [...state.terminals, id] }
  writeInstalled(config, installed)
  sync(config, readMarketplaces(config), installed, home, host)
  const pointed = pointDefaults(config, based, true, host, home)
  const next = wiringNext(config, based, pointed, home)

  if (next.length > 0) {
    p.note(next.join('\n'), 'Next')
  }

  p.outro(`Wired ${wiring.name}`)

  return 0
}
