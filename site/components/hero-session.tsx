import type { ReactNode } from 'react'
import type { Theme } from '@/lib/themes'
import { CopyCommand } from './copy-command'

const LS_ROWS = [
  ['bin', 'CLAUDE.md', 'LICENSE', 'package.json', 'site', 'tsconfig.json'],
  ['biome.json', 'dist', 'mise.toml', 'README.md', 'src'],
  ['bun.lock', 'ghostty', 'node_modules', 'shell', 'themes'],
]
const LS_DIRS = new Set(['bin', 'dist', 'ghostty', 'node_modules', 'shell', 'site', 'src', 'themes'])
const LS_COLUMN = 14
const TERMINALS = 'ghostty · kitty · alacritty · wezterm · iTerm2'
const ansiSlots = Array.from({ length: 16 }, (_, index) => `a${index}`)

function Prompt({ theme }: { theme: Theme }) {
  return (
    <>
      <span style={{ color: theme.ansi[2] }}>{'➜  '}</span>
      <span style={{ color: theme.ansi[6] }}>ttheme</span>
      <span style={{ color: theme.ansi[4] }}>{' git:('}</span>
      <span style={{ color: theme.ansi[1] }}>main</span>
      <span style={{ color: theme.ansi[4] }}>{') '}</span>
    </>
  )
}

function Swatch({ color }: { color: string }) {
  return <i className="hero-sw" style={{ background: color }} />
}

function Muted({ theme, children }: { theme: Theme; children: ReactNode }) {
  return <span style={{ color: theme.ansi[8] }}>{children}</span>
}

function Command({ theme, children }: { theme: Theme; children: ReactNode }) {
  return <span style={{ color: theme.ansi[6] }}>{children}</span>
}

export function HeroSession({
  theme,
  position,
  count,
  series,
}: {
  theme: Theme
  position: string
  count: number
  series: number
}) {
  return (
    <section className="@container grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_44px] px-3.5 pt-3.5">
      <div className="hero-pane" style={{ background: theme.background, color: theme.foreground }}>
        <div className="hero-scroll">
          <div>
            <div>
              <Prompt theme={theme} />
              ttheme help
            </div>
            <div>ttheme — character terminal palettes</div>
            <div>
              <Muted theme={theme}>{TERMINALS}</Muted>
            </div>
            <div>
              {'  '}
              <Command theme={theme}>{'ttheme        '}</Command>list every palette, grouped, with previews{' '}
              <Muted theme={theme}>
                ({count} · {series} series)
              </Muted>
            </div>
            <div>
              {'  '}
              <Command theme={theme}>{`ttheme ${theme.name.padEnd(7)}`}</Command> paint this tab{' '}
              <Muted theme={theme}>(a unique prefix works: ttheme {theme.name.slice(0, 2)})</Muted>
            </div>
            <div>
              {'  '}
              <Command theme={theme}>ttheme preview</Command> browse live — focus repaints, enter keeps, esc restores
            </div>
            <div>
              {'  '}
              <Command theme={theme}>{'ttheme next   '}</Command> advance this tab to the next palette
            </div>
          </div>

          <div>
            <div>
              <Prompt theme={theme} />
              ttheme {theme.name}
            </div>
            <div>
              <span style={{ background: theme.selectionBackground }}>{` ${theme.group} `}</span>
              {theme.native ? <Muted theme={theme}>{`  ${theme.native}`}</Muted> : null}
            </div>
            <div>
              <span style={{ background: theme.cursor, color: theme.background, fontWeight: 700 }}>
                {` ${theme.name} `}
              </span>
              <Muted theme={theme}>{` · ANSI ${theme.ansiSource}`}</Muted>
            </div>
          </div>

          <div>
            <div>
              <Prompt theme={theme} />
              ttheme preview
            </div>
            <div>
              <Muted theme={theme}>{'ansi       '}</Muted>
              {theme.ansi.slice(0, 8).map((color, index) => (
                <Swatch key={ansiSlots[index]} color={color} />
              ))}
            </div>
            <div>
              <Muted theme={theme}>{'           '}</Muted>
              {theme.ansi.slice(8).map((color, index) => (
                <Swatch key={ansiSlots[index + 8]} color={color} />
              ))}
            </div>
            <div>
              <Muted theme={theme}>bg </Muted>
              <Swatch color={theme.background} />
              <Muted theme={theme}>fg </Muted>
              <Swatch color={theme.foreground} />
              <Muted theme={theme}>cursor </Muted>
              <Swatch color={theme.cursor} />
              <Muted theme={theme}>selection </Muted>
              <Swatch color={theme.selectionBackground} />
            </div>
          </div>

          <div className="max-sm:hidden">
            <div>
              <Prompt theme={theme} />
              ls
            </div>
            {LS_ROWS.map((row) => (
              <div key={row[0]}>
                {row.map((entry) => (
                  <span key={entry} style={LS_DIRS.has(entry) ? { color: theme.ansi[12], fontWeight: 700 } : undefined}>
                    {entry.padEnd(LS_COLUMN)}
                  </span>
                ))}
              </div>
            ))}
          </div>

          <div>
            <div>
              <Prompt theme={theme} />
              git status -sb
            </div>
            <div>
              <Muted theme={theme}>{'## '}</Muted>
              <span style={{ color: theme.ansi[2] }}>main</span>
              <Muted theme={theme}>...</Muted>
              <span style={{ color: theme.ansi[1] }}>origin/main</span>
              <span style={{ color: theme.ansi[3] }}>{' [ahead 1]'}</span>
            </div>
            <div>
              <span style={{ color: theme.ansi[2] }}>{'M  '}</span>
              themes/{theme.name}.toml
            </div>
            <div>
              <span style={{ color: theme.ansi[1] }}>{' M '}</span>
              themes/_groups.toml
            </div>
          </div>

          <div>
            <Prompt theme={theme} />
            <span className="hero-caret" style={{ background: theme.cursor }} />
          </div>
        </div>
      </div>
      <footer className="flex min-w-0 items-center gap-3.5 text-xs whitespace-nowrap text-muted">
        <b className="text-[13px] text-ink">{theme.name}</b>
        <span>{theme.group}</span>
        <span className="tabular-nums">{position}</span>
        <span className="ml-auto truncate max-md:hidden">
          <kbd>←</kbd> <kbd>→</kbd> browse · <kbd>\</kbd> sidebar · <kbd>/</kbd> find
        </span>
        <CopyCommand command="npx @kecan0406/ttheme init" />
      </footer>
    </section>
  )
}
