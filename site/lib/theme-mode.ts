export const THEME_KEY = 'ttheme-site-theme'

export const THEME_SCRIPT = `try{var m=localStorage.getItem('${THEME_KEY}');document.documentElement.classList.toggle('dark',m==='dark'||(m!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches))}catch(e){document.documentElement.classList.add('dark')}`

export type ThemeMode = 'system' | 'light' | 'dark'
