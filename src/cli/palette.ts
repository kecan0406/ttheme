import { existsSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { type Anchors, type Problem, readAnchors } from '../core/anchors.ts'
import { bestBase, parseScheme, type Ranked, ROLE_BASE, roleBase } from '../core/base.ts'
import { AGENT, MAX_PIXELS } from '../core/booru.ts'
import type { Hex } from '../core/color.ts'
import {
  aboutOf,
  type Commons,
  mergeWorks,
  WORKS_DIR,
  type Work,
  workIdProblem,
  workOf,
  workToml,
} from '../core/commons.ts'
import { hairOf, readRelated, type Tagged, type Verdict, verdictOf, worn } from '../core/consensus.ts'
import { check } from '../core/contrast.ts'
import { paletteToml } from '../core/draft.ts'
import { type Crop, cropProblem, type Flat, flatsOf } from '../core/flats.ts'
import { type Departure, departures } from '../core/harmonize.ts'
import { hctOf } from '../core/hct.ts'
import { colorsOfTheme } from '../core/manifest.ts'
import { lookalikes, mirrored, withSlot } from '../core/mirror.ts'
import { decodeImage, encodeRgba, type Rgba, resample } from '../core/png.ts'
import type { Colors } from '../core/seeds.ts'
import { readSet, setNameOf } from '../core/sets.ts'
import {
  BUILTIN,
  characterIdOf,
  MARKETPLACE_FILE,
  type Shade,
  slugOf,
  type Theme,
  textProblem,
  themeOf,
  toml,
  workIdOf,
} from '../core/theme.ts'
import { artDir, artKey, fetchArt } from '../pictures/art.ts'
import { reach, readMarketplaces } from '../store/available.ts'
import { writeAtomic } from '../store/edits.ts'
import { ownIn, readMarketplaceDir, setFiles, setsDir, warning, worksDir, writeOwnIn } from '../store/local.ts'
import { configHome } from '../store/paths.ts'
import { readSchemes, schemesDir, syncSchemes } from '../store/schemes.ts'
import { normalize } from '../tui/find/attach.ts'
import { EXIT, emit, InputError } from './answer.ts'
import { loadCommons } from './build.ts'
import { install } from './craft.ts'
import { commonsFor, ensureLocal } from './marketplaces.ts'
import { withCharacter } from './publish.ts'

export interface PaletteFlags {
  json?: boolean
  preview?: boolean
  crop?: string
  quant?: string
  anchors?: string
  work?: string
  'work-name'?: string
  'work-native'?: string
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
  subject?: string
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

  const current = related.searched
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
  id: string
  builtin: boolean
  commons: Commons
  proposals: Work[]
  records: string
}

interface Recorded {
  work: string
  characters: string[]
  file: string
  changed: boolean
  written: boolean
  text: string
}

function builtinIn(dir: string): boolean {
  const path = join(dir, MARKETPLACE_FILE)

  return existsSync(path) && toml(MARKETPLACE_FILE, readFileSync(path, 'utf8')).name === BUILTIN
}

async function targetOf(into: string | undefined, dry: boolean): Promise<Target | undefined> {
  const home = configHome()
  const dir = into === undefined ? undefined : expand(into)

  if (dir && builtinIn(dir)) {
    const commons = join(dir, '..', 'commons')

    return {
      dir,
      id: BUILTIN,
      builtin: true,
      commons: loadCommons(commons),
      proposals: [],
      records: join(commons, WORKS_DIR),
    }
  }

  try {
    const local = await ensureLocal(home, into)

    return {
      dir: local.dir,
      id: local.id,
      builtin: false,
      commons: commonsFor(home),
      proposals: readMarketplaceDir(local.dir, local.id, warning(false)).works,
      records: worksDir(local.dir),
    }
  } catch (error) {
    if (dry) return undefined

    throw new InputError((error as Error).message, [{ path: 'in', problem: 'one of your local marketplaces' }])
  }
}

function taggedIn(works: readonly Work[], tag: string): string | undefined {
  for (const work of works) {
    const character = work.characters.find((c) => c.danbooru === tag)

    if (character) return `${work.id}/${character.id}`
  }

  return undefined
}

function shippedIn(dir: string): Theme[] {
  return setFiles(dir).flatMap((f) =>
    readSet(f.path, readFileSync(f.path, 'utf8')).map(({ slug, doc }) =>
      themeOf(`${f.path}: ${slug}`, doc, { name: `${BUILTIN}/${slug}`, builtin: true }),
    ),
  )
}

function codenameIn(shipped: readonly Theme[], work: Work): string {
  const named = shipped.find((t) => t.subject && workIdOf(t.subject) === work.id && t.ansiSource.includes(' + '))

  return named?.ansiSource.split(' + ')[1] ?? work.name
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

function workProblems(flags: PaletteFlags): Problem[] {
  const problems: Problem[] = []
  const work = flags.work

  if (work !== undefined && workIdProblem(work)) {
    problems.push({ path: 'work', problem: workIdProblem(work) as string })
  }

  for (const key of ['work-name', 'work-native'] as const) {
    const value = flags[key]

    if (value !== undefined && textProblem(value)) {
      problems.push({ path: key, problem: textProblem(value) as string })
    }

    if (value !== undefined && work === undefined) {
      problems.push({ path: key, problem: `--${key} names a work — pass --work too` })
    }
  }

  return problems
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

  const problems = workProblems(flags)

  if (problems.length > 0) throw new InputError('the options do not fit together', problems)

  const target = await targetOf(flags.in, dry)
  const commons = target?.commons ?? commonsFor(configHome())
  const known = mergeWorks(commons.works, target?.proposals ?? [])
  const held = (id: string) => workOf(target?.builtin ? commons.works : (target?.proposals ?? []), id)
  const shipped = target?.builtin ? shippedIn(target.dir) : []
  const owned = target ? ownIn(target.dir) : undefined
  const notes: string[] = []
  const schemes = await corpus(notes)
  const made: Made[] = []
  const failed: Problem[] = []
  const records = new Map<string, { work: Work; characters: string[] }>()

  for (const anchors of chosen) {
    const { ranked, problems: why } = baseFor(anchors, schemes)

    if (!ranked) {
      failed.push(...why)
      continue
    }

    const booru = anchors.booru
    const tagged = booru ? taggedIn(known, booru) : undefined
    const subject = tagged ?? (flags.work ? `${flags.work}/${anchors.name}` : undefined)

    if (tagged && flags.work && workIdOf(tagged) !== flags.work) {
      notes.push(`${anchors.name}: the commons holds ${booru} as ${tagged} — the palette names that`)
    }

    if (target?.builtin && subject === undefined) {
      failed.push({ path: anchors.name, problem: 'a built-in palette names its work — pass --work' })
      continue
    }

    const about = aboutOf(known, subject)
    const nativeNames = !subject ? undefined : about?.known ? about.character?.native : anchors.nativeNames

    if (subject && !about?.known) {
      const id = workIdOf(subject)
      const was = records.get(id)
      const commonsWork = workOf(commons.works, id)
      const title = commonsWork?.name ?? flags['work-name']
      const native = commonsWork?.native ?? flags['work-native']

      if (!was && !held(id) && title === undefined) {
        failed.push({ path: 'work-name', problem: `${id} is a new work — name it with --work-name` })
        continue
      }

      const character = characterIdOf(subject) as string

      const added = withCharacter(
        was?.work ?? held(id) ?? { id, name: title as string, ...(native ? { native } : {}), characters: [] },
        { id: character, ...(nativeNames ? { native: nativeNames } : {}), ...(booru ? { danbooru: booru } : {}) },
      )

      records.set(id, { work: added, characters: [...(was?.characters ?? []), character] })
    }

    const other = target?.builtin
      ? colorsOfTheme(
          mirrored({ ...ranked.shade, name: anchors.name, signatureSlots: anchors.slots.map(([s]) => s), waive: [] })
            .shade,
        )
      : undefined

    const work = subject ? (records.get(workIdOf(subject))?.work ?? aboutOf(known, subject)?.work) : undefined
    const source = target?.builtin && work ? `${ranked.name} + ${codenameIn(shipped, work)}` : ranked.name
    const name = target ? `${target.id}/${anchors.name}` : anchors.name
    const signatureSlots = anchors.slots.map(([slot]) => slot)

    const text = paletteToml({
      name,
      ...(subject ? { subject } : {}),
      ansiSource: source,
      signature: signatureSlots,
      ...colorsOfTheme(ranked.shade),
      ...(other ? { other } : {}),
    })

    const own = owned?.get(anchors.name)
    const file = target ? (own?.path ?? join(setsDir(target.dir), `${setNameOf(subject)}.toml`)) : ''
    const theme = { ...ranked.shade, name: anchors.name, signatureSlots, waive: [] }

    made.push({
      name,
      ...(subject ? { subject } : {}),
      file,
      changed: file === '' || own?.text !== text,
      written: false,
      ...(anchors.source ? { source: anchors.source } : {}),
      ...(nativeNames ? { nativeNames } : {}),
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

  const recorded: Recorded[] = [...records].map(([work, { work: record, characters }]) => {
    const file = target ? join(target.records, `${work}.toml`) : ''
    const text = workToml(record)

    return {
      work,
      characters,
      file,
      changed: file === '' || !existsSync(file) || readFileSync(file, 'utf8') !== text,
      written: false,
      text,
    }
  })

  let installed: string[] = []

  if (!dry && target) {
    for (const item of made.filter((m) => m.changed)) {
      item.file = writeOwnIn(target.dir, slugOf(item.name), item.text)
      item.written = true
    }

    for (const item of recorded.filter((r) => r.changed)) {
      writeAtomic(item.file, item.text)
      item.written = true
    }

    if (!target.builtin) {
      const home = configHome()
      installed = install(
        home,
        readMarketplaces(home),
        made.map((m) => m.name),
      ).fresh
    }
  }

  const changed = made.some((m) => m.changed) || recorded.some((r) => r.changed) || installed.length > 0
  const status = dry || changed ? 'done' : 'unchanged'

  if (flags.json) {
    emit({
      status,
      dryRun: dry,
      ...(target ? { marketplace: target.id } : {}),
      notes,
      palettes: made.map(({ text: _, ...m }) => ({ ...m, installed: installed.includes(m.name) })),
      works: recorded.map(({ text: _, ...r }) => r),
    })
  } else {
    console.log(madeLines(made, recorded, { dry, installed, notes, builtin: target?.builtin === true }).join('\n'))
  }

  return status === 'unchanged' ? EXIT.unchanged : EXIT.done
}

function wrote(item: { changed: boolean; written: boolean; file: string }): string {
  return `${item.changed ? (item.written ? 'wrote' : 'would write') : 'unchanged'}  ${item.file || '(no marketplace yet)'}`
}

function madeLines(
  made: Made[],
  recorded: Recorded[],
  { dry, installed, notes, builtin }: { dry: boolean; installed: string[]; notes: string[]; builtin: boolean },
): string[] {
  const lines = made.flatMap((m) => {
    const part = Math.max(0, ...m.signature.map((d) => d.part.length))

    return [
      `${m.name}${m.subject ? ` · ${m.subject}` : ''} · base ${m.base}`,
      ...m.signature.map(
        (d) =>
          `  ${d.slot.padEnd(10)} ${d.part.padEnd(part)}  ${d.measured} → ${d.final}  ΔE ${d.delta.toFixed(1)}${d.far || d.turned ? '  far from its anchor' : ''}`,
      ),
      ...m.turned.map((t) => `  turned     ${t.slot} ${t.from} → ${t.to}  ${t.rule}`),
      ...m.lookalikes.map((pair) => `  reads as one  ${pair}`),
      ...(m.gate.length > 0 ? m.gate.map((g) => `  contrast   ${g}`) : ['  contrast   clean']),
      `  ${wrote(m)}`,
    ]
  })

  return [
    ...notes.map((n) => `note: ${n}`),
    ...lines,
    ...recorded.flatMap((r) => [`${r.work} · ${r.characters.join(', ')}`, `  ${wrote(r)}`]),
    ...(installed.length > 0
      ? ['', `Installed ${installed.join(', ')} — \`ttheme use <name>\` uses one in a tab`]
      : []),
    ...(builtin && !dry ? ['', 'Next: mise run build, then mise run ci'] : []),
  ]
}
