import type { Metadata } from 'next'
import { Home } from '@/components/home'
import { seriesOf } from '@/lib/sheet'
import { loadManifest } from '@/lib/themes'

export const metadata: Metadata = {
  title: 'ttheme — wear your favorite character',
  description: 'Character color palettes for ghostty, iTerm2, WezTerm, kitty, Alacritty, Windows Terminal and Warp',
}

export default function Page() {
  const { themes } = loadManifest()

  return <Home themes={themes} series={seriesOf(themes).length} />
}
