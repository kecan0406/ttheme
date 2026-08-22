'use client'

import { useState } from 'react'

export function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(command)
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }

  return (
    <span className="inline-flex flex-none items-stretch overflow-hidden rounded-md border border-line bg-card text-xs text-ink">
      <code className="px-2.5 py-[5px]">
        <span className="select-none text-muted">$ </span>
        {command}
      </code>
      <button
        type="button"
        onClick={copy}
        className="cursor-pointer border-l border-line px-2.5 text-muted transition-colors hover:text-accent"
      >
        {copied ? 'copied ✓' : 'copy'}
      </button>
    </span>
  )
}
