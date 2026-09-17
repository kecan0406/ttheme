import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { GATE_RULES } from './contrast.ts'
import type { Manifest, PaletteEntry } from './emit/manifest.ts'

export const REGISTRY_URL = 'https://kecan0406.github.io/ttheme/manifest.json'

export function catalogPath(configHome: string): string {
  return join(configHome, 'ttheme', 'catalog.json')
}

export function writeCatalog(configHome: string, catalog: Manifest): void {
  const path = catalogPath(configHome)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(catalog, null, 2)}\n`)
}

export function readCatalog(configHome: string): Manifest {
  const path = catalogPath(configHome)
  if (!existsSync(path)) {
    throw new Error(`no catalog at ${path} — run \`ttheme init\` first`)
  }
  return parseCatalog(readFileSync(path, 'utf8'))
}

export function parseCatalog(source: string): Manifest {
  let doc: unknown
  try {
    doc = JSON.parse(source)
  } catch {
    throw new Error('catalog is not valid JSON')
  }
  const catalog = doc as Manifest
  if (typeof catalog?.version !== 'string' || !Array.isArray(catalog.palettes)) {
    throw new Error('catalog has no version or palettes')
  }
  for (const p of catalog.palettes) {
    if (typeof p?.name !== 'string' || !Array.isArray(p.ansi) || p.ansi.length !== 16) {
      throw new Error(`catalog entry ${JSON.stringify(p?.name)} is missing name or its 16 ANSI colors`)
    }
  }
  return catalog
}

export async function fetchCatalog(url: string): Promise<Manifest> {
  let response: Response
  try {
    response = await fetch(url)
  } catch (error) {
    throw new Error(`cannot reach the registry at ${url} — ${error instanceof Error ? error.message : String(error)}`)
  }
  if (!response.ok) {
    throw new Error(`registry at ${url} answered ${response.status}`)
  }
  return parseCatalog(await response.text())
}

export function gateFailures(palette: PaletteEntry): string[] {
  const waived = new Set(palette.waived ?? [])
  return GATE_RULES.flatMap((rule, i) => {
    const value = palette.gate?.[i]
    if (waived.has(rule.rule) || typeof value !== 'number') {
      return []
    }
    if (rule.min !== undefined && value < rule.min) {
      return [`${rule.label} ${value} < ${rule.min}`]
    }
    if (rule.max !== undefined && value > rule.max) {
      return [`${rule.label} ${value} > ${rule.max}`]
    }
    return []
  })
}

export function find(palettes: PaletteEntry[], name: string): PaletteEntry {
  const hit = palettes.find((p) => p.name === name)
  if (!hit) {
    throw new Error(`no palette named ${name} in the catalog — \`ttheme list\` shows what is there`)
  }
  return hit
}

export function search(palettes: PaletteEntry[], query: string): PaletteEntry[] {
  const needle = query.toLowerCase()
  return palettes.filter((p) =>
    [p.name, p.group, p.native ?? '', p.ansiSource].some((field) => field.toLowerCase().includes(needle)),
  )
}
