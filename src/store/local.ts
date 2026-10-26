import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { WORKS_DIR, type Work } from '../core/commons.ts'
import type { PaletteEntry } from '../core/manifest.ts'
import {
  type MarketplaceFile,
  marketplaceLayout,
  type Report,
  readMarketplaceFiles,
  readWorkFiles,
  type WorkFile,
  workLayout,
} from '../core/own.ts'
import { escaped } from '../core/text.ts'
import { type Identity, isBuiltin, marketplaceId, publisherOf, slugOf } from '../core/theme.ts'
import { isLocal, localIdentity, marketplaceSources } from './sources.ts'

export interface LocalMarketplace extends Identity {
  dir: string
  id: string
}

export interface Shelved {
  entries: PaletteEntry[]
  works: Work[]
}

export function localMarketplaces(configHome: string, warn = true): LocalMarketplace[] {
  return marketplaceSources(configHome)
    .filter(isLocal)
    .flatMap((dir) => {
      try {
        const identity = localIdentity(dir)

        return [{ dir, ...identity, id: marketplaceId(identity) }]
      } catch (error) {
        if (warn) {
          process.stderr.write(
            `ttheme: skipping the marketplace at ${escaped(dir)} — ${escaped((error as Error).message)}\n`,
          )
        }

        return []
      }
    })
}

export function palettesDir(dir: string): string {
  return join(dir, 'palettes')
}

export function worksDir(dir: string): string {
  return join(dir, WORKS_DIR)
}

function listed(dir: string, folder: string): string[] {
  return existsSync(join(dir, folder)) ? readdirSync(join(dir, folder)).map((file) => `${folder}/${file}`) : []
}

export function marketplaceFiles(dir: string): MarketplaceFile[] {
  return marketplaceLayout(listed(dir, 'palettes'), (path) => join(dir, path))
}

export function workFiles(dir: string): WorkFile[] {
  return workLayout(listed(dir, WORKS_DIR), (path) => join(dir, path))
}

export function ownPath(configHome: string, name: string): string {
  if (isBuiltin(name)) {
    throw new Error(`${name} is a built-in palette — yours are named <you>@<marketplace>/<palette>`)
  }

  const marketplace = publisherOf(name)
  const local = localMarketplaces(configHome, false).find((m) => m.id === marketplace)

  if (!local) {
    throw new Error(
      `${marketplace} is not a local marketplace — \`ttheme marketplace add <dir>\` adds the folder that holds it`,
    )
  }

  return join(palettesDir(local.dir), `${slugOf(name)}.toml`)
}

export function warning(warn: boolean): Report {
  return warn
    ? (where, message) => process.stderr.write(`ttheme: skipping ${escaped(where)} — ${escaped(message)}\n`)
    : () => {}
}

export function readMarketplaceDir(dir: string, id: string, report: Report = warning(true)): Shelved {
  return {
    entries: readMarketplaceFiles(marketplaceFiles(dir), (file) => readFileSync(file.path, 'utf8'), id, report),
    works: readWorkFiles(workFiles(dir), (file) => readFileSync(file.path, 'utf8'), report),
  }
}

export function readLocal(configHome: string, warn = true): Shelved {
  const read = localMarketplaces(configHome, warn).map(({ dir, id }) => readMarketplaceDir(dir, id, warning(warn)))

  return { entries: read.flatMap((m) => m.entries), works: read.flatMap((m) => m.works) }
}
