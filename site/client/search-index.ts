import { SEARCH_PATH, type SearchIndex } from '@/lib/search'

type Loaded =
  | { state: 'idle' | 'failed' }
  | { state: 'loading'; load: Promise<SearchIndex> }
  | { state: 'held'; load: Promise<SearchIndex>; index: SearchIndex }

let loaded: Loaded = { state: 'idle' }

export function searchIndex(): Promise<SearchIndex> {
  if (loaded.state === 'loading' || loaded.state === 'held') return loaded.load

  const load = fetch(SEARCH_PATH, { priority: 'low' }).then((response) => {
    if (!response.ok) throw new Error(String(response.status))

    return response.json() as Promise<SearchIndex>
  })

  loaded = { state: 'loading', load }
  load.then(
    (index) => {
      loaded = { state: 'held', load, index }
    },
    () => {
      loaded = { state: 'failed' }
    },
  )

  return load
}

export function heldIndex(): SearchIndex | null {
  return loaded.state === 'held' ? loaded.index : null
}

export function indexFailed(): boolean {
  return loaded.state === 'failed'
}
