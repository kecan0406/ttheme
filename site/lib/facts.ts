import type { MenuFacts } from '@/lib/menu'

export interface Repo {
  stars: number
  pushedAt: string
}

export interface Facts {
  version: string
  repo: Repo | null
  menu: MenuFacts
}
