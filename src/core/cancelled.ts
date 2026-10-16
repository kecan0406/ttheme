export class Cancelled extends Error {}

export const SIGNALS = { SIGHUP: 1, SIGINT: 2, SIGQUIT: 3, SIGTERM: 15 } as const

export class Signalled extends Error {
  readonly exit: number

  constructor(signal: keyof typeof SIGNALS) {
    super(signal)
    this.exit = 128 + SIGNALS[signal]
  }
}
