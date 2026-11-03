import { SEARCH_PATH, type SearchIndex } from '@/lib/search'

let load: Promise<SearchIndex> | null = null

let held: SearchIndex | null = null

export function searchIndex(): Promise<SearchIndex> {
  if (load) return load

  const loading = fetch(SEARCH_PATH, { priority: 'low' }).then((response) => {
    if (!response.ok) throw new Error(String(response.status))

    return response.json() as Promise<SearchIndex>
  })

  load = loading
  loading.then(
    (index) => {
      held = index
    },
    () => {
      load = null
    },
  )

  return loading
}

export function heldIndex(): SearchIndex | null {
  return held
}
