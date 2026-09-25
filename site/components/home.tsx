'use client'

import { ArrowRightIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Theme } from '@/lib/themes'
import { useSettling, wearStyle } from '@/lib/wear'
import { CommandRow } from './command-row'
import { KaomojiRain } from './kaomoji-rain'
import { Signature } from './palette-parts'
import { SiteHeader } from './site-header'
import { Sparkles } from './sparkles'
import { TerminalPreview } from './terminal-preview'

const INIT = 'npx @kecan0406/ttheme init'
const SLOTS = Array.from({ length: 16 }, (_, index) => index)

function features(palettes: number, series: number) {
  return [
    {
      emoji: '🎨',
      title: 'a palette per character',
      text: `${palettes} palettes across ${series} series, each measured from the character's official art, with three signature colors you will recognise.`,
    },
    {
      emoji: '🖥️',
      title: 'every terminal you use',
      text: 'Ghostty, iTerm2, WezTerm, kitty, Alacritty, Windows Terminal and Warp, all wired by one init.',
    },
    {
      emoji: '🗂️',
      title: 'a different one per tab',
      text: 'ttheme use paints just this tab, ttheme next moves on, and ttheme pin keeps a palette for a folder.',
    },
    {
      emoji: '🖼️',
      title: 'a picture behind the text',
      text: "Tint a picture into the palette's background, as faint as its contrast floors allow.",
    },
    {
      emoji: '✅',
      title: 'readable by design',
      text: 'Every official palette clears the contrast gate: nine floors, measured on every build.',
    },
    {
      emoji: '🍀',
      title: 'free and open',
      text: 'MIT licensed, and anyone can publish a market of their own palettes from a GitHub repository.',
    },
  ]
}

function steps(name: string) {
  return [
    {
      title: 'install',
      text: "Sets up the shell layer and your terminal's config, then asks which palettes to bring.",
      command: INIT,
    },
    {
      title: 'browse',
      text: 'Pick more from the catalog in a live picker, series by series.',
      command: 'ttheme browse',
    },
    { title: 'wear', text: 'Paints this tab. Every other tab keeps its own.', command: `ttheme use ${name}` },
  ]
}

export function Home({ themes, series }: { themes: Theme[]; series: number }) {
  const leads = useMemo(() => themes.filter((theme) => theme.lead), [themes])
  const [at, setAt] = useState(0)
  const [held, setHeld] = useState(false)
  const theme = leads[at] as Theme
  const root = useSettling<HTMLDivElement>(theme.name)

  useEffect(() => {
    if (held || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => {
      if (!document.hidden) setAt((index) => (index + 1) % leads.length)
    }, 4000)
    return () => window.clearInterval(timer)
  }, [held, leads.length])

  const pick = (index: number) => {
    setAt((index + leads.length) % leads.length)
    setHeld(true)
  }

  return (
    <div ref={root} className="wear ground min-h-dvh" style={wearStyle(theme)}>
      <div className="mx-auto grid w-[min(1280px,calc(100%-40px))] grid-cols-[minmax(0,1fr)] gap-5 pt-4.5">
        <SiteHeader current="/" themeToggle={false} />

        <section
          aria-label="ttheme"
          className="grid grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] items-center gap-12 pt-14 pb-10 max-[960px]:grid-cols-[minmax(0,1fr)] max-[960px]:pt-8"
        >
          <div className="grid justify-items-start gap-6">
            <Badge variant="sticker">
              {themes.length} palettes · {series} series ✦
            </Badge>
            <h1 className="font-display text-display-xl font-black">
              wear{' '}
              <Sparkles colors={theme.signature} burst={theme.name}>
                <span className="text-primary">{theme.name}</span>
              </Sparkles>
              <br />
              in your terminal
            </h1>
            <p className="max-w-[52ch] text-base text-soft-foreground">
              Character color palettes, measured from official art, for ghostty, iTerm2, WezTerm, kitty, Alacritty,
              Windows Terminal and Warp. One command, then every tab can wear its own.
            </p>
            <div className="flex w-full flex-wrap items-center gap-3">
              <Button variant="pop" size="lg" nativeButton={false} render={<Link href="/market" />}>
                browse the palettes
                <ArrowRightIcon />
              </Button>
              <CommandRow command={INIT} className="min-w-70 flex-1 bg-card" />
            </div>
          </div>

          <div className="grid gap-4">
            <div className="overflow-hidden rounded-3xl border border-input bg-card shadow-lg">
              <div className="flex items-center gap-2 border-b px-4 py-2.5">
                <span aria-hidden="true" className="flex gap-1.5">
                  <i className="size-2.5 rounded-full bg-(--a1)" />
                  <i className="size-2.5 rounded-full bg-(--a3)" />
                  <i className="size-2.5 rounded-full bg-(--a2)" />
                </span>
                <span className="min-w-0 flex-1 truncate text-center font-mono text-xs text-muted-foreground">
                  ttheme · {theme.name} · {theme.group}
                </span>
                <Button variant="ghost" size="icon-sm" aria-label="previous palette" onClick={() => pick(at - 1)}>
                  <ChevronLeftIcon />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label="next palette" onClick={() => pick(at + 1)}>
                  <ChevronRightIcon />
                </Button>
              </div>
              <div key={theme.name} className="motion-safe:animate-squish">
                <TerminalPreview theme={theme} scene="shell" worn className="min-h-60 px-6 pt-5 pb-6 text-sm" />
              </div>
            </div>
            <div aria-hidden="true" className="flex flex-wrap items-center gap-1.5 px-1">
              {SLOTS.map((slot) => (
                <i
                  key={slot}
                  className="block h-2.5 rounded-full motion-safe:animate-dance"
                  style={{
                    background: `var(--a${slot})`,
                    width: slot % 3 === 0 ? 28 : 12,
                    animationDelay: `${slot * -0.6}s`,
                  }}
                />
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="features" className="grid gap-6 py-12">
          <h2 id="features" className="font-display text-display-lg font-black">
            everything a tab needs
          </h2>
          <div className="grid grid-cols-3 gap-4 max-[960px]:grid-cols-2 max-[640px]:grid-cols-1">
            {features(themes.length, series).map((feature) => (
              <article key={feature.title} className="grid content-start gap-2 rounded-3xl border bg-muted p-6">
                <span className="text-3xl" role="img" aria-hidden="true">
                  {feature.emoji}
                </span>
                <h3 className="font-display text-base font-extrabold">{feature.title}</h3>
                <p className="text-sm text-soft-foreground">{feature.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="characters" className="grid gap-6 py-12">
          <div className="grid gap-2">
            <h2 id="characters" className="font-display text-display-lg font-black">
              pick a character
            </h2>
            <p className="text-soft-foreground">The page wears whichever you pick, the way your terminal would.</p>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
            {leads.map((lead, index) => (
              <button
                key={lead.name}
                type="button"
                aria-pressed={lead === theme}
                onClick={() => pick(index)}
                style={{ background: lead.background, color: lead.foreground }}
                className="grid grid-cols-[minmax(0,1fr)] gap-1 rounded-2xl border border-[color-mix(in_oklab,currentColor_14%,transparent)] px-4 pt-3.5 pb-4 text-left transition-transform duration-200 outline-none hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-98 active:duration-500 active:ease-spring aria-pressed:ring-2 aria-pressed:ring-ring aria-pressed:ring-offset-2 aria-pressed:ring-offset-background motion-reduce:hover:translate-y-0"
              >
                <span
                  className="font-display text-display-sm font-black [overflow-wrap:anywhere]"
                  style={{ color: lead.cursor }}
                >
                  {lead.name}
                </span>
                <span className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-xs opacity-70">{lead.group}</span>
                  <Signature theme={lead} />
                </span>
              </button>
            ))}
          </div>
        </section>

        <section aria-labelledby="install" className="grid gap-6 py-12">
          <h2 id="install" className="font-display text-display-lg font-black">
            three commands
          </h2>
          <ol className="grid grid-cols-3 gap-4 max-[960px]:grid-cols-1">
            {steps(theme.name).map((step, index) => (
              <li key={step.title} className="grid content-start gap-3 rounded-3xl border bg-muted p-6">
                <span className="flex items-center gap-3">
                  <span className="grid size-8 place-items-center rounded-full bg-primary font-display text-sm font-black text-primary-foreground">
                    {index + 1}
                  </span>
                  <span className="font-display text-base font-extrabold">{step.title}</span>
                </span>
                <p className="text-sm text-soft-foreground">{step.text}</p>
                <CommandRow command={step.command} className="bg-card" />
              </li>
            ))}
          </ol>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-4 border-t py-8 text-sm text-muted-foreground">
          <span>free and open, MIT</span>
          <nav aria-label="more" className="flex flex-wrap gap-4">
            <Link href="/market" className="hover:text-foreground">
              market
            </Link>
            <Link href="/sheets" className="hover:text-foreground">
              sheets
            </Link>
            <a href="https://github.com/kecan0406/ttheme" className="hover:text-foreground">
              github
            </a>
            <a href="https://www.npmjs.com/package/@kecan0406/ttheme" className="hover:text-foreground">
              npm
            </a>
          </nav>
        </footer>
      </div>
      <KaomojiRain />
    </div>
  )
}
