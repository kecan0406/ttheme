'use client'

import { CheckIcon, CopyIcon, TerminalIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function CommandRow({ command, className }: { command: string; className?: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(command)
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }

  return (
    <div
      data-slot="command-row"
      className={cn('flex min-w-0 items-center gap-2.5 rounded-lg border bg-muted/65 py-1.5 pr-1.5 pl-3', className)}
    >
      <TerminalIcon aria-hidden="true" className="size-4 flex-none text-muted-foreground" />
      <code className="min-w-0 flex-1 overflow-x-auto font-mono text-code leading-snug whitespace-nowrap">
        {command}
      </code>
      {copied ? (
        <span role="status" className="flex-none text-xs text-muted-foreground motion-safe:animate-enter">
          copied (・ω・)
        </span>
      ) : null}
      <Button variant="outline" size="icon-sm" aria-label={copied ? 'copied' : `copy ${command}`} onClick={copy}>
        {copied ? <CheckIcon /> : <CopyIcon />}
      </Button>
    </div>
  )
}
