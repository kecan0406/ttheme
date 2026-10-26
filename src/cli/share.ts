import { randomInt } from 'node:crypto'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import * as p from '@clack/prompts'
import { Cancelled } from '../core/cancelled.ts'
import { workToml } from '../core/commons.ts'
import { type Draft, paletteToml, readOwnText, shareLink } from '../core/draft.ts'
import type { Manifest, PaletteEntry } from '../core/manifest.ts'
import { shareCode } from '../core/own.ts'
import { readmeOf, repoFor } from '../core/scaffold.ts'
import { MARKETPLACE_FILE, publisherOf, slugOf, slugProblem } from '../core/theme.ts'
import { available, find, readBundled, readMarketplaces, untuned } from '../store/available.ts'
import { writeAtomic } from '../store/edits.ts'
import { readInstalled } from '../store/installed.ts'
import { type LocalMarketplace, localMarketplaces, marketplaceFiles, palettesDir } from '../store/local.ts'
import { configHome } from '../store/paths.ts'
import { REPO_NAME, readMarketplaceInfo, shownSource } from '../store/sources.ts'
import { readTone, tonedModes } from '../store/tone.ts'
import { colorless } from '../terminals/osc.ts'
import { pending, say } from '../tui/pending.ts'
import { qrModules, qrPicture, qrText } from '../tui/qr.ts'
import { interactive } from '../tui/terminal.ts'
import { draftFor } from './craft.ts'
import { pickPalettes } from './installs.ts'
import { newLocal } from './marketplaces.ts'
import {
  commitAll,
  createRepo,
  describeRepo,
  isPublic,
  proposalsFor,
  pushRepo,
  type Repo,
  remoteOf,
  repoExists,
  repoText,
  repoUrl,
  toolsProblem,
  unsaved,
  withDescription,
} from './publish.ts'

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

function listed(names: readonly string[]): string {
  return names.length <= 3 ? names.join(', ') : `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`
}

function tunedName(name: string): string {
  return `${slugOf(name)}-tuned`
}

function freeName(name: string, used: ReadonlySet<string>): string {
  let free = name

  for (let n = 2; used.has(free); n++) {
    free = `${name}-${n}`
  }

  return free
}

async function askTone(names: string[], renamed: boolean): Promise<Tone> {
  const [one] = names
  const single = names.length === 1 ? one : undefined

  return asked(
    await p.select({
      message: single ? `Share ${single} as…` : `${listed(names)} carry your tuning — share them as…`,
      options: [
        {
          value: 'tuned' as const,
          label: 'Your tuning',
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
  const installed = readInstalled(home).palettes

  const pairs = names.map((name) => {
    const original = find(view.palettes, name, installed)

    return { original, tuned: tonedModes(original, tones) }
  })

  const tunable = pairs.flatMap((pair) => (pair.tuned === pair.original ? [] : [pair.original.name]))

  const which =
    tunable.length === 0 ? 'original' : (tone ?? (interactive() ? await askTone(tunable, renamed) : 'tuned'))

  return pairs.map(({ original, tuned }) =>
    which === 'tuned' && tuned !== original ? { entry: tuned, tuned: true } : { entry: original, tuned: false },
  )
}

const CELL = /^([1-9]\d{0,3})x([1-9]\d{0,3})$/

function cellOf(env: NodeJS.ProcessEnv): { w: number; h: number } | undefined {
  const size = CELL.exec(env.TTHEME_CELL ?? '')

  return size && !colorless(env) && !env.TMUX ? { w: Number(size[1]), h: Number(size[2]) } : undefined
}

function showLink(link: string, note: (scanned: boolean) => string, smaller: string): void {
  console.log(link)

  if (!process.stdout.isTTY) {
    return
  }

  const modules = qrModules(link)
  const cols = process.stdout.columns || 80
  const rows = process.stdout.rows || 24
  const room = { cols, rows: rows - 4 }
  const cell = cellOf(process.env)
  const qr = modules && (cell ? qrPicture(modules, cell, room, randomInt(2 ** 24, 2 ** 30)) : qrText(modules))
  const fits = qr !== undefined && qr.cols <= room.cols && qr.rows <= room.rows

  if (qr && fits) {
    process.stdout.write(`\n${qr.out}`)
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
  const shared = [...new Map((await toned(home, manifest, names, tone, true)).map((s) => [s.entry.name, s])).values()]
  const used = new Set<string>()

  const drafts: Draft[] = shared.map(({ entry, tuned }) => {
    const draft = draftFor(home, entry)
    const name = tuned ? freeName(tunedName(entry.name), used) : draft.name
    const problem = tuned ? slugProblem(name) : undefined

    if (problem) {
      throw new Error(`${name} ${problem} — share the original, or tune a palette with a shorter name`)
    }

    used.add(name)

    return tuned ? { ...draft, name, from: entry.name } : draft
  })

  const [first] = drafts
  const many = drafts.length > 1
  const tuned = shared.flatMap((s, i) => (s.tuned ? [{ from: s.entry.name, as: drafts[i]?.name }] : []))
  const [tunedOne] = tuned
  showLink(
    shareLink(shareCode(drafts)),
    (scanned) =>
      `Anyone can open the link${scanned ? ' or scan the code' : ''} to see ${many ? `these ${drafts.length} palettes` : first?.name}, and ttheme add <link> installs ${many ? 'them' : 'it'}${
        tuned.length === 0
          ? ''
          : !many && tunedOne
            ? `\nIt carries your tuning as ${tunedOne.as}, made from ${tunedOne.from} — ttheme add puts it in the receiver's own marketplace`
            : "\nThe ones you tuned travel as <palette>-tuned — ttheme add puts them in the receiver's own marketplace"
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

  const picked = await pickPalettes(available(home, manifest, false), worn ? [worn] : [], 'palette', true, 'share')

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

async function copiesFor(
  home: string,
  manifest: Manifest,
  marketplace: LocalMarketplace,
  picked: readonly PaletteEntry[],
  kept: readonly PaletteEntry[],
  dropped: readonly PaletteEntry[],
  tone: Tone | undefined,
): Promise<Copy[]> {
  const files = new Set(marketplaceFiles(marketplace.dir).map((f) => f.slug))
  const keptBy = new Map(kept.map((e) => [slugOf(e.name), e]))
  const leaving = new Set(dropped.map((e) => slugOf(e.name)))
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
    const copy: Draft = { ...draftFor(home, entry), name: full, from: fromOf(entry) }
    readOwnText(full, paletteToml(copy))
    copies.push({ entry, slug, draft: copy, path: join(palettesDir(marketplace.dir), `${slug}.toml`), kind })
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

async function shareMarketplace(tone?: Tone): Promise<void> {
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
  const view = available(home, manifest, false)
  const all = view.palettes
  const own = all.filter((e) => publisherOf(e.name) === marketplace.id)

  const names = await pickPalettes(
    view,
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
    all.filter((e) => chosen.has(e.name) && publisherOf(e.name) !== marketplace.id),
    kept,
    dropped,
    tone,
  )

  const proposals = proposalsFor(view.works, readBundled(home).commons.works, marketplace.dir, [
    ...kept.map((entry) => entry.subject),
    ...copies.map((copy) => copy.draft.subject),
  ])

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
  const slugAt = new Map([...files].map(([slug, path]) => [path, slug]))
  const risk = await unsaved(marketplace.dir, drops)
  const slugs = (paths: string[]) => paths.map((path) => slugAt.get(path) ?? path).join(', ')

  const lost = [
    ...(risk.fresh.length > 0 ? [`git has no copy of ${slugs(risk.fresh)}`] : []),
    ...(risk.changed.length > 0
      ? [`${slugs(risk.changed)} changed since ${risk.changed.length === 1 ? 'it was' : 'they were'} last committed`]
      : []),
  ]

  const named = (kind: Copy['kind']) =>
    copies.filter((c) => c.kind === kind).map((c) => (kind === 'update' ? c.slug : `${c.slug} (from ${c.draft.from})`))

  const added = named('add')
  const updated = named('update')
  const replaced = named('replace')
  const removed = dropped.map((e) => slugOf(e.name))
  const works = proposals.map((proposal) => proposal.work.id)

  const lines = [
    `Repository   ${repoUrl(repo)} · ${open ? 'public' : 'private'}${remote ? '' : ' · new'}`,
    `Description  ${description ?? 'none'}`,
    ...(open ? ["Search       Browse's search lists it (topic ttheme-marketplace)"] : []),
    ...(added.length > 0 ? [`Add          ${added.join(', ')}`] : []),
    ...(updated.length > 0 ? [`Update       ${updated.join(', ')}`] : []),
    ...(replaced.length > 0 ? [`Replace      ${replaced.join(', ')}`] : []),
    ...(works.length > 0 ? [`Propose      ${works.join(', ')} — what the commons lacks of them, in works/`] : []),
    ...(removed.length > 0
      ? [
          `Remove       ${removed.join(', ')} — deleted from ${shownSource(marketplace.dir)}${lost.map((l) => `, and ${l}`).join('')}`,
        ]
      : []),
  ]

  const changes = copies.length + drops.length + proposals.length > 0 || description !== was

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
    writeAtomic(copy.path, paletteToml(copy.draft))
  }

  for (const proposal of proposals) {
    writeAtomic(proposal.path, workToml(proposal.work))
  }

  const after = withDescription(before, description)
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
        works.length > 0 ? `Propose ${listed(works)}` : '',
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
