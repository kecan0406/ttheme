import type { Metadata } from 'next'
import { Sheets } from '@/components/sheets'
import { loadManifest } from '@/lib/themes'

export const metadata: Metadata = {
  title: 'ttheme — sheets',
  description: 'Browse every ttheme palette in a terminal, with its slots and contrast readings',
}

export default function SheetsPage() {
  const { gate, themes } = loadManifest()

  return <Sheets themes={themes} gate={gate} />
}
