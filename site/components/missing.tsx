import { SiteHeader } from './site-header'

export function Missing({ title, text }: { title: string; text: string }) {
  return (
    <div class="ground min-h-dvh">
      <div class="mx-auto grid w-[min(1280px,calc(100%-40px))] grid-cols-[minmax(0,1fr)] gap-5 pt-4.5">
        <SiteHeader current="" />
        <div class="grid justify-items-start gap-3 pt-5">
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
      </div>
    </div>
  )
}
