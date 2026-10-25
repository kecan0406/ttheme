import { siGithub } from 'simple-icons'
import { BrandIcon, NewTab } from '@/lib/icons'
import { cn } from '@/lib/utils'

export function RepoLink({ href, repo, class: className }: { href: string; repo: string; class?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      class={cn('inline-flex min-w-0 items-center gap-1.5 transition-colors hover:text-foreground', className)}
    >
      <BrandIcon icon={siGithub} class="size-3 flex-none" />
      <span class="truncate" safe>
        {repo}
      </span>
      <NewTab class="size-3 flex-none" />
    </a>
  )
}
