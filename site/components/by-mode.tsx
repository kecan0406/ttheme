import { inMode, type Theme } from '@/lib/themes'

export function ByMode({ theme, render }: { theme: Theme; render: (shown: Theme) => JSX.Element }) {
  return (
    <>
      <div data-view="dark" class="contents">
        {render(inMode(theme, 'dark'))}
      </div>
      <div data-view="light" class="contents">
        {render(inMode(theme, 'light'))}
      </div>
    </>
  )
}
