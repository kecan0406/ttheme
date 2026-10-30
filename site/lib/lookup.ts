import { answerOf } from '@/lib/answer'
import { commons, themes } from '@/lib/builtin'
import { listedWorks, marketplaces } from '@/lib/marketplaces'
import type { NamesAnswer } from '@/lib/names'
import { mergeWorks, workOfListed } from '../../src/core/commons.ts'
import { liveSource, nameIndex } from '../../src/store/names.ts'

const index = nameIndex(liveSource())

const works = mergeWorks(commons.works, listedWorks.map(workOfListed))

const shelved = new Set(
  [...themes, ...marketplaces.flatMap((marketplace) => marketplace.palettes)].flatMap((theme) =>
    [theme.work, ...theme.also].flatMap((work) => (work ? [work.id] : [])),
  ),
)

export async function lookUp(query: string, signal: AbortSignal): Promise<NamesAnswer> {
  return answerOf(query, await index.search(query, signal, works), works, shelved)
}

export function prime(signal: AbortSignal): Promise<void> {
  return index.open(signal)
}
