import { CopyCommand } from '@/components/copy-command'
import { Landing } from '@/components/landing'
import { loadThemes } from '@/lib/themes'

export default function Page() {
  const themes = loadThemes()

  return (
    <main className="pb-16">
      <header className="mx-auto flex max-w-[1160px] items-baseline gap-5 px-6 py-[22px]">
        <span className="text-[15px] font-bold">
          <span className="font-normal text-muted">$ </span>ttheme
        </span>
        <nav className="ml-auto flex gap-[18px] text-[12.5px]">
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
      <Landing themes={themes}>
        <h1 className="mx-auto mt-[52px] max-w-[30ch] text-balance text-[length:clamp(22px,3.2vw,30px)] font-bold leading-[1.3]">
          Character palettes for your terminal
        </h1>
        <p className="mx-auto mt-4 max-w-[58ch] text-[14.5px] leading-[1.75] text-muted">
          {themes.length} hand-tuned, contrast-checked color palettes drawn from anime and game characters. One command
          sets up ghostty, kitty, alacritty, wezterm and iTerm2 — then switch live from your shell.
        </p>
        <div className="mt-[30px]">
          <CopyCommand command="npx @kecan0406/ttheme init" />
        </div>
      </Landing>
      <footer className="mx-auto mt-[90px] flex max-w-[1160px] flex-wrap items-baseline gap-3 border-t border-line px-6 pt-7 text-xs text-muted">
        <span>MIT © kecan0406</span>
        <span className="ml-auto">ttheme apply · next · preview · menu</span>
      </footer>
    </main>
  )
}
