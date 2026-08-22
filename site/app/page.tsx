import { Landing } from '@/components/landing'
import { loadThemes } from '@/lib/themes'

export default function Page() {
  const themes = loadThemes()

  return (
    <main className="grid h-dvh grid-rows-[44px_minmax(0,1fr)] overflow-hidden">
      <header className="flex min-w-0 items-baseline gap-[18px] border-b border-line px-[18px] leading-[43px] whitespace-nowrap">
        <span className="text-sm font-bold">
          <span className="font-normal text-muted">$ </span>ttheme
        </span>
        <h1 className="min-w-0 truncate text-[12.5px] font-normal text-muted max-sm:hidden">
          character palettes for your terminal
        </h1>
        <nav className="ml-auto flex gap-4 text-[12.5px]">
          <span className="text-muted/70 max-md:hidden">MIT © kecan0406</span>
          <a href="https://github.com/kecan0406/ttheme" className="text-muted transition-colors hover:text-accent">
            github
          </a>
          <a
            href="https://www.npmjs.com/package/@kecan0406/ttheme"
            className="text-muted transition-colors hover:text-accent"
          >
            npm
          </a>
        </nav>
      </header>
      <Landing themes={themes} />
    </main>
  )
}
