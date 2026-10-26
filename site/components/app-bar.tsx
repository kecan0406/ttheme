import type { PropsWithChildren } from '@kitajs/html'
import { type SimpleIcon, siGithub, siNpm } from 'simple-icons'
import type { Facts } from '@/lib/facts'
import { NPM_URL, OFFICIAL_URL } from '@/lib/gallery'
import { BrandIcon, NewTab } from '@/lib/icons'

const LINKS: { label: string; href: string; brand?: SimpleIcon }[] = [
  { label: 'github', href: OFFICIAL_URL, brand: siGithub },
  { label: 'npm', href: NPM_URL, brand: siNpm },
  { label: 'report a bug', href: `${OFFICIAL_URL}/issues/new/choose` },
]

export function AppBar({ facts, children }: PropsWithChildren<{ facts: Facts }>) {
  return (
    <footer class="flex flex-none flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-border bg-glass px-5 py-1.5 text-xs text-muted-foreground backdrop-blur-[14px] backdrop-saturate-130 app:h-7 app:py-0">
      {children}
      <nav aria-label="project" class="flex flex-wrap items-center gap-x-3.5 gap-y-1">
        <span>MIT</span>
        <span class="font-mono" safe>
          {`v${facts.version}`}
        </span>
        {LINKS.map((link) => (
          <a
            href={link.href}
            target="_blank"
            rel="noopener"
            class="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            {link.brand ? <BrandIcon icon={link.brand} class="size-3 flex-none" /> : null}
            <span safe>{link.label}</span>
            <NewTab class="size-3 flex-none" />
          </a>
        ))}
      </nav>
    </footer>
  )
}
