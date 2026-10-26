export interface Repo {
  stars: number
  pushedAt: string
}

export interface Facts {
  palettes: number
  works: number
  version: string
  repo: Repo | null
}
