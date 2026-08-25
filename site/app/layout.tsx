import type { Metadata } from 'next'
import localFont from 'next/font/local'
import type { ReactNode } from 'react'
import './globals.css'

const jetbrains = localFont({
  src: [
    { path: './fonts/JetBrainsMono-Regular.woff2', weight: '400' },
    { path: './fonts/JetBrainsMono-Bold.woff2', weight: '700' },
  ],
  variable: '--font-jetbrains',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'ttheme — character terminal palettes',
  description: 'Character terminal palettes for ghostty, kitty, alacritty, wezterm and iTerm2',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`dark ${jetbrains.variable}`}>
      <body className="font-mono antialiased">{children}</body>
    </html>
  )
}
