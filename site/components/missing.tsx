import type { Facts } from '@/lib/facts'
import { SiteFooter } from './site-footer'
import { SiteHeader } from './site-header'

export function Missing({ title, text, facts }: { title: string; text: string; facts: Facts }) {
  return (
    <div class="ground flex min-h-dvh flex-col">
      <SiteHeader current="" facts={facts} />
      <main id="content" class="mx-auto grid w-[min(1280px,calc(100%-40px))] grid-cols-[minmax(0,1fr)] gap-5 pt-5">
        <div class="grid justify-items-start gap-3 pt-8 pb-16">
          <h1 class="font-display text-display-lg font-black" safe>
            {title}
          </h1>
          <p class="max-w-[68ch] text-soft-foreground" safe>
            {text}
          </p>
          <a href="/" class="text-sm font-medium text-primary underline-offset-4 hover:underline">
            back home
          </a>
        </div>
      </main>
      <SiteFooter facts={facts} />
    </div>
  )
}
