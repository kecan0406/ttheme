import type { PropsWithChildren } from '@kitajs/html'
import { Mail, Paintbrush, Plus, X } from 'lucide'
import { type SimpleIcon, siGithub, siX } from 'simple-icons'
import { Button, LinkButton } from '@/components/ui/button'
import { Dialog, DialogClose, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { marketplacePath, REPO, REPO_URL } from '@/lib/gallery'
import { BrandIcon, Icon, NewTab } from '@/lib/icons'
import { BUILTIN, paint, type Theme } from '@/lib/themes'

const ART_CALL = 'art-call'

const ART_FORM = `${REPO_URL}/issues/new?template=art.yml`

const ART_MAIL = 'hello@ttheme.dev'

const ART_X = 'kecan0406dev'

const ASK = 'Are you an illustrator?'

export function ArtCallTab() {
  return (
    <DialogTrigger
      dialog={ART_CALL}
      render={(props) => (
        <button
          {...props}
          class="flex h-8 flex-none items-center gap-1.5 rounded-lg border border-dashed border-(--fg)/30 px-2.5 text-2xs font-medium text-(--fg)/70 outline-none hover:border-(--fg)/55 hover:text-(--fg) focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Icon node={Paintbrush} class="size-3.5" />
          {ASK}
        </button>
      )}
    />
  )
}

export function ArtCallPill() {
  return (
    <DialogTrigger
      dialog={ART_CALL}
      render={(props) => (
        <button
          {...props}
          class="flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-dashed border-(--fg)/30 px-3.5 text-xs font-medium text-(--fg)/80 outline-none hover:border-(--fg)/55 hover:text-(--fg) focus-visible:ring-2 focus-visible:ring-(--cu)"
        >
          <Icon node={Paintbrush} class="size-3.5" />
          {ASK}
        </button>
      )}
    />
  )
}

function Point({ children }: PropsWithChildren) {
  return (
    <li class="grid grid-cols-[0.375rem_minmax(0,1fr)] items-baseline gap-x-3 border-t border-border py-2.5 last:border-b">
      <i aria-hidden="true" class="size-1.5 -translate-y-px rounded-full bg-primary" />
      <span>{children}</span>
    </li>
  )
}

function Way({ icon, name, address, action }: { icon: JSX.Element; name: string; address: string; action: JSX.Element }) {
  return (
    <li class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-border py-2.5 last:border-b">
      <div class="grid min-w-0 grid-cols-[5.25rem_minmax(0,1fr)] items-center gap-3 max-[640px]:grid-cols-[minmax(0,1fr)] max-[640px]:gap-0.5">
        <span class="flex items-center gap-2.5 font-semibold">
          {icon}
          <span safe>{name}</span>
        </span>
        <Address text={address} />
      </div>
      {action}
    </li>
  )
}

function Address({ text }: { text: string }) {
  return (
    <span translate="no" class="truncate font-mono text-xs text-foreground" safe>
      {text}
    </span>
  )
}

function Brand({ icon }: { icon: SimpleIcon }) {
  return <BrandIcon icon={icon} class="size-4 flex-none" />
}

export function ArtCallDialog({ lead, sticker }: { lead: Theme; sticker: string }) {
  return (
    <Dialog id={ART_CALL} aria-labelledby="art-call-title" data-dock class="w-[min(540px,calc(100%-24px))]">
      <div class="flex max-h-[inherit] flex-col">
        <div class="flex h-12 flex-none items-center border-b border-border pl-6 max-[640px]:pl-5">
          <p class="min-w-0 flex-1 truncate text-sm font-bold">Illustrators welcome</p>
          <DialogClose
            render={(props) => (
              <Button {...props} variant="ghost" size="icon" class="mr-1.5">
                <Icon node={X} />
                <span class="sr-only">Close</span>
              </Button>
            )}
          />
        </div>
        <div class="min-h-0 overflow-y-auto overscroll-contain">
          <div
            data-art-banner
            aria-hidden="true"
            style={`--art-field:${paint(lead, (shade) => shade.cursor)};--art-ink:${paint(lead, (shade) => shade.background)}`}
          >
            <img src={sticker} alt="" width="1410" height="756" loading="lazy" decoding="async" />
            <span data-art-slot>
              <Icon node={Plus} />
            </span>
          </div>
          <div class="grid gap-6 px-7 pt-6 pb-7 text-sm max-[640px]:px-4">
            <div class="grid gap-2 text-center">
              <DialogTitle id="art-call-title" class="text-display-sm text-balance">
                Are you an illustrator?
                <br />
                We're looking for character art for the top of this page ✦
              </DialogTitle>
              <p class="text-pretty text-soft-foreground">We'd love to feature your cool or cute art here!</p>
            </div>
            <ul class="grid text-soft-foreground">
              <Point>
                Any character with a ttheme palette is welcome.{' '}
                <a
                  href={marketplacePath(BUILTIN)}
                  class="font-semibold text-foreground underline decoration-foreground/40 underline-offset-4 outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Browse Palettes
                </a>
              </Point>
              <Point>Your drawing stays yours, with your name and a link to your post right beside it.</Point>
              <Point>If you ever want it taken down, just tell us.</Point>
            </ul>
            <div class="grid gap-2.5">
              <h3 class="font-bold">Say hello, whichever way suits you</h3>
              <ul class="grid">
                <Way
                  icon={<Brand icon={siGithub} />}
                  name="GitHub"
                  address={REPO}
                  action={
                    <LinkButton variant="outline" size="sm" href={ART_FORM} target="_blank" rel="noopener">
                      Open the Form
                      <NewTab />
                    </LinkButton>
                  }
                />
                <Way
                  icon={<Icon node={Mail} class="size-4 flex-none" />}
                  name="Email"
                  address={ART_MAIL}
                  action={
                    <LinkButton variant="outline" size="sm" href={`mailto:${ART_MAIL}`}>
                      Write an Email
                    </LinkButton>
                  }
                />
                <Way
                  icon={<Brand icon={siX} />}
                  name="X"
                  address={`@${ART_X}`}
                  action={
                    <LinkButton variant="outline" size="sm" href={`https://x.com/${ART_X}`} target="_blank" rel="noopener">
                      Send a DM
                      <NewTab />
                    </LinkButton>
                  }
                />
              </ul>
            </div>
            <p class="text-center text-xs text-muted-foreground">Thank you for drawing the characters we love.</p>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
