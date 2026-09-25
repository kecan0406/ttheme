import type { Metadata } from 'next'
import Link from 'next/link'
import { CopyCommand } from '@/components/copy-command'
import { loadMarkets } from '@/lib/markets'

export const metadata: Metadata = {
  title: 'ttheme — markets',
  description: 'Palette markets anyone can publish from a GitHub repository',
}

const LINK = 'text-muted-foreground transition-colors hover:text-primary'

export default async function Markets() {
  const markets = await loadMarkets()

  return (
    <main className="mx-auto grid max-w-[980px] gap-8 px-4 py-10 text-sm">
      <header className="grid gap-3">
        <nav className="text-xs">
          <Link href="/" className={LINK}>
            ← ttheme
          </Link>
        </nav>
        <h1 className="text-lg font-bold">markets</h1>
        <p className="max-w-[64ch] text-muted-foreground">
          A market is a GitHub repository of palettes. Add one and its palettes join the catalog as{' '}
          <code className="text-foreground">name@owner</code>. Nobody reviews them: each one is measured against the
          contrast gate and shown, never refused.
        </p>
        <div className="grid max-w-[520px] gap-1.5">
          <CopyCommand command="ttheme market search" />
          <CopyCommand command="ttheme market init" />
        </div>
      </header>

      {markets.length === 0 ? (
        <p className="text-muted-foreground">
          No repository carries the <code className="text-foreground">ttheme-market</code> topic yet — make the first
          one with <code className="text-foreground">ttheme market init</code>.
        </p>
      ) : (
        <ul className="grid gap-3">
          {markets.map((m) => (
            <li key={m.repo} className="grid gap-2.5 rounded-[3px] border bg-card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <a href={`https://github.com/${m.repo}`} className="font-bold transition-colors hover:text-primary">
                  {m.repo}
                </a>
                <span className="text-xs text-muted-foreground">
                  {m.palettes.length} palette{m.palettes.length === 1 ? '' : 's'} · ★{m.stars}
                </span>
              </div>
              {m.about ? <p className="text-muted-foreground">{m.about}</p> : null}
              <div className="flex flex-wrap gap-1.5">
                {m.palettes.map((p) => (
                  <span
                    key={p.name}
                    title={p.name}
                    className="flex h-5 overflow-hidden rounded-[2px] border"
                    style={{ background: p.background }}
                  >
                    {p.signature.map((c) => (
                      <span key={c} className="w-3" style={{ background: c }} />
                    ))}
                  </span>
                ))}
              </div>
              <div className="max-w-[520px]">
                <CopyCommand command={`ttheme market add ${m.add}`} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
