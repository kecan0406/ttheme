export interface Repo {
  stars: number
  pushedAt: string
}

export interface Facts {
  palettes: number
  catalogs: number
  version: string
  repo: Repo | null
}
