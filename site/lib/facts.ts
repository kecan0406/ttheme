export interface Repo {
  stars: number
  pushedAt: string
}

export interface Facts {
  version: string
  repo: Repo | null
}
