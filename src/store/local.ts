import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { WORKS_DIR, type Work } from '../core/commons.ts'
import type { PaletteEntry } from '../core/manifest.ts'
import {
  marketplaceLayout,
  type Report,
  readMarketplaceFiles,
  readWorkFiles,
  type SetFile,
  type WorkFile,
  workLayout,
} from '../core/own.ts'
import { type Block, SETS_DIR, setBlocks, setNameFor, withPalette } from '../core/sets.ts'
import { escaped } from '../core/text.ts'
import { type Identity, isBuiltin, marketplaceId, publisherOf, slugOf } from '../core/theme.ts'
import { writeAtomic } from './edits.ts'
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

export function setsDir(dir: string): string {
  return join(dir, SETS_DIR)
}

export function worksDir(dir: string): string {
  return join(dir, WORKS_DIR)
}

function listed(dir: string, folder: string): string[] {
  return existsSync(join(dir, folder)) ? readdirSync(join(dir, folder)).map((file) => `${folder}/${file}`) : []
}

export function setFiles(dir: string): SetFile[] {
  return marketplaceLayout(listed(dir, SETS_DIR), (path) => join(dir, path))
}

export function workFiles(dir: string): WorkFile[] {
  return workLayout(listed(dir, WORKS_DIR), (path) => join(dir, path))
}

export interface Own {
  path: string
  text: string
}

function blocksOf(path: string): Block[] {
  try {
    return setBlocks(basename(path), readFileSync(path, 'utf8')).blocks
  } catch {
    return []
  }
}

export function ownIn(dir: string): Map<string, Own> {
  const found = new Map<string, Own>()

  for (const file of setFiles(dir)) {
    for (const { slug, text } of blocksOf(file.path)) {
      if (!found.has(slug)) {
        found.set(slug, { path: file.path, text })
      }
    }
  }

  return found
}

export function localFor(configHome: string, name: string): LocalMarketplace {
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

  return local
}

export function ownFile(configHome: string, name: string): Own | undefined {
  return ownIn(localFor(configHome, name).dir).get(slugOf(name))
}

export function writeOwnIn(dir: string, slug: string, text: string): string {
  const path = ownIn(dir).get(slug)?.path ?? join(setsDir(dir), `${setNameFor(text)}.toml`)
  const before = existsSync(path) ? readFileSync(path, 'utf8') : undefined
  const after = withPalette(basename(path), before, slug, text) as string
  mkdirSync(dirname(path), { recursive: true })
  writeAtomic(path, after)

  return path
}

export function writeOwn(configHome: string, name: string, text: string): string {
  return writeOwnIn(localFor(configHome, name).dir, slugOf(name), text)
}

export function dropOwnIn(dir: string, slug: string): void {
  const own = ownIn(dir).get(slug)

  if (!own) {
    return
  }

  const after = withPalette(basename(own.path), readFileSync(own.path, 'utf8'), slug, undefined)

  if (after === undefined) {
    rmSync(own.path)
  } else {
    writeAtomic(own.path, after)
  }
}

export function warning(warn: boolean): Report {
  return warn
    ? (where, message) => process.stderr.write(`ttheme: skipping ${escaped(where)} — ${escaped(message)}\n`)
    : () => {}
}

export function readMarketplaceDir(dir: string, id: string, report: Report = warning(true)): Shelved {
  return {
    entries: readMarketplaceFiles(setFiles(dir), (file) => readFileSync(file.path, 'utf8'), id, report),
    works: readWorkFiles(workFiles(dir), (file) => readFileSync(file.path, 'utf8'), report),
  }
}

export function readLocal(configHome: string, warn = true): Shelved {
  const read = localMarketplaces(configHome, warn).map(({ dir, id }) => readMarketplaceDir(dir, id, warning(warn)))

  return { entries: read.flatMap((m) => m.entries), works: read.flatMap((m) => m.works) }
}
