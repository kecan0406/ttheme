import { readFileSync } from 'node:fs'
import { parse } from 'smol-toml'
import { namesDir, namesOf } from '../../../../src/names.ts'

const arg = process.argv[2]
if (!arg) {
  console.error('usage: bun natives.ts themes/<name>.toml | <danbooru tag>')
  process.exit(1)
}

const toml = arg.endsWith('.toml')
  ? (parse(readFileSync(arg, 'utf8')) as { meta?: Record<string, unknown> })
  : undefined
const tag = toml ? String(toml.meta?.booru ?? '') : arg
const kept = (toml?.meta?.native_names as string[] | undefined) ?? []
const known = namesOf(tag)
if (!known) {
  console.error(`no names for ${tag || arg} in ${namesDir()}: \`bun src/bin.ts names\` downloads them`)
  process.exit(1)
}

const hangul = /\p{Script=Hangul}/u
const japanese = known.japanese
const korean = known.names.filter((name) => hangul.test(name))
const other = known.names.filter((name) => !japanese.includes(name) && !korean.includes(name))
console.log(`${tag}${known.tag === tag ? '' : ` (danbooru calls it ${known.tag})`}`)
console.log(`  japanese  ${japanese.join(' · ') || '—'}`)
console.log(`  korean    ${korean.join(' · ') || '—'}`)
console.log(`  other     ${other.join(' · ') || '—'}`)
if (toml) console.log(`  kept      ${kept.join(' · ') || '—'}`)
