import { createHash } from 'node:crypto'

function hashOf(script: string): string {
  return `'sha256-${createHash('sha256').update(script).digest('base64')}'`
}

export function contentPolicy(scripts: readonly string[]): string {
  return [
    "default-src 'self'",
    `script-src 'self' ${scripts.map(hashOf).join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
  ].join('; ')
}
