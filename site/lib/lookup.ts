import { commons, themes } from '@/lib/builtin'
import { listedWorks, marketplaces } from '@/lib/marketplaces'
import { answerOf, type NamesAnswer } from '@/lib/names'
import { mergeWorks, workOfListed } from '../../src/core/commons.ts'
import { liveSource, searchIn } from '../../src/store/names.ts'

const search = searchIn(liveSource())

const works = mergeWorks(commons.works, listedWorks.map(workOfListed))

const shelved = new Set(
  [...themes, ...marketplaces.flatMap((marketplace) => marketplace.palettes)].flatMap((theme) =>
    [theme.work, ...theme.also].flatMap((work) => (work ? [work.id] : [])),
  ),
)

export async function lookUp(query: string, signal: AbortSignal): Promise<NamesAnswer> {
  return answerOf(query, await search(query, signal), works, shelved)
}
