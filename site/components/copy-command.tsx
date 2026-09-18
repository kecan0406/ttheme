'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

function CopyButton({ command }: { command: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(command)
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }

  return (
    <Button variant="line" size="xs" onClick={copy} className="flex-none rounded-[2px] px-[9px] text-xs">
      {copied ? 'copied' : 'copy'}
    </Button>
  )
}

export function CopyCommand({ command }: { command: string }) {
  return (
    <div className="flex items-center justify-between gap-1.5 rounded-[3px] border bg-background py-1 pr-1 pl-2 text-foreground">
      <code className="min-w-0 text-[11px] [overflow-wrap:anywhere]">
        <span className="mr-[.6ch] text-muted-foreground/70 select-none">$</span>
        {command}
      </code>
      <CopyButton command={command} />
    </div>
  )
}
