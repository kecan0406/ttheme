import type { PropsWithChildren } from '@kitajs/html'

export function HeadingAnchor({ id, children }: PropsWithChildren<{ id: string }>) {
  return (
    <a href={`#${id}`} data-anchor>
      <span data-heading>{children}</span>
      <span data-hash aria-hidden="true">
        #
      </span>
    </a>
  )
}
