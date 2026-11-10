import { parseArgs } from 'node:util'
import { liveSource, nameIndex } from '../../src/store/names.ts'

const { positionals } = parseArgs({ args: Bun.argv.slice(2), allowPositionals: true })
const [slug, limit = '40'] = positionals

if (!slug) {
  console.error('usage: bun cast.ts <work-slug> [limit]')
  process.exit(1)
}

const signal = AbortSignal.timeout(90_000)
const index = nameIndex(liveSource())

await index.open(signal)

for (const work of await index.tagged(slug, signal)) {
  console.log(`${work.id}  ${work.label}  ${work.medium ?? ''} ${work.year ?? ''}  ${work.tags.join(' ')}`)
}

for (const member of await index.cast(slug, signal, Number(limit))) {
  console.log(`${member.lead ? '*' : ' '} ${member.id}  ${member.label}  ${member.tags.join(' ')}`)
}
