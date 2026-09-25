import Link from 'next/link'
import { ThemeToggle } from './theme-toggle'

const NAV = [
  { href: '/sheets', label: 'sheets' },
  { href: '/market', label: 'market' },
]

export function SiteHeader({ current, themeToggle = true }: { current: string; themeToggle?: boolean }) {
  return (
    <header className="sticky top-4.5 z-10 flex items-center justify-between gap-6 rounded-xl border bg-glass px-4.5 py-3.5 shadow-sm backdrop-blur-[14px] backdrop-saturate-130 max-[560px]:flex-wrap max-[560px]:gap-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <Link
          href="/"
          className="font-display text-display-md font-black outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          ttheme
        </Link>
        <span className="text-xs font-medium tracking-wide text-muted-foreground">wear your favorite character</span>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <nav aria-label="site" className="flex gap-0.5">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={item.href === current ? 'page' : undefined}
              className="rounded-full px-3 py-1 text-sm font-medium text-soft-foreground transition-colors hover:bg-muted hover:text-foreground aria-[current=page]:bg-card aria-[current=page]:text-foreground aria-[current=page]:shadow-sm aria-[current=page]:ring-1 aria-[current=page]:ring-border"
            >
              {item.label}
            </Link>
          ))}
          <a
            href="https://github.com/kecan0406/ttheme"
            className="rounded-full px-3 py-1 text-sm font-medium text-soft-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            github
          </a>
        </nav>
        {themeToggle ? <ThemeToggle /> : null}
      </div>
    </header>
  )
}
