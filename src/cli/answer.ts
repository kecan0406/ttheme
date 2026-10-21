import type { Problem } from '../core/anchors.ts'
import { Unreachable } from '../store/available.ts'

export const EXIT = { done: 0, failed: 1, unchanged: 2, input: 3, network: 4 } as const

export const EXIT_CODES: [string, string][] = [
  [String(EXIT.done), 'Done'],
  [String(EXIT.failed), 'Failed'],
  [String(EXIT.unchanged), 'Nothing changed — what it would write is already there'],
  [String(EXIT.input), 'Invalid input — the message names the field and what it takes'],
  [String(EXIT.network), 'A network request failed — try again'],
]

export class InputError extends Error {
  readonly problems: Problem[]

  constructor(message: string, problems: Problem[] = []) {
    super(message)
    this.problems = problems
  }
}

export interface Answer {
  status: 'done' | 'unchanged' | 'error'
}

export function emit<T extends Answer>(value: T): void {
  process.stdout.write(`${JSON.stringify(value, undefined, 2)}\n`)
}

export function failureOf(error: Error, input: boolean) {
  if (input || error instanceof InputError) return { code: EXIT.input, reason: 'input' }

  if (error instanceof Unreachable) return { code: EXIT.network, reason: 'network' }

  return { code: EXIT.failed, reason: 'failed' }
}
