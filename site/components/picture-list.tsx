import type { Picture, PictureLink } from '@/lib/share-view'

const LINK = 'font-mono text-code text-primary underline-offset-4 hover:underline'

function Dot() {
  return <span class="text-muted-foreground">·</span>
}

function Out({ link }: { link: PictureLink }) {
  return (
    <a href={link.url} class={LINK} safe>
      {link.label}
    </a>
  )
}

function Credit({ picture }: { picture: Picture }) {
  const credit = picture.credit
  const names = credit?.artists.map((artist) => artist.name).join(', ') ?? ''
  return (
    <span class="flex flex-wrap items-baseline gap-x-1.5">
      {names ? (
        <>
          <span class="text-soft-foreground" safe>
            {`by ${names}`}
          </span>
          <Dot />
        </>
      ) : null}
      {credit?.page ? (
        <>
          <Out link={credit.page} />
          <Dot />
        </>
      ) : null}
      {picture.href ? (
        <a href={picture.href} class={LINK} safe>
          {picture.post}
        </a>
      ) : (
        <span class="font-mono text-code" safe>
          {picture.post}
        </span>
      )}
    </span>
  )
}

function Profiles({ picture }: { picture: Picture }) {
  const artists = (picture.credit?.artists ?? []).filter((artist) => artist.links.length > 0)
  if (artists.length === 0) {
    return null
  }
  return (
    <span class="flex flex-wrap items-baseline gap-x-1.5 text-xs">
      {artists.map((artist, at) => (
        <>
          {at > 0 ? <Dot /> : null}
          {artists.length > 1 ? (
            <span class="text-muted-foreground" safe>
              {artist.name}
            </span>
          ) : null}
          {artist.links.map((link) => (
            <Out link={link} />
          ))}
        </>
      ))}
    </span>
  )
}

export function PictureRows({ pictures }: { pictures: Picture[] }) {
  return (
    <>
      {pictures.map((picture) => (
        <li class="grid gap-0.5">
          <div class="flex flex-wrap items-baseline justify-between gap-x-3">
            <Credit picture={picture} />
            {picture.framing ? (
              <span class="text-xs text-muted-foreground" safe>
                {picture.framing}
              </span>
            ) : null}
          </div>
          <Profiles picture={picture} />
        </li>
      ))}
    </>
  )
}

export function PictureList({ pictures }: { pictures: Picture[] }) {
  return (
    <ul data-pictures class="grid gap-1.5 text-sm">
      <PictureRows pictures={pictures} />
    </ul>
  )
}
