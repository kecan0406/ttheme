import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { PaletteEntry } from '../core/manifest.ts'
import { type MarketplaceFile, marketplaceLayout, type Report, readMarketplaceFiles } from '../core/own.ts'
import { escaped } from '../core/text.ts'
import { type Catalog, type Identity, marketplaceId, marketplaceOf, slugOf } from '../core/theme.ts'
import { isLocal, localIdentity, marketplaceSources } from './sources.ts'

export interface LocalMarketplace extends Identity {
  dir: string
  id: string
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

function catalogsIn(dir: string): Catalog[] {
  try {
    return localIdentity(dir).catalogs
  } catch {
    return []
  }
}

export function marketplaceFiles(dir: string, catalogs: readonly Catalog[] = []): MarketplaceFile[] {
  const folder = palettesDir(dir)

  if (!existsSync(folder)) {
    return []
  }

  const paths = readdirSync(folder, { withFileTypes: true }).flatMap((item) =>
    item.isDirectory()
      ? readdirSync(join(folder, item.name)).map((file) => `palettes/${item.name}/${file}`)
      : [`palettes/${item.name}`],
  )

  return marketplaceLayout(paths, (path) => join(dir, path), catalogs)
}

export function ownPath(configHome: string, name: string): string {
  const marketplace = marketplaceOf(name)

  if (!marketplace) {
    throw new Error(`${name} is an official palette — yours are named <you>@<marketplace>/<palette>`)
  }

  const local = localMarketplaces(configHome, false).find((m) => m.id === marketplace)

  if (!local) {
    throw new Error(
      `${marketplace} is not a local marketplace — \`ttheme marketplace add <dir>\` adds the folder that holds it`,
    )
  }

  const slug = slugOf(name)

  return marketplaceFiles(local.dir).find((f) => f.slug === slug)?.path ?? join(palettesDir(local.dir), `${slug}.toml`)
}

export function warning(warn: boolean): Report {
  return warn
    ? (where, message) => process.stderr.write(`ttheme: skipping ${escaped(where)} — ${escaped(message)}\n`)
    : () => {}
}

export function readMarketplaceDir(
  dir: string,
  id: string,
  entries: PaletteEntry[],
  report: Report = warning(true),
): PaletteEntry[] {
  const catalogs = catalogsIn(dir)

  return readMarketplaceFiles(
    marketplaceFiles(dir, catalogs),
    (file) => readFileSync(file.path, 'utf8'),
    id,
    entries,
    report,
    false,
    catalogs,
  )
}

export function readLocal(configHome: string, entries: PaletteEntry[], warn = true): PaletteEntry[] {
  return localMarketplaces(configHome, warn).flatMap(({ dir, id }) =>
    readMarketplaceDir(dir, id, entries, warning(warn)),
  )
}
