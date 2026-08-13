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
    <span className="inline-flex items-stretch overflow-hidden rounded-lg border border-line bg-card">
      <code className="px-[18px] py-[13px] text-[13.5px]">
        <span className="select-none text-muted">$ </span>
        {command}
      </code>
      <button
        type="button"
        onClick={copy}
        className="cursor-pointer border-l border-line px-4 text-[12.5px] text-muted transition-colors hover:text-accent"
      >
        {copied ? 'copied ✓' : 'copy'}
      </button>
    </span>
  )
}
