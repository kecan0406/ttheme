import { check } from '../../../../src/core/contrast.ts'
import { modeOf, otherOf } from '../../../../src/core/mode.ts'
import type { Theme } from '../../../../src/core/theme.ts'

interface Shade {
  background: string
  foreground: string
  selection_background: string
  ansi: string[]
}

interface ThemeDoc {
  meta: { name: string; signature: string[] }
  colors: Shade & { light?: Shade; dark?: Shade }
}

const files = Bun.argv.slice(2)
if (files.length === 0) {
  console.error('usage: bun check-theme.ts <theme.toml> [...]')
  process.exit(1)
}

const gated = (doc: ThemeDoc, shade: Shade) =>
  ({
    name: doc.meta.name,
    background: shade.background,
    foreground: shade.foreground,
    selectionBackground: shade.selection_background,
    ansi: shade.ansi,
    signatureSlots: doc.meta.signature,
    waive: [],
  }) as unknown as Theme

let violations = 0
for (const file of files) {
  const doc = Bun.TOML.parse(await Bun.file(file).text()) as unknown as ThemeDoc
  const other = otherOf(modeOf(gated(doc, doc.colors)))
  const theirs = doc.colors[other]
  for (const v of check(gated(doc, doc.colors))) {
    violations++
    console.log(`${v.theme}: ${v.rule} — ${v.detail}`)
  }
  if (theirs === undefined) {
    violations++
    console.log(`${doc.meta.name}: no [colors.${other}] — bun light.ts --write writes it`)
    continue
  }
  for (const v of check(gated(doc, theirs))) {
    violations++
    console.log(`${v.theme} [colors.${other}]: ${v.rule} — ${v.detail}`)
  }
}

console.log(violations === 0 ? 'gate clean' : `${violations} violation(s)`)
process.exit(violations === 0 ? 0 : 1)
