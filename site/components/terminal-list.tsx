import { ArrowRight, Terminal } from 'lucide'
import { siGithub } from 'simple-icons'
import { LinkButton } from '@/components/ui/button'
import { REPO_URL } from '@/lib/gallery'
import { BrandIcon, Icon, NewTab } from '@/lib/icons'

const REQUEST_URL = `${REPO_URL}/issues/new?template=terminal.yml`

const TERMINALS = [
  { id: 'ghostty', name: 'Ghostty', url: 'https://ghostty.org' },
  { id: 'iterm2', name: 'iTerm2', url: 'https://iterm2.com' },
  { id: 'kitty', name: 'kitty', url: 'https://sw.kovidgoyal.net/kitty/' },
  { id: 'wezterm', name: 'WezTerm', url: 'https://wezterm.org' },
  { id: 'alacritty', name: 'Alacritty', url: 'https://alacritty.org' },
  { id: 'warp', name: 'Warp', url: 'https://www.warp.dev' },
  { id: 'terminal-app', name: 'Terminal.app', url: 'https://support.apple.com/guide/terminal/welcome/mac' },
  { id: 'windows-terminal', name: 'Windows Terminal', url: 'https://learn.microsoft.com/windows/terminal/' },
  { id: 'konsole', name: 'Konsole', url: 'https://apps.kde.org/konsole/' },
  { id: 'rio', name: 'Rio', url: 'https://rioterm.com' },
  { id: 'contour', name: 'Contour', url: 'https://contour-terminal.org' },
] as const

function TerminalIcon({ src }: { src: string | undefined }) {
  return src ? (
    <img
      src={src}
      alt=""
      width="64"
      height="64"
      loading="lazy"
      decoding="async"
      class="size-16 object-contain drop-shadow-md"
    />
  ) : (
    <span aria-hidden="true" class="grid size-16 place-items-center">
      <span class="grid size-13 place-items-center rounded-xl bg-muted shadow-sm ring-1 ring-border">
        <Icon node={Terminal} class="size-7 text-soft-foreground" />
      </span>
    </span>
  )
}

export function TerminalList({ icons }: { icons: Record<string, string> }) {
  return (
    <section aria-labelledby="terminals" class="grid gap-6 py-12">
      <div class="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div class="grid gap-2">
          <h2 id="terminals" class="font-display text-display-lg font-black">
            works where you already type
          </h2>
          <p class="text-soft-foreground">
            One <code class="font-mono">init</code> wires every terminal you pick, and each tab repaints only itself.
          </p>
        </div>
        <a
          href="/docs/reference/terminals"
          class="inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline"
        >
          what each one can do
          <Icon node={ArrowRight} class="size-3.5" />
        </a>
      </div>
      <ul class="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2">
        {TERMINALS.map((terminal) => {
          const words = terminal.name.split(' ')
          const last = words.pop() ?? ''

          return (
            <li class="flex">
              <a
                href={terminal.url}
                target="_blank"
                rel="noopener"
                translate="no"
                class="group/terminal flex min-w-0 flex-1 flex-col items-center gap-3 rounded-3xl border border-transparent px-1 pt-4.5 pb-3.5 text-center outline-none transition-[translate,background-color,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-input hover:bg-muted hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring motion-reduce:hover:translate-y-0"
              >
                <TerminalIcon src={terminal.id === 'terminal-app' ? undefined : icons[terminal.id]} />
                <span class="text-sm font-medium text-foreground">
                  {words.length > 0 ? <span safe>{`${words.join(' ')} `}</span> : null}
                  <span class="whitespace-nowrap">
                    <span safe>{last}</span>
                    <NewTab class="ml-0.75 inline-block size-3 align-middle text-muted-foreground group-hover/terminal:text-primary" />
                  </span>
                </span>
              </a>
            </li>
          )
        })}
      </ul>
      <div class="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-3xl border border-dashed border-input px-6 py-5">
        <div class="grid gap-1">
          <p class="font-display text-base font-extrabold">Missing your terminal?</p>
          <p class="text-sm text-soft-foreground">Tell us which one you'd like ttheme to support.</p>
        </div>
        <LinkButton variant="outline" href={REQUEST_URL} target="_blank" rel="noopener">
          <BrandIcon icon={siGithub} class="size-4" />
          <span>
            request a{' '}
            <span class="whitespace-nowrap">
              terminal
              <NewTab class="ml-1 inline-block size-3.5 align-middle" />
            </span>
          </span>
        </LinkButton>
      </div>
    </section>
  )
}
