import { existsSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { type Anchors, type Problem, readAnchors } from '../core/anchors.ts'
import { bestBase, parseScheme, type Ranked, ROLE_BASE, roleBase } from '../core/base.ts'
import { AGENT, MAX_PIXELS } from '../core/booru.ts'
import type { Hex } from '../core/color.ts'
import { hairOf, readRelated, type Tagged, type Verdict, verdictOf, worn } from '../core/consensus.ts'
import { check } from '../core/contrast.ts'
import { type Draft, paletteToml } from '../core/draft.ts'
import { type Crop, cropProblem, type Flat, flatsOf } from '../core/flats.ts'
import { type Departure, departures } from '../core/harmonize.ts'
import { hctOf } from '../core/hct.ts'
import { colorsOfTheme } from '../core/manifest.ts'
import { lookalikes, mirrored, withSlot } from '../core/mirror.ts'
import { decodeImage, encodeRgba, type Rgba, resample } from '../core/png.ts'
import type { Colors } from '../core/seeds.ts'
import {
  type Catalog,
  catalogProblem,
  MARKETPLACE_FILE,
  readTheme,
  type Shade,
  type Theme,
  textProblem,
} from '../core/theme.ts'
import { artDir, artKey, fetchArt } from '../pictures/art.ts'
import { reach, readMarketplaces } from '../store/available.ts'
import { writeAtomic } from '../store/edits.ts'
import { marketplaceFiles } from '../store/local.ts'
import { namesOf } from '../store/names.ts'
import { configHome } from '../store/paths.ts'
import { readSchemes, schemesDir, syncSchemes } from '../store/schemes.ts'
import { localIdentity } from '../store/sources.ts'
import { normalize } from '../tui/find/attach.ts'
import { EXIT, emit, InputError } from './answer.ts'
import { install } from './craft.ts'
import { ensureLocal } from './marketplaces.ts'
import { withCatalogs } from './publish.ts'

export interface PaletteFlags {
  json?: boolean
  preview?: boolean
  crop?: string
  quant?: string
  anchors?: string
  catalog?: string
  native?: string
  lead?: string
  in?: string
  'dry-run'?: boolean
}

interface Preview {
  path: string
  width: number
  height: number
}

interface Measured {
  image: Preview
  preview?: Preview
  crop?: Crop
  quant?: number
  pixels: number
  opaque: number
  distinct: number
  flats: (Omit<Flat, 'count'> & { share: number })[]
  median: Hex
}

interface Made {
  name: string
  file: string
  changed: boolean
  written: boolean
  source?: string
  nativeNames?: string[]
  colors: Colors
  base: string
  signature: Departure[]
  turned: { slot: string; rule: string; from: Hex; to: Hex }[]
  lookalikes: string[]
  gate: string[]
  text: string
}

const PREVIEW = 800
const QUANT = { min: 2, max: 256 }
const NATIVE_MOST = 4
const RELATED = 'https://safebooru.donmai.us/related_tag.json'
const RELATED_TIMEOUT = 15_000

const round = (n: number, digits = 0) => Number(n.toFixed(digits))

const expand = (path: string) => (path.startsWith('~/') ? join(homedir(), path.slice(2)) : resolve(path))

const isUrl = (ref: string) => /^https?:\/\//i.test(ref)

export async function runPalette(action: string, arg: string | undefined, flags: PaletteFlags): Promise<number> {
  if (action === 'measure') return measure(arg, flags)

  if (action === 'consensus') return consensus(arg, flags)

  if (action === 'make') return make(arg, flags)

  throw new InputError(`${action} is not an action — measure, consensus or make`, [
    { path: 'action', problem: 'one of measure, consensus, make' },
  ])
}

function cropOf(text: string | undefined): Crop | undefined {
  if (text === undefined) return undefined

  const parts = text.split(',').map(Number)
  const [x, y, width, height] = parts

  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0) || !width || !height) {
    throw new InputError(`--crop ${text} is not a box`, [
      { path: 'crop', problem: 'four whole numbers x,y,w,h, w and h above 0' },
    ])
  }

  return { x: x as number, y: y as number, width, height }
}

function quantOf(text: string | undefined): number | undefined {
  if (text === undefined) return undefined

  const quant = Number(text)

  if (!Number.isInteger(quant) || quant < QUANT.min || quant > QUANT.max) {
    throw new InputError(`--quant ${text} is out of range`, [
      { path: 'quant', problem: `a whole number from ${QUANT.min} to ${QUANT.max}` },
    ])
  }

  return quant
}

async function picture(ref: string): Promise<{ path: string; key: string; image: Rgba }> {
  let bytes: Uint8Array
  let path: string
  let key: string

  if (isUrl(ref)) {
    ;({ bytes, path } = await fetchArt(ref))
    key = artKey(ref)
  } else {
    path = expand(ref)
    const file = statSync(path, { throwIfNoEntry: false })

    if (!file?.isFile()) {
      throw new InputError(`${ref} cannot be read`, [{ path: 'image', problem: 'a file or an http(s) address' }])
    }

    bytes = new Uint8Array(readFileSync(path))
    key = artKey(`${path}:${file.size}:${file.mtimeMs}`)
  }

  const loaded = await normalize(bytes, ref).catch((error: Error) => {
    throw new InputError(`${ref}: ${error.message} — PNG and JPEG work everywhere; turn anything else into a PNG`, [
      { path: 'image', problem: 'a PNG or JPEG picture' },
    ])
  })

  return { path, key, image: decodeImage(loaded.bytes, MAX_PIXELS) }
}

function previewOf(key: string, image: Rgba): Preview {
  const scale = Math.min(1, PREVIEW / Math.max(image.width, image.height))
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))
  const path = join(artDir(), `${key}.preview.png`)

  if (!existsSync(path)) {
    writeAtomic(path, encodeRgba(resample(image, { x: 0, y: 0, w: image.width, h: image.height }, width, height)))
  }

  return { path, width, height }
}

function onImage(box: Crop, preview: { width: number; height: number }, image: Rgba): Crop {
  const problem = cropProblem(preview, box)

  if (problem !== undefined) throw new InputError('--crop does not fit the preview', [{ path: 'crop', problem }])

  const fx = image.width / preview.width
  const fy = image.height / preview.height
  const x = Math.min(image.width - 1, Math.round(box.x * fx))
  const y = Math.min(image.height - 1, Math.round(box.y * fy))

  return {
    x,
    y,
    width: Math.max(1, Math.min(image.width - x, Math.round(box.width * fx))),
    height: Math.max(1, Math.min(image.height - y, Math.round(box.height * fy))),
  }
}

async function measure(ref: string | undefined, flags: PaletteFlags): Promise<number> {
  if (ref === undefined) {
    throw new InputError('name a picture to measure', [{ path: 'image', problem: 'a file or an http(s) address' }])
  }

  const box = cropOf(flags.crop)
  const quant = quantOf(flags.quant)
  const { path, key, image } = await picture(ref)
  const preview = flags.preview ? previewOf(key, image) : undefined
  const crop = box && preview ? onImage(box, preview, image) : box
  const problem = crop && cropProblem(image, crop)

  if (problem) throw new InputError('--crop does not fit the picture', [{ path: 'crop', problem }])

  const counted = flatsOf(image, { ...(crop ? { crop } : {}), ...(quant ? { quant } : {}) })

  const measured: Measured = {
    image: { path, width: image.width, height: image.height },
    ...(preview ? { preview } : {}),
    ...(crop ? { crop } : {}),
    ...(quant ? { quant } : {}),
    pixels: counted.pixels,
    opaque: counted.opaque,
    distinct: counted.distinct,
    flats: counted.flats.map(({ count, ...f }) => ({
      ...f,
      share: round(count / Math.max(1, counted.opaque), 3),
      hue: round(f.hue),
      chroma: round(f.chroma),
      tone: round(f.tone),
    })),
    median: counted.median,
  }

  if (flags.json) emit({ status: 'done', ...measured })
  else console.log(measuredLines(measured).join('\n'))

  return EXIT.done
}

function hctText(h: { hue: number; chroma: number; tone: number }): string {
  const n = (v: number, w: number) => String(Math.round(v)).padStart(w)

  return `H ${n(h.hue, 3)}  C ${n(h.chroma, 3)}  T ${n(h.tone, 3)}`
}

function measuredLines(m: Measured): string[] {
  const pct = (share: number) => `${(share * 100).toFixed(1)}%`.padStart(6)
  const size = `${m.image.width}×${m.image.height}`
  const where = m.crop ? `${size}, a ${m.crop.width}×${m.crop.height} box at ${m.crop.x},${m.crop.y}` : size

  return [
    `picture  ${m.image.path} · ${where}`,
    ...(m.preview
      ? [`preview  ${m.preview.path} · ${m.preview.width}×${m.preview.height}, crop boxes in its pixels`]
      : []),
    `opaque   ${m.opaque} of ${m.pixels} px`,
    m.quant ? `colors   ${m.distinct} buckets at ${m.quant} levels` : `colors   ${m.distinct} exact`,
    '',
    ...m.flats.map((f) =>
      `${f.hex}  ${pct(f.share)}  ${hctText(f)}  ${f.shadowOf ? `shadow of ${f.shadowOf}` : f.lit ? 'lit' : ''}`.trimEnd(),
    ),
    '',
    `median   ${m.median}  ${hctText(hctOf(m.median))}`,
  ]
}

function verdictText(verdict: Verdict): string {
  if (verdict.kind === 'thin') return `too few posts to tell (${verdict.posts}) — your own reading decides`

  if (verdict.kind === 'eyes') return `the eyes — ${verdict.tag.name} ${verdict.tag.frequency.toFixed(2)}`

  if (verdict.kind === 'item') return `an item — ${verdict.tag.name} ${verdict.tag.frequency.toFixed(2)}`

  if (verdict.kind === 'achromatic') return 'an achromatic identity — keep it near-neutral'

  return 'no consensus — your own reading decides'
}

async function consensus(tag: string | undefined, flags: PaletteFlags): Promise<number> {
  if (tag === undefined || !/^\S+$/.test(tag)) {
    throw new InputError('name a danbooru tag', [{ path: 'tag', problem: 'a danbooru tag, such as gotoh_hitori' }])
  }

  const query = new URLSearchParams({ query: `${tag} solo`, category: 'general', limit: '150' })
  const response = await reach(`${RELATED}?${query}`, RELATED_TIMEOUT, undefined, { 'User-Agent': AGENT })
  const related = readRelated(await response.json())

  if (!related) throw new Error('safebooru answered something ttheme cannot read')

  const current = namesOf(tag)?.tag
  const found = worn(related.tags)
  const verdict = verdictOf(related.posts, found)
  const hair = hairOf(found.hair)
  const top = (tags: Tagged[]) => tags.slice(0, NATIVE_MOST)

  const answer = {
    tag,
    ...(current && current !== tag ? { current } : {}),
    posts: related.posts,
    hair: top(found.hair),
    eyes: top(found.eyes),
    items: top(found.items),
    verdict,
    ...(hair ? { hairIs: hair } : {}),
  }

  if (flags.json) {
    emit({ status: 'done', ...answer })

    return EXIT.done
  }

  const list = (tags: Tagged[]) => tags.map((t) => `${t.name} ${t.frequency.toFixed(2)}`).join('  ') || '—'

  console.log(
    [
      `${tag} · ${related.posts} posts${current && current !== tag ? ` · danbooru calls it ${current}` : ''}`,
      `  hair     ${list(answer.hair)}`,
      `  eyes     ${list(answer.eyes)}`,
      `  items    ${list(answer.items)}`,
      `  verdict  ${verdictText(verdict)}${hair ? ` · the hair is ${hair.chromatic ? 'chromatic' : 'achromatic'}` : ''}`,
    ].join('\n'),
  )

  return EXIT.done
}

function readAnchorsFile(path: string | undefined): Anchors[] {
  if (path === undefined) {
    throw new InputError('pass --anchors <file>', [
      { path: 'anchors', problem: 'a JSON file — see `ttheme help palette`' },
    ])
  }

  let doc: unknown

  try {
    doc = JSON.parse(readFileSync(expand(path), 'utf8'))
  } catch (error) {
    throw new InputError(`${path} is not a JSON file ttheme can read — ${(error as Error).message}`, [
      { path: 'anchors', problem: 'a JSON file' },
    ])
  }

  const { anchors, problems } = readAnchors(doc)

  if (problems.length > 0) throw new InputError(`${path} has ${problems.length} problem(s)`, problems)

  return anchors
}

interface Target {
  dir: string
  id?: string
  official: boolean
  catalogs: Catalog[]
}

async function targetOf(into: string | undefined, dry: boolean): Promise<Target | undefined> {
  const home = configHome()
  const dir = into === undefined ? undefined : expand(into)

  const official = dir && existsSync(join(dir, MARKETPLACE_FILE)) ? localIdentity(dir) : undefined

  if (dir && official?.name === 'official') return { dir, official: true, catalogs: official.catalogs }

  try {
    const local = await ensureLocal(home, into)

    return { dir: local.dir, id: local.id, official: false, catalogs: localIdentity(local.dir).catalogs }
  } catch (error) {
    if (dry) return undefined

    throw new InputError((error as Error).message, [{ path: 'in', problem: 'one of your local marketplaces' }])
  }
}

function nativeNamesOf(anchors: Anchors, booru: string | undefined): string[] | undefined {
  if (anchors.nativeNames) return anchors.nativeNames

  const known = booru ? namesOf(booru) : undefined

  const seen = new Set<string>()

  const names = (known?.japanese ?? []).filter((name) => {
    const key = name.replace(/[\s\u3000・]/g, '')

    const kept =
      !/[(（|]|(ちゃん|くん|さん|さま|様|たん)$/.test(name) && textProblem(name) === undefined && !seen.has(key)

    seen.add(key)

    return kept
  })

  return names.length > 0 ? names.slice(0, NATIVE_MOST) : undefined
}

function shelvedIn(dir: string, catalogs: readonly Catalog[]): Theme[] {
  const known = new Map(catalogs.map((c) => [c.name, c]))

  return marketplaceFiles(dir, catalogs)
    .filter((f) => f.catalog !== undefined)
    .map((f) => readTheme(f.path, readFileSync(f.path, 'utf8'), { name: f.slug, catalog: f.catalog, catalogs: known }))
}

function ordersIn(themes: readonly Theme[]): Map<string, number[]> {
  return new Map(
    [...Map.groupBy(themes, (t) => t.catalog as string)].map(([catalog, held]) => [catalog, held.map((t) => t.order)]),
  )
}

function codenameIn(themes: readonly Theme[], catalog: string): string {
  return (
    themes.find((t) => t.catalog === catalog && t.ansiSource.includes(' + '))?.ansiSource.split(' + ')[1] ?? catalog
  )
}

function anchoredOf(anchors: Anchors): Shade & { name: string; signatureSlots: string[] } {
  return {
    name: anchors.name,
    signatureSlots: anchors.slots.map(([slot]) => slot),
    ...anchors.slots.reduce((shade, [slot, anchor]) => withSlot(shade, slot, anchor.hex), roleBase()),
  }
}

function baseFor(
  anchors: Anchors,
  schemes: readonly (readonly [string, Shade | undefined])[],
): { ranked: Ranked; problems: Problem[] } | { ranked: undefined; problems: Problem[] } {
  const choice = bestBase(anchoredOf(anchors), schemes)

  if (choice.best !== undefined) return { ranked: choice.best, problems: [] }

  const { dropped } = choice
  const harmonizer = [...dropped.values()].find((reason) => reason.startsWith('harmonizer: '))

  if (harmonizer) {
    return {
      ranked: undefined,
      problems: [{ path: `${anchors.name}.slots`, problem: harmonizer.replace(/^harmonizer: [^:]+: /, '') }],
    }
  }

  const gate = [...dropped.values()].find((reason) => reason.startsWith('gate: '))

  return {
    ranked: undefined,
    problems: [
      {
        path: `${anchors.name}.slots`,
        problem: `no base scheme passes the contrast checks with these anchors${gate ? ` — ${gate.slice(6).split('; ')[0]}` : ''}`,
      },
    ],
  }
}

function draftOf(
  anchors: Anchors,
  best: Ranked,
  booru: string | undefined,
  source: string,
  extra: Pick<Draft, 'order' | 'other'>,
): Draft {
  const nativeNames = nativeNamesOf(anchors, booru)

  return {
    name: anchors.name,
    ...(nativeNames ? { nativeNames } : {}),
    ...extra,
    ansiSource: source,
    ...(booru ? { booru } : {}),
    signature: anchors.slots.map(([slot]) => slot),
    ...colorsOfTheme(best.shade),
  }
}

async function corpus(notes: string[]): Promise<(readonly [string, Shade | undefined])[]> {
  try {
    const synced = await syncSchemes()
    notes.push(...synced.notes)

    if (synced.names.length > 0) {
      const read = await readSchemes(schemesDir(), synced.names)

      return [...read.map(([name, text]) => [name, parseScheme(text)] as const), [ROLE_BASE, roleBase()] as const]
    }
  } catch (error) {
    notes.push(`base schemes unavailable (${(error as Error).message})`)
  }

  notes.push(`no base schemes to rank — the ANSI colors start from the centers of their roles`)

  return [[ROLE_BASE, roleBase()]]
}

async function make(only: string | undefined, flags: PaletteFlags): Promise<number> {
  const dry = flags['dry-run'] === true
  const all = readAnchorsFile(flags.anchors)
  const chosen = only === undefined ? all : all.filter((a) => a.name === only)

  if (chosen.length === 0) {
    throw new InputError(`${only} is not in ${flags.anchors}`, [
      { path: 'name', problem: `one of ${all.map((a) => a.name).join(', ')}` },
    ])
  }

  const catalog = flags.catalog
  const problems: Problem[] = []

  if (catalog !== undefined && catalogProblem(catalog)) {
    problems.push({ path: 'catalog', problem: catalogProblem(catalog) as string })
  }

  if (flags.native !== undefined && textProblem(flags.native)) {
    problems.push({ path: 'native', problem: textProblem(flags.native) as string })
  }

  if ((flags.native !== undefined || flags.lead !== undefined) && catalog === undefined) {
    problems.push({ path: 'catalog', problem: '--native and --lead name a catalog — pass --catalog too' })
  }

  const target = await targetOf(flags.in, dry)

  if (target?.official && catalog === undefined) {
    problems.push({ path: 'catalog', problem: 'an official palette sits in a catalog — pass --catalog' })
  }

  const table = catalog === undefined ? undefined : target?.catalogs.find((c) => c.name === catalog)
  const lead = flags.lead ?? table?.lead

  if (flags.lead !== undefined && !chosen.some((a) => a.name === flags.lead)) {
    const shelved = target ? marketplaceFiles(target.dir, target.catalogs) : []

    if (!shelved.some((f) => f.slug === flags.lead && f.catalog === catalog)) {
      problems.push({ path: 'lead', problem: `one of the palettes in ${catalog}` })
    }
  }

  if (problems.length > 0) throw new InputError('the options do not fit together', problems)

  const notes: string[] = []
  const schemes = await corpus(notes)
  const shelved = target?.official ? shelvedIn(target.dir, target.catalogs) : []
  const orders = ordersIn(shelved)
  const highest = Math.max(0, ...[...orders.values()].flat())
  let next = catalog && orders.has(catalog) ? Math.max(...(orders.get(catalog) as number[])) + 1 : highest + 1
  const made: Made[] = []
  const failed: Problem[] = []

  for (const anchors of chosen) {
    const { ranked, problems: why } = baseFor(anchors, schemes)

    if (!ranked) {
      failed.push(...why)
      continue
    }

    const current = anchors.booru ? namesOf(anchors.booru)?.tag : undefined
    const booru = current ?? anchors.booru

    if (current && current !== anchors.booru) notes.push(`${anchors.name}: danbooru calls ${anchors.booru} ${current}`)

    const other = target?.official
      ? colorsOfTheme(
          mirrored({ ...ranked.shade, name: anchors.name, signatureSlots: anchors.slots.map(([s]) => s), waive: [] })
            .shade,
        )
      : undefined

    const source = target?.official && catalog ? `${ranked.name} + ${codenameIn(shelved, catalog)}` : ranked.name
    const order = target?.official ? next++ : undefined

    const draft = draftOf(anchors, ranked, booru, source, { ...(order ? { order } : {}), ...(other ? { other } : {}) })
    const text = paletteToml(draft)

    const file = target ? join(target.dir, 'palettes', ...(catalog ? [catalog] : []), `${anchors.name}.toml`) : ''

    const clash =
      target &&
      marketplaceFiles(target.dir, target.catalogs).find((f) => f.slug === anchors.name && f.catalog !== catalog)

    if (clash) {
      failed.push({
        path: anchors.name,
        problem: `${target?.id ?? 'the marketplace'} already has ${anchors.name}${clash.catalog ? ` in ${clash.catalog}` : ''} — a name is used once in a marketplace`,
      })
      continue
    }

    const signatureSlots = anchors.slots.map(([slot]) => slot)
    const theme = { ...ranked.shade, name: anchors.name, signatureSlots, waive: [] }

    made.push({
      name: target?.id ? `${target.id}/${anchors.name}` : anchors.name,
      file,
      changed: file === '' || !existsSync(file) || readFileSync(file, 'utf8') !== text,
      written: false,
      ...(anchors.source ? { source: anchors.source } : {}),
      ...(draft.nativeNames ? { nativeNames: draft.nativeNames } : {}),
      colors: colorsOfTheme(ranked.shade),
      base: ranked.name,
      signature: departures(
        Object.fromEntries(anchors.slots.map(([slot, a]) => [slot, [a.part, a.hex] as const])),
        signatureSlots,
        ranked.shade,
      ).map((d) => ({
        ...d,
        delta: round(d.delta, 1),
        ...(d.shift === undefined ? {} : { shift: round(d.shift, 1) }),
      })),
      turned: ranked.moves,
      lookalikes: lookalikes(theme, ranked.shade).map(([a, b]) => `${a}/${b}`),
      gate: check(theme).map((v) => `${v.rule} — ${v.detail}`),
      text,
    })
  }

  if (failed.length > 0) throw new InputError(`${failed.length} palette(s) cannot be made`, failed)

  const catalogText =
    target && catalog && !table
      ? withCatalogs(readFileSync(join(target.dir, MARKETPLACE_FILE), 'utf8'), [
          { name: catalog, ...(flags.native ? { native: flags.native } : {}), ...(lead ? { lead } : {}) },
        ])
      : undefined

  let installed: string[] = []

  if (!dry && target) {
    for (const m of made.filter((x) => x.changed)) {
      writeAtomic(m.file, m.text)
      m.written = true
    }

    if (catalogText !== undefined) writeAtomic(join(target.dir, MARKETPLACE_FILE), catalogText)

    if (!target.official) {
      const home = configHome()
      installed = install(
        home,
        readMarketplaces(home),
        made.map((m) => m.name),
      ).fresh
    }
  }

  const changed = made.some((m) => m.changed) || catalogText !== undefined || installed.length > 0
  const status = dry || changed ? 'done' : 'unchanged'

  if (flags.json) {
    emit({
      status,
      dryRun: dry,
      ...(target?.id ? { marketplace: target.id } : {}),
      notes,
      palettes: made.map(({ text: _, ...m }) => ({ ...m, installed: installed.includes(m.name) })),
    })
  } else {
    console.log(madeLines(made, { dry, installed, notes, official: target?.official === true }).join('\n'))
  }

  return status === 'unchanged' ? EXIT.unchanged : EXIT.done
}

function madeLines(
  made: Made[],
  { dry, installed, notes, official }: { dry: boolean; installed: string[]; notes: string[]; official: boolean },
): string[] {
  const lines = made.flatMap((m) => {
    const part = Math.max(0, ...m.signature.map((d) => d.part.length))

    return [
      `${m.name} · base ${m.base}`,
      ...m.signature.map(
        (d) =>
          `  ${d.slot.padEnd(10)} ${d.part.padEnd(part)}  ${d.measured} → ${d.final}  ΔE ${d.delta.toFixed(1)}${d.far || d.turned ? '  far from its anchor' : ''}`,
      ),
      ...m.turned.map((t) => `  turned     ${t.slot} ${t.from} → ${t.to}  ${t.rule}`),
      ...m.lookalikes.map((pair) => `  reads as one  ${pair}`),
      ...(m.gate.length > 0 ? m.gate.map((g) => `  contrast   ${g}`) : ['  contrast   clean']),
      `  ${m.changed ? (m.written ? 'wrote' : 'would write') : 'unchanged'}  ${m.file || '(no marketplace yet)'}`,
    ]
  })

  return [
    ...notes.map((n) => `note: ${n}`),
    ...lines,
    ...(installed.length > 0
      ? ['', `Installed ${installed.join(', ')} — \`ttheme use <name>\` uses one in a tab`]
      : []),
    ...(official && !dry ? ['', 'Next: mise run build, then mise run ci'] : []),
  ]
}
