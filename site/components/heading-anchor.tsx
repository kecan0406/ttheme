import type { PropsWithChildren } from '@kitajs/html'

export function HeadingAnchor({ id, children }: PropsWithChildren<{ id: string }>) {
  return (
    <a href={`#${id}`} data-anchor>
      {children}
      <span data-hash aria-hidden="true">
        #
      </span>
    </a>
  )
}
