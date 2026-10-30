import { spawn } from 'node:child_process'

export function visit(url: string): void {
  if (process.env.SSH_CONNECTION || !/^(?:https?|file):/i.test(url)) {
    return
  }

  try {
    const opener = spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], {
      stdio: 'ignore',
      detached: true,
    })

    opener.on('error', () => {})
    opener.unref()
  } catch {}
}
