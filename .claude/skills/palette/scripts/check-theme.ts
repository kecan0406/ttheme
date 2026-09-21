import { check } from '../../../../src/contrast.ts'
import type { Theme } from '../../../../src/theme.ts'

interface ThemeDoc {
  meta: { name: string }
  colors: { background: string; foreground: string; ansi: string[] }
}

const files = Bun.argv.slice(2)
if (files.length === 0) {
  console.error('usage: bun check-theme.ts <theme.toml> [...]')
  process.exit(1)
}

let violations = 0
for (const file of files) {
  const doc = Bun.TOML.parse(await Bun.file(file).text()) as unknown as ThemeDoc
  const theme = {
    name: doc.meta.name,
    background: doc.colors.background,
    foreground: doc.colors.foreground,
    ansi: doc.colors.ansi,
    waive: [],
  } as unknown as Theme
  for (const v of check(theme)) {
    violations++
    console.log(`${v.theme}: ${v.rule} — ${v.detail}`)
  }
}

console.log(violations === 0 ? 'gate clean' : `${violations} violation(s)`)
process.exit(violations === 0 ? 0 : 1)
