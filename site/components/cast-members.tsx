import { Search } from 'lucide'
import { LinkButton } from '@/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { type FoundCast, type FoundMember, nativeLang } from '@/lib/found'
import { Icon, NewTab } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { requestUrl } from '../../src/core/names.ts'
import { SlotArt } from './work-art'

export const CIRCLE = 'relative grid size-24 place-items-center overflow-hidden rounded-full max-sm:size-19'

export const CAST =
  'flex flex-wrap gap-x-5.5 gap-y-5 max-sm:-mx-5 max-sm:snap-x max-sm:snap-mandatory max-sm:scroll-px-5 max-sm:flex-nowrap max-sm:gap-x-3.5 max-sm:overflow-x-auto max-sm:px-5 max-sm:pt-1.5 max-sm:pb-1.5 max-sm:[scrollbar-width:none]'

const NOTE = 'text-soft-foreground'

export function Member({ member, lang, work }: { member: FoundCast; lang: string | null; work: string }) {
  return (
    <li class="grid w-27 flex-none max-sm:w-21 max-sm:snap-start">
      <a
        href={requestUrl(`${member.name}, ${work}`)}
        target="_blank"
        rel="noopener"
        data-member
        class="group/who grid content-start justify-items-center gap-2 text-center outline-none transition-opacity duration-200 data-dim:opacity-45"
      >
        <span
          class={cn(
            CIRCLE,
            'bg-muted transition-[translate,box-shadow] duration-200 group-focus-visible/who:ring-2 group-focus-visible/who:ring-ring group-focus-visible/who:ring-offset-2 group-focus-visible/who:ring-offset-background motion-safe:group-hover/who:-translate-y-0.5',
          )}
        >
          <SlotArt picture={member.picture} />
        </span>
        <span class="grid w-full min-w-0 justify-items-center gap-px">
          <b class="flex max-w-full min-w-0 items-center gap-1 font-display text-base leading-snug font-extrabold transition-colors group-hover/who:text-primary">
            <span translate="no" class="truncate" safe>
              {member.name}
            </span>
            <NewTab class="size-3 flex-none opacity-0 transition-opacity group-hover/who:opacity-100 group-focus-visible/who:opacity-100" />
          </b>
          {member.native === null ? null : (
            <small
              translate="no"
              lang={nativeLang(member.native, lang) ?? undefined}
              class="max-w-full truncate font-display text-xs font-extrabold text-muted-foreground"
              safe
            >
              {member.native}
            </small>
          )}
        </span>
      </a>
    </li>
  )
}

function Holding({ member, palette }: { member: FoundCast; palette: string }) {
  return (
    <li class="grid w-27 flex-none max-sm:w-21 max-sm:snap-start">
      <button
        type="button"
        data-who={palette}
        aria-pressed="false"
        class="group/who grid content-start justify-items-center gap-2 text-center outline-none transition-opacity duration-200 data-dim:opacity-45"
      >
        <span
          class={cn(
            CIRCLE,
            'bg-muted transition-[translate,box-shadow] duration-200 group-focus-visible/who:ring-2 group-focus-visible/who:ring-ring group-focus-visible/who:ring-offset-2 group-focus-visible/who:ring-offset-background group-aria-pressed/who:ring-2 group-aria-pressed/who:ring-primary group-aria-pressed/who:ring-offset-2 group-aria-pressed/who:ring-offset-background motion-safe:group-hover/who:-translate-y-0.5',
          )}
        >
          <SlotArt picture={member.picture} />
        </span>
        <span class="grid w-full min-w-0 justify-items-center gap-px">
          <b class="flex max-w-full min-w-0 items-center font-display text-base leading-snug font-extrabold transition-colors group-hover/who:text-primary">
            <span translate="no" class="truncate" safe>
              {palette}
            </span>
          </b>
          {member.name === palette ? null : (
            <small
              translate="no"
              class="max-w-full truncate font-display text-xs font-extrabold text-muted-foreground"
              safe
            >
              {member.name}
            </small>
          )}
        </span>
      </button>
    </li>
  )
}

export function CastSearch({ id, work, lang }: { id: string; work: string; lang: string | null }) {
  return (
    <cast-search data-work={id} data-name={work} data-lang={lang ?? ''} class="grid grid-cols-[minmax(0,1fr)] gap-4.5">
      <search class="max-w-[420px]">
        <InputGroup class="h-11">
          <InputGroupAddon>
            <Icon node={Search} />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            name="cast"
            placeholder="find another character"
            aria-label="find another character"
            spellcheck="false"
            autocomplete="off"
            autocapitalize="none"
            autocorrect="off"
            enterkeyhint="search"
          />
        </InputGroup>
      </search>
      <div data-found class="grid grid-cols-[minmax(0,1fr)] gap-3.5" />
    </cast-search>
  )
}

export function CastAsking({ query }: { query: string }) {
  return (
    <p class={NOTE}>
      looking up <span safe>“{query}”</span>…
    </p>
  )
}

export function CastFailed() {
  return <p class={NOTE}>the name lookup did not answer — try again in a moment.</p>
}

export function CastFound({
  cast,
  query,
  work,
  lang,
}: {
  cast: FoundMember[]
  query: string
  work: string
  lang: string | null
}) {
  if (cast.length > 0) {
    return (
      <ul class={CAST}>
        {cast.map((member) =>
          member.palette === null ? (
            <Member member={member} lang={lang} work={work} />
          ) : (
            <Holding member={member} palette={member.palette} />
          ),
        )}
      </ul>
    )
  }

  return (
    <div class="grid justify-items-start gap-3.5">
      <p class={NOTE}>
        no{' '}
        <span translate="no" class="font-semibold text-foreground" safe>
          “{query}”
        </span>{' '}
        among the characters of{' '}
        <span translate="no" class="font-semibold text-foreground" safe>
          {work}
        </span>{' '}
        <span aria-hidden="true">( ˘ω˘ )</span>
      </p>
      <LinkButton variant="outline" size="sm" href={requestUrl(`${query}, ${work}`)} target="_blank" rel="noopener">
        request a palette
        <NewTab />
      </LinkButton>
    </div>
  )
}
