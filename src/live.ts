import { type Live, livePaint } from './terminal.ts'
import { terminalLive } from './terminal-live.ts'
import { warpLive } from './warp-live.ts'

export function liveOf(env: Record<string, string | undefined>, tty: boolean, configHome: string): Live | undefined {
  return terminalLive(env, tty, configHome) ?? livePaint(env, tty) ?? warpLive(env, tty, configHome)
}
