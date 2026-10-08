import type { Picture, PictureCredit } from '@/lib/share-view'
import { linksOf, pageLabel, postCredit, safeUrl } from '../../src/artists.ts'
import { SITES } from '../../src/booru.ts'
import type { Shared } from './share'

const TIMEOUT = 8000

async function creditOf(site: string, id: number): Promise<PictureCredit | null> {
  const found = SITES.find((s) => s.key === site)
  if (!found) {
    return { artists: [], page: null }
  }
  const credit = await postCredit(found, id, AbortSignal.timeout(TIMEOUT))
  if (!credit) {
    return { artists: [], page: null }
  }
  return {
    artists: credit.artist.map((name) => ({
      name,
      links: linksOf(credit.profiles[name]).map((link) => ({ label: link.kind, url: link.url })),
    })),
    page: safeUrl(credit.source) ? { label: pageLabel(credit.source), url: credit.source } : null,
  }
}

export async function creditsOf(shared: Shared): Promise<{ pictures: Picture[]; complete: boolean }> {
  const credits = await Promise.all(
    (shared.entry.pictures ?? []).map((picture) => creditOf(picture.site, picture.id).catch(() => null)),
  )
  return {
    pictures: shared.pictures.map((picture, at) => ({ ...picture, credit: credits[at] ?? null })),
    complete: credits.every((credit) => credit !== null),
  }
}
