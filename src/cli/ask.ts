import * as clack from '@clack/prompts'

export * from '@clack/prompts'

async function asked<T>(ask: (signal: AbortSignal) => Promise<T>): Promise<T> {
  for (;;) {
    const stop = new AbortController()
    const suspend = () => stop.abort()

    process.once('SIGTSTP', suspend)
    const answer = await ask(stop.signal)
    process.off('SIGTSTP', suspend)

    if (!stop.signal.aborted) {
      return answer
    }

    process.kill(0, 'SIGTSTP')
  }
}

export function confirm(options: clack.ConfirmOptions) {
  return asked((signal) => clack.confirm({ ...options, signal }))
}

export function select<T>(options: clack.SelectOptions<T>) {
  return asked((signal) => clack.select<T>({ ...options, signal }))
}

export function multiselect<T>(options: clack.MultiSelectOptions<T>) {
  return asked((signal) => clack.multiselect<T>({ ...options, signal }))
}

export function text(options: clack.TextOptions) {
  return asked((signal) => clack.text({ ...options, signal }))
}
