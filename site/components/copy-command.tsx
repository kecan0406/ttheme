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
    <span className="inline-flex flex-none items-stretch overflow-hidden rounded-md border border-border bg-card text-xs text-foreground">
      <code className="px-2.5 py-[5px]">
        <span className="select-none text-muted-foreground">$ </span>
        {command}
      </code>
      <button
        type="button"
        onClick={copy}
        className="cursor-pointer border-l border-border px-2.5 text-muted-foreground transition-colors hover:text-primary"
      >
        {copied ? 'copied ✓' : 'copy'}
      </button>
    </span>
  )
}
