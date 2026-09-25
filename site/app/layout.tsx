import type { Metadata } from 'next'
import { BIZ_UDGothic, Inter, Nunito } from 'next/font/google'
import localFont from 'next/font/local'
import Script from 'next/script'
import type { ReactNode } from 'react'
import { THEME_KEY } from '@/lib/theme-mode'
import './globals.css'

const jetbrains = localFont({
  src: [
    { path: './fonts/JetBrainsMono-Regular.woff2', weight: '400' },
    { path: './fonts/JetBrainsMono-Bold.woff2', weight: '700' },
  ],
  variable: '--font-jetbrains',
  display: 'swap',
})

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })

const nunito = Nunito({ weight: ['800', '900'], subsets: ['latin'], variable: '--font-nunito', display: 'swap' })

const bizud = BIZ_UDGothic({ weight: ['400', '700'], subsets: ['latin'], variable: '--font-bizud', display: 'swap' })

const THEME_SCRIPT = `try{var m=localStorage.getItem('${THEME_KEY}');document.documentElement.classList.toggle('dark',m==='dark'||(m!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches))}catch(e){document.documentElement.classList.add('dark')}`

export const metadata: Metadata = {
  title: 'ttheme — character terminal palettes',
  description: 'Character terminal palettes for ghostty, kitty, alacritty, wezterm and iTerm2',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${nunito.variable} ${bizud.variable} ${jetbrains.variable}`}
    >
      <body>
        <Script id="theme-mode" strategy="beforeInteractive">
          {THEME_SCRIPT}
        </Script>
        {children}
      </body>
    </html>
  )
}
