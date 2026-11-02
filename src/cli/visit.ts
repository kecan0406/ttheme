import { spawn } from 'node:child_process'

export function visit(url: string): boolean {
  if (process.env.SSH_CONNECTION || !/^(?:https?|file):/i.test(url)) {
    return false
  }

  try {
    const opener = spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], {
      stdio: 'ignore',
      detached: true,
    })

    opener.on('error', () => {})
    opener.unref()

    return true
  } catch {
    return false
  }
}
