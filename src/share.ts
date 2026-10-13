import { existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import * as p from '@clack/prompts'
import { available, readMarketplaces, untuned } from './available.ts'
import { Cancelled } from './cancelled.ts'
import { draftFor, named } from './craft.ts'
import { writeAtomic } from './edits.ts'
import { pickPalettes } from './installs.ts'
import type { Manifest, PaletteEntry } from './manifest.ts'
import { newLocal, readmeOf, repoFor } from './marketplaces.ts'
import {
  bundleCode,
  type Draft,
  type LocalMarketplace,
  localMarketplaces,
  marketplaceFiles,
  palettesDir,
  paletteToml,
  readOwnText,
  shareLink,
} from './own.ts'
import { configHome } from './palettes.ts'
import { pending, say } from './pending.ts'
import {
  commitAll,
  createRepo,
  describeRepo,
  isPublic,
  pushRepo,
  type Repo,
  remoteOf,
  repoExists,
  repoText,
  repoUrl,
  toolsProblem,
  withCatalogs,
  withDescription,
  withoutCatalogs,
} from './publish.ts'
import { qrCode } from './qr.ts'
import { localIdentity, REPO_NAME, readMarketplaceInfo, shownSource } from './sources.ts'
import { MARKETPLACE_FILE, marketplaceOf, nameProblem, slugOf } from './theme.ts'
import { readTone, tonedEntry } from './tone.ts'

export type Tone = 'tuned' | 'original'

interface Toned {
  entry: PaletteEntry
  tuned: boolean
}

function asked<T>(answer: T | typeof p.CANCEL_SYMBOL): T {
  if (p.isCancel(answer)) {
    p.cancel('Nothing changed')
    throw new Cancelled()
  }
  return answer as T
}

function tty(): boolean {
  return process.stdin.isTTY === true && process.stdout.isTTY === true
}

function listed(names: readonly string[]): string {
  return names.length <= 3 ? names.join(', ') : `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`
}

function tunedName(name: string): string {
  return `${name}-tuned`
}

async function askTone(names: string[], renamed: boolean): Promise<Tone> {
  const [one] = names
  const single = names.length === 1 ? one : undefined
  return asked(
    await p.select({
      message: single ? `Share ${single} as…` : `${listed(names)} carry your tone — share them as…`,
      options: [
        {
          value: 'tuned' as const,
          label: 'Your tone',
          ...(renamed ? { hint: `named ${single ? tunedName(single) : '<palette>-tuned'}` } : {}),
        },
        { value: 'original' as const, label: single ? 'The original' : 'The originals' },
      ],
    }),
  )
}

async function toned(
  home: string,
  manifest: Manifest,
  names: readonly string[],
  tone: Tone | undefined,
  renamed: boolean,
): Promise<Toned[]> {
  const view = untuned(home, manifest)
  const tones = readTone(home)
  const pairs = names.map((name) => {
    const original = named(view, name, home)
    return { original, tuned: tonedEntry(original, tones[original.name]) }
  })
  const tunable = pairs.filter((pair) => pair.tuned !== pair.original).map((pair) => pair.original.name)
  const which = tunable.length === 0 ? 'original' : (tone ?? (tty() ? await askTone(tunable, renamed) : 'tuned'))
  return pairs.map(({ original, tuned }) =>
    which === 'tuned' && tuned !== original ? { entry: tuned, tuned: true } : { entry: original, tuned: false },
  )
}

function showLink(link: string, note: (scanned: boolean) => string, smaller: string): void {
  console.log(link)
  if (!process.stdout.isTTY) {
    return
  }
  const qr = qrCode(link)
  const cols = process.stdout.columns || 80
  const rows = process.stdout.rows || 24
  const fits = qr !== undefined && qr.cols <= cols && qr.rows + 4 <= rows
  if (qr && fits) {
    console.log(`\n${qr.lines.join('\n')}`)
  }
  console.error(`\n${note(fits)}`)
  if (!qr) {
    console.error(`The link is too long for a QR code${smaller}`)
  } else if (!fits) {
    console.error(
      `The QR code needs ${qr.cols}×${qr.rows} cells and this window has ${cols}×${rows} — zoom out and share again${smaller}`,
    )
  }
}

export async function runShare(names: readonly string[], tone?: Tone): Promise<void> {
  const home = configHome()
  const manifest = readMarketplaces(home)
  const shared = await toned(home, manifest, names, tone, true)
  const drafts: Draft[] = shared.map(({ entry, tuned }) => {
    const draft = draftFor(home, entry)
    if (!tuned) {
      return draft
    }
    const name = tunedName(entry.name)
    const problem = nameProblem(name)
    if (problem) {
      throw new Error(`${name} ${problem} — share the original, or tune a palette with a shorter name`)
    }
    return { ...draft, name, from: entry.from ?? entry.name }
  })
  const [first] = drafts
  const many = drafts.length > 1
  const tuned = shared.filter((s) => s.tuned)
  const [tunedOne] = tuned
  showLink(
    shareLink(bundleCode(drafts)),
    (scanned) =>
      `Anyone can open the link${scanned ? ' or scan the code' : ''} to see ${many ? `these ${drafts.length} palettes` : first?.name}, and ttheme add <link> installs ${many ? 'them' : 'it'}${
        tuned.length === 0
          ? ''
          : !many && tunedOne
            ? `\nIt carries your tone, named ${tunedName(tunedOne.entry.name)} so it does not clash with ${tunedOne.entry.name}`
            : '\nThe ones with your tone are named <palette>-tuned, so they do not clash with the originals'
      }`,
    many ? ', or share them as a marketplace, whose link stays short' : '',
  )
}

export async function runShareAsked(tone?: Tone): Promise<void> {
  const how = asked(
    await p.select({
      message: 'Share how?',
      options: [
        {
          value: 'link' as const,
          label: 'A link',
          hint: 'the palettes travel inside it, and ttheme add <link> installs them',
        },
        {
          value: 'marketplace' as const,
          label: 'A marketplace on GitHub',
          hint: 'a repository anyone adds with ttheme marketplace add, updated each time you share it',
        },
      ],
    }),
  )
  if (how === 'marketplace') {
    return shareMarketplace(tone)
  }
  const home = configHome()
  const manifest = readMarketplaces(home)
  const worn = process.env.TTHEME_WORN
  const picked = await pickPalettes(
    { ...manifest, palettes: available(home, manifest, false).palettes },
    worn ? [worn] : [],
    'palette',
    true,
    'share',
  )
  if (!picked) {
    throw new Cancelled()
  }
  return runShare(picked, tone)
}

async function pickMarketplace(home: string): Promise<LocalMarketplace> {
  const locals = localMarketplaces(home)
  if (locals.length === 0) {
    return newLocal(home)
  }
  const remotes = await Promise.all(locals.map((m) => remoteOf(m.dir)))
  const choice = asked(
    await p.select({
      message: 'Which marketplace?',
      options: [
        ...locals.map((m, i) => {
          const remote = remotes[i]
          return {
            value: m.id,
            label: m.id,
            hint: remote && remote !== 'elsewhere' ? repoUrl(remote) : `${shownSource(m.dir)}, not on GitHub yet`,
          }
        }),
        { value: '', label: 'A new marketplace' },
      ],
    }),
  )
  return locals.find((m) => m.id === choice) ?? newLocal(home)
}

interface Copy {
  entry: PaletteEntry
  slug: string
  draft: Draft
  path: string
  kind: 'add' | 'update' | 'replace'
  replaces?: string
}

function slugProblem(slug: string): string | undefined {
  return nameProblem(slug) ? 'takes lowercase letters, digits and single hyphens, 40 at most' : undefined
}

async function settle(
  marketplace: LocalMarketplace,
  slug: string,
  replaceable: boolean,
  taken: (slug: string) => boolean,
): Promise<string | 'replace' | undefined> {
  const answer = asked(
    await p.select({
      message: `${marketplace.id} already has ${slug}`,
      options: [
        ...(replaceable ? [{ value: 'replace', label: `Replace ${slug}` }] : []),
        { value: 'rename', label: 'Give this copy another name' },
        { value: 'skip', label: 'Leave it out' },
      ],
    }),
  )
  if (answer === 'skip') {
    return undefined
  }
  if (answer === 'replace') {
    return 'replace'
  }
  return asked(
    await p.text({
      message: `Name the copy of ${slug}`,
      initialValue: `${slug}-2`,
      validate: (value) =>
        slugProblem(value ?? '') ?? (taken(value ?? '') ? `${marketplace.id} already has ${value}` : undefined),
    }),
  )
}

function fromOf(entry: PaletteEntry): string {
  return entry.from ?? entry.name
}

function baseOf(entry: PaletteEntry, official: ReadonlySet<string>): string | undefined {
  return official.has(entry.name) && !entry.default ? entry.name : entry.base
}

async function copiesFor(
  home: string,
  manifest: Manifest,
  marketplace: LocalMarketplace,
  picked: readonly PaletteEntry[],
  kept: readonly PaletteEntry[],
  dropped: readonly PaletteEntry[],
  tone: Tone | undefined,
): Promise<Copy[]> {
  const files = new Map(marketplaceFiles(marketplace.dir).map((f) => [f.slug, f.path]))
  const keptBy = new Map(kept.map((e) => [slugOf(e.name), e]))
  const leaving = new Set(dropped.map((e) => slugOf(e.name)))
  const catalogs = localIdentity(marketplace.dir).catalogs
  const official = new Set(manifest.palettes.filter((e) => !marketplaceOf(e.name)).map((e) => e.name))
  const copies: Copy[] = []
  const used = new Set<string>()
  const taken = (slug: string) => used.has(slug) || keptBy.has(slug) || (files.has(slug) && !leaving.has(slug))
  const shared = await toned(
    home,
    manifest,
    picked.map((e) => e.name),
    tone,
    false,
  )
  for (const { entry } of shared) {
    let slug: string | undefined = slugOf(entry.name)
    let kind: Copy['kind'] = keptBy.get(slug)?.from === fromOf(entry) && !used.has(slug) ? 'update' : 'add'
    if (kind === 'add' && taken(slug)) {
      const answer = await settle(marketplace, slug, !used.has(slug), taken)
      if (answer === 'replace') {
        kind = 'replace'
      } else {
        slug = answer
      }
    }
    if (slug === undefined) {
      continue
    }
    used.add(slug)
    keptBy.delete(slug)
    const full = `${marketplace.id}/${slug}`
    const base = baseOf(entry, official)
    const { base: _, ...draft } = draftFor(home, entry)
    const copy: Draft = { ...draft, name: full, from: fromOf(entry), ...(base ? { base } : {}) }
    readOwnText(
      full,
      paletteToml(copy),
      manifest.palettes,
      false,
      entry.catalog ? { catalog: entry.catalog, catalogs } : {},
    )
    const path = join(palettesDir(marketplace.dir), ...(entry.catalog ? [entry.catalog] : []), `${slug}.toml`)
    const replaces = kind === 'add' ? undefined : files.get(slug)
    copies.push({ entry, slug, draft: copy, path, kind, ...(replaces ? { replaces } : {}) })
  }
  return copies
}

async function askRepo(marketplace: LocalMarketplace): Promise<Repo> {
  for (;;) {
    const name = asked(
      await p.text({
        message: `Repository name — github.com/${marketplace.owner}/…`,
        initialValue: repoFor(marketplace),
        validate: (value) =>
          REPO_NAME.test(value ?? '') && value !== '.' && value !== '..'
            ? undefined
            : 'takes letters, digits, hyphens, dots and underscores, 100 at most',
      }),
    )
    const repo = { owner: marketplace.owner, name }
    const looking = pending(`Looking for ${repoText(repo)} on GitHub`)
    const exists = await repoExists(repo)
    looking.done()
    if (!exists) {
      return repo
    }
    p.log.warn(`${repoUrl(repo)} already exists — pick another name`)
  }
}

async function askDescription(current: string | undefined): Promise<string | undefined> {
  const typed = asked(
    await p.text({
      message: 'Description — one line Browse and the site show, optional',
      ...(current ? { initialValue: current } : {}),
      placeholder: 'Leave it empty for none',
      validate: (value) =>
        /\p{Cc}/u.test(value ?? '') || (value ?? '').length > 200
          ? 'one line of text, 200 characters at most'
          : undefined,
    }),
  )
  const text = (typed ?? '').trim()
  return text === '' ? undefined : text
}

function emptied(dir: string, paths: readonly string[]): Set<string> {
  const shelves = new Set<string>()
  for (const path of paths) {
    const folder = dirname(path)
    if (folder !== palettesDir(dir) && existsSync(folder) && readdirSync(folder).length === 0) {
      rmdirSync(folder)
      shelves.add(folder.slice(palettesDir(dir).length + 1))
    }
  }
  return shelves
}

export async function shareMarketplace(tone?: Tone): Promise<void> {
  const problem = await toolsProblem()
  if (problem) {
    throw new Error(problem)
  }
  const home = configHome()
  const marketplace = await pickMarketplace(home)
  const remote = await remoteOf(marketplace.dir)
  if (remote === 'elsewhere') {
    throw new Error(`${shownSource(marketplace.dir)} pushes to a remote that is not on GitHub — sharing needs GitHub`)
  }
  const manifest = readMarketplaces(home)
  const all = available(home, manifest, false).palettes
  const own = all.filter((e) => marketplaceOf(e.name) === marketplace.id)
  const names = await pickPalettes(
    { ...manifest, palettes: all },
    own.map((e) => e.name),
    'palette',
    true,
    'continue',
  )
  if (!names) {
    throw new Cancelled()
  }
  const chosen = new Set(names)
  const kept = own.filter((e) => chosen.has(e.name))
  const dropped = own.filter((e) => !chosen.has(e.name))
  const copies = await copiesFor(
    home,
    manifest,
    marketplace,
    all.filter((e) => chosen.has(e.name) && marketplaceOf(e.name) !== marketplace.id),
    kept,
    dropped,
    tone,
  )
  const repo = remote ?? (await askRepo(marketplace))
  const open = remote
    ? await isPublic(remote)
    : asked(
        await p.select({
          message: 'Who can see it?',
          options: [
            { value: true, label: 'Anyone', hint: "anyone can add it, and Browse's search lists it" },
            { value: false, label: 'Only you', hint: 'a private repository nobody else can add' },
          ],
        }),
      )
  const tomlPath = join(marketplace.dir, MARKETPLACE_FILE)
  const before = readFileSync(tomlPath, 'utf8')
  const was = readMarketplaceInfo(before, tomlPath).description
  const description = await askDescription(was)

  const files = new Map(marketplaceFiles(marketplace.dir).map((f) => [f.slug, f.path]))
  const drops = dropped.flatMap((e) => files.get(slugOf(e.name)) ?? [])
  const tracked = existsSync(join(marketplace.dir, '.git'))
  const named = (kind: Copy['kind']) =>
    copies
      .filter((c) => c.kind === kind)
      .map((c) => (c.draft.from === c.slug || kind === 'update' ? c.slug : `${c.slug} (from ${c.draft.from})`))
  const added = named('add')
  const updated = named('update')
  const replaced = named('replace')
  const removed = dropped.map((e) => slugOf(e.name))
  const lines = [
    `Repository   ${repoUrl(repo)} · ${open ? 'public' : 'private'}${remote ? '' : ' · new'}`,
    `Description  ${description ?? 'none'}`,
    ...(open ? ["Search       Browse's search lists it (topic ttheme-marketplace)"] : []),
    ...(added.length > 0 ? [`Add          ${added.join(', ')}`] : []),
    ...(updated.length > 0 ? [`Update       ${updated.join(', ')}`] : []),
    ...(replaced.length > 0 ? [`Replace      ${replaced.join(', ')}`] : []),
    ...(removed.length > 0
      ? [
          `Remove       ${removed.join(', ')} — deleted from ${shownSource(marketplace.dir)}${tracked ? '' : ', and git has no copy of it yet'}`,
        ]
      : []),
  ]
  const changes = copies.length + drops.length > 0 || description !== was
  if (changes || !remote) {
    p.note(lines.join('\n'), `Share ${marketplace.id}`)
    const go = asked(
      await p.confirm({
        message: remote ? 'Push to GitHub?' : 'Create it on GitHub?',
        initialValue: drops.length === 0,
      }),
    )
    if (!go) {
      p.cancel('Nothing changed')
      throw new Cancelled()
    }
  }

  for (const path of drops) {
    rmSync(path)
  }
  for (const copy of copies) {
    if (copy.replaces && copy.replaces !== copy.path) {
      rmSync(copy.replaces)
    }
    mkdirSync(dirname(copy.path), { recursive: true })
    writeAtomic(copy.path, paletteToml(copy.draft))
  }
  const gone = emptied(marketplace.dir, [...drops, ...copies.flatMap((c) => c.replaces ?? [])])
  const shelves = new Set(localIdentity(marketplace.dir).catalogs.map((c) => c.name))
  const fresh = new Map(
    copies.flatMap((c) =>
      c.entry.catalog && c.entry.native && !shelves.has(c.entry.catalog)
        ? [[c.entry.catalog, { name: c.entry.catalog, native: c.entry.native }] as const]
        : [],
    ),
  )
  const after = withCatalogs(withoutCatalogs(withDescription(before, description), gone), [...fresh.values()])
  readMarketplaceInfo(after, tomlPath)
  if (after !== before) {
    writeAtomic(tomlPath, after)
  }
  const readme = join(marketplace.dir, 'README.md')
  if (!remote && repo.name !== repoFor(marketplace) && existsSync(readme)) {
    if (readFileSync(readme, 'utf8') === readmeOf(marketplace)) {
      writeAtomic(readme, readmeOf(marketplace, repo.name))
    }
  }

  if (changes || !remote) {
    const step = pending(`Pushing ${repoText(repo)}`)
    try {
      const slugs = (kind: Copy['kind']) => copies.filter((c) => c.kind === kind).map((c) => c.slug)
      const message = [
        slugs('add').length > 0 ? `Add ${listed(slugs('add'))}` : '',
        [...slugs('update'), ...slugs('replace')].length > 0
          ? `Update ${listed([...slugs('update'), ...slugs('replace')])}`
          : '',
        removed.length > 0 ? `Remove ${listed(removed)}` : '',
      ]
        .filter(Boolean)
        .join('; ')
      await commitAll(marketplace.dir, message || `Share ${marketplace.id}`)
      if (remote) {
        await pushRepo(marketplace.dir)
      } else {
        await createRepo(marketplace.dir, repo, open, description)
      }
      await describeRepo(repo, description, open)
    } finally {
      step.done()
    }
    say(`Shared ${marketplace.id} · ${repoUrl(repo)}`)
  }
  showLink(
    repoUrl(repo),
    (scanned) =>
      `Anyone can open the link${scanned ? ' or scan the code' : ''}, and ttheme marketplace add ${repoText(repo)} adds it${open ? " — Browse's search lists it within the hour" : '\nIt is private, so only you can add it'}`,
    '',
  )
}
