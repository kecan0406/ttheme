import { createHash } from 'node:crypto'
import { appendFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { availableParallelism } from 'node:os'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { colorless } from '../../src/osc.ts'
import { pending } from '../../src/pending.ts'
import {
  type Column,
  cellValue,
  explained,
  type Facts,
  type Gap,
  glob,
  journeyOrder,
  KINDS,
  lacking,
  merged,
  owed,
  readCompat,
  readGaps,
  readTable,
  SPEC,
  specOf,
  type Table,
  tableOf,
  unmeasured,
  writeTable,
} from './facts.ts'
import { build, cli, type Fixture, PICTURED, reap, restore, shims, workDir } from './home.ts'
import { JOURNEYS, type Journey, type Probe, type Want } from './journeys.ts'
import { App, type Look, type Tab } from './model.ts'
import { CAPABILITIES, type Capability, REFERENCE, TERMS, type Term } from './terms.ts'

const REPO = join(import.meta.dirname, '..', '..')

const { values } = parseArgs({
  options: {
    update: { type: 'boolean', default: false },
    only: { type: 'string', multiple: true },
    journey: { type: 'string', multiple: true },
    keep: { type: 'boolean', default: false },
    verbose: { type: 'boolean', short: 'v', default: false },
    show: { type: 'string', multiple: true },
    slots: { type: 'string', default: String(availableParallelism() >= 8 ? 3 : 2) },
  },
})

const split = (list: string[] | undefined) => list?.flatMap((item) => item.split(',')).filter(Boolean)

const terms = (split(values.only) ?? [...TERMS]) as Term[]
const journeys = (() => {
  const ids = split(values.journey)
  return ids ? JOURNEYS.filter((j) => ids.includes(j.id)) : JOURNEYS
})()

for (const term of terms) {
  if (!TERMS.includes(term)) {
    console.error(`unknown terminal ${term} — one of ${TERMS.join(', ')}`)
    process.exit(2)
  }
}
if (journeys.length === 0) {
  console.error(`no journey named ${values.journey} — one of ${JOURNEYS.map((j) => j.id).join(', ')}`)
  process.exit(2)
}

journeyOrder(JOURNEYS.map((j) => j.id))

const screens = new Map<string, string>()
const shows = split(values.show) ?? []
const journals = new Map<string, string[]>()
const wanted: Facts = {}
const needs = new Map<string, readonly Capability[]>()

const live = Boolean(process.stdout.isTTY) && process.env.TERM !== 'dumb'
const line = pending()
const clock = performance.now()
const progress = { phase: '', done: 0, total: 0, latest: '' }
const running = new Set<string>()

function seconds(since = clock): string {
  return `${((performance.now() - since) / 1000).toFixed(1)}s`
}

function describe(): string {
  const { phase, done, total, latest } = progress
  const detail = total - done <= 3 && running.size > 0 ? `waiting on ${[...running].join(', ')}` : latest
  return `${phase} ${done}/${total}${detail ? ` · ${detail}` : ''} · ${seconds()}`
}

function begin(phase: string, total: number): void {
  Object.assign(progress, { phase, done: 0, total, latest: '' })
  if (live) {
    line.set(describe())
  } else {
    console.log(describe().toLowerCase())
  }
}

function step(latest: string): void {
  progress.done++
  progress.latest = latest
  if (live) {
    line.set(describe())
  }
}

const beat = setInterval(
  () => {
    if (live) {
      line.set(describe())
    } else if (progress.done < progress.total) {
      console.log(describe().toLowerCase())
    }
  },
  live ? 1000 : 10000,
)
beat.unref()

function normalized(text: string): string {
  return text
    .split('\n')
    .map((line) =>
      line.replace(/Search….*?\s{2,}(?=\d+\/\d+)/, 'Search… ‹hint›  ').replace(/Search… e\.g\..*$/, 'Search… ‹hint›'),
    )
    .join('\n')
}

function digest(text: string): string {
  return `txt:${createHash('sha1').update(text).digest('hex').slice(0, 10)}`
}

function issues(seen: Look, wears: string | undefined, text: string): string {
  const out: string[] = []
  if (wears !== undefined && !seen.colors.includes(':') && wears !== (seen.colors === 'own' ? 'none' : seen.colors)) {
    out.push('wears')
  }
  if (text.includes('^[')) {
    out.push('echo')
  }
  return out.length > 0 ? out.join(',') : '-'
}

function expected({ want, picture, opacity }: Want) {
  return {
    colors: want,
    wears: want === 'own' ? 'none' : want,
    picture: picture ?? (PICTURED.includes(want) ? want : 'none'),
    opacity,
  }
}

function probe(app: App, fixture: Fixture, journey: Journey, facts: Facts, extra: App[]): Probe {
  const marks = new Map<Tab, number>()
  const put = (label: string, key: string, value: string, want?: string, depends: readonly Capability[] = []) => {
    const id = `${journey.id}.${label}.${key}`
    facts[id] = value
    if (want !== undefined) {
      wanted[id] = want
    }
    if (depends.length > 0) {
      needs.set(id, depends)
    }
  }
  return {
    open: () => app.open(),
    type: (tab, line) => app.type(tab, line),
    async launch(tab, line, marker) {
      marks.set(tab, tab.prompts())
      tab.write(`${line}\r`)
      await app.until(
        () =>
          tab.pending === 0 &&
          (marker ? tab.screen(fixture.place.home).includes(marker) : tab.xterm.buffer.active.type === 'alternate'),
        15000,
        `${line} never took the screen`,
      )
      await app.settle()
    },
    keys: (tab, ...keys) => app.keys(tab, keys),
    async expect(tab, marker) {
      await app.until(() => tab.screen(fixture.place.home).includes(marker), 15000, `${marker} never showed`)
      await app.settle()
    },
    async back(tab) {
      const mark = marks.get(tab) ?? 0
      await app.until(
        () => tab.xterm.buffer.active.type === 'normal' && tab.prompts() > mark,
        15000,
        'the TUI never gave the prompt back',
      )
      await app.settle()
    },
    async quit(tab) {
      const mark = marks.get(tab) ?? 0
      const home = () => tab.xterm.buffer.active.type === 'normal' && tab.prompts() > mark && tab.pending === 0
      for (let i = 0; i < 8 && !home(); i++) {
        tab.write('\x1b')
        await Bun.sleep(300)
      }
      await app.until(home, 10000, 'the TUI never gave the prompt back')
      await app.settle()
    },
    focus: (tab) => app.focus(tab),
    async look(label, options) {
      const tab = app.front
      if (!tab) {
        throw new Error(`look ${label}: no tab`)
      }
      const seen = app.look(tab)
      const want = expected(options)
      const fresh: Capability[] = options.unpainted ? ['wired'] : []
      put(label, 'colors', seen.colors, want.colors, fresh)
      put(label, 'picture', seen.picture, want.picture, ['pictures', ...fresh])
      let wears: string | undefined
      if (options.wears !== false && !options.busy) {
        wears = await app.wears(tab)
        put(label, 'wears', wears, want.wears, fresh)
      }
      if (options.repaints !== undefined) {
        put(label, 'repaints', String(tab.bgs.length - 1), String(options.repaints))
      }
      if (want.opacity !== undefined) {
        put(label, 'opacity', seen.opacity, want.opacity, ['pictures'])
      }
      let text: string | undefined
      if (options.text) {
        text = normalized(tab.screen(fixture.place.home))
        put(label, 'text', digest(text), undefined, [...fresh, ...(options.text === true ? [] : [options.text])])
        screens.set(`${app.term} ${journey.id}.${label}`, text)
      }
      if (shows.some((pattern) => glob(pattern, `${journey.id}.${label}`))) {
        line.say(
          `--- ${app.term} ${journey.id}.${label}\n${tab.screen(fixture.place.home)}\n--- journal: ${app.journal.join(' · ')}`,
        )
      }
      put(label, 'issue', issues(seen, wears, text ?? tab.screen(fixture.place.home)), '-')
    },
    config(line) {
      appendFileSync(join(fixture.place.configHome, 'ttheme', 'config.zsh'), `${line}\n`)
    },
    async wire(terminal) {
      const installed = join(fixture.place.configHome, 'ttheme', 'installed.json')
      const state = JSON.parse(readFileSync(installed, 'utf8'))
      if (!state.terminals.includes(terminal)) {
        state.terminals.push(terminal)
        writeFileSync(installed, `${JSON.stringify(state, null, 2)}\n`)
        await cli(fixture.place, 'default', state.startup)
      }
      const other = fixture.term === terminal ? app : new App(terminal, fixture.place)
      if (other !== app) {
        extra.push(other)
      }
      return {
        open: () => other.open(),
        type: (tab, line) => other.type(tab, line),
        async look(label, options) {
          const tab = other.front
          if (!tab) {
            throw new Error(`look ${label}: no ${terminal} tab`)
          }
          const seen = other.look(tab)
          const want = expected(options)
          put(label, 'colors', seen.colors, want.colors)
          put(label, 'picture', seen.picture, want.picture)
          put(label, 'wears', await other.wears(tab), want.wears)
          if (want.opacity !== undefined) {
            put(label, 'opacity', seen.opacity, want.opacity, ['pictures'])
          }
        },
      }
    },
    pin(dir, palette) {
      mkdirSync(join(fixture.place.home, dir), { recursive: true })
      writeFileSync(join(fixture.place.configHome, 'ttheme', 'pins'), `~/${dir}/**  ${palette}\n`)
    },
    pinHost(host, palette) {
      writeFileSync(join(fixture.place.configHome, 'ttheme', 'pins'), `ssh:${host}  ${palette}\n`)
    },
  }
}

async function walk(fixture: Fixture, journey: Journey): Promise<Facts> {
  const name = `${fixture.term} ${journey.id}`
  running.add(name)
  await restore(fixture)
  const facts: Facts = {}
  const app = new App(fixture.term, fixture.place)
  const extra: App[] = []
  try {
    await journey.run(probe(app, fixture, journey, facts, extra))
  } catch (error) {
    facts[`${journey.id}.error`] = (error instanceof Error ? error.message : String(error)).split('\n')[0] ?? 'error'
    if (values.verbose) {
      line.say(`${fixture.term} ${journey.id}: ${error instanceof Error ? error.message : error}`)
    }
  } finally {
    await app.close()
    for (const other of extra) {
      await other.close()
    }
    await reap(fixture.place)
    journals.set(name, app.journal)
    running.delete(name)
  }
  return facts
}

async function pool<T, R>(items: readonly T[], limit: number, each: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const at = next++
        out[at] = await each(items[at] as T)
      }
    }),
  )
  return out
}

interface Lane {
  term: Term
  wired: Fixture
  unwired?: Fixture
}

function fixtureFor(lane: Lane, journey: Journey): Fixture {
  return journey.unwired ? (lane.unwired ?? lane.wired) : lane.wired
}

const MARK = { same: '✓', lacks: '○', gap: '·', changed: '!', broken: '✗' } as const

type Mark = keyof typeof MARK

const RANK: readonly Mark[] = ['same', 'lacks', 'gap', 'changed', 'broken']

const TINT: Record<Mark, string> = { same: '32', lacks: '32', gap: '2', changed: '33', broken: '31' }

const SHORT: Partial<Record<Term, string>> = {
  alacritty: 'alac',
  'windows-terminal': 'wt',
  konsole: 'kons',
  'terminal-app': 'tapp',
}

const colors = {
  out: live && !colorless(),
  err: Boolean(process.stderr.isTTY) && process.env.TERM !== 'dumb' && !colorless(),
}

function tint(code: string, text: string, to: keyof typeof colors = 'out'): string {
  return colors[to] && code && text ? `\x1b[${code}m${text}\x1b[0m` : text
}

function columns(rows: string[][]): number[] {
  return (rows[0] ?? []).map((_, at) => Math.max(...rows.map((row) => (row[at] ?? '').length)) + 2)
}

interface Change {
  column: Column
  id: string
  before: string
  cell: string
}

interface Unexplained {
  term: Term
  id: string
  value: string
  spec: string
}

function section(title: string, code: string, rows: string[][]): void {
  if (rows.length === 0) {
    return
  }
  const widths = columns(rows)
  console.error(`\n${tint(code, title, 'err')}`)
  for (const row of rows) {
    console.error(`  ${row.map((cell, at) => (at < row.length - 1 ? cell.padEnd(widths[at] ?? 0) : cell)).join('')}`)
  }
}

function report(fresh: Table, old: Table): boolean {
  const gaps = readGaps()
  const used = new Set<Gap>()
  const changed: Change[] = []
  const unexplained: Unexplained[] = []
  const notes: string[] = []
  const status = new Map<string, Mark>()
  const counts = new Map<string, number>()
  const worse = (key: string, mark: Mark) => {
    if (RANK.indexOf(mark) > RANK.indexOf(status.get(key) ?? 'same')) {
      status.set(key, mark)
    }
  }
  const count = (term: Term, label: string) => {
    counts.set(`${term}\t${label}`, (counts.get(`${term}\t${label}`) ?? 0) + 1)
  }
  for (const id of fresh.keys()) {
    const journey = id.split('.')[0] ?? ''
    const spec = specOf(fresh, id)
    const known = old.get(id)
    if (known !== undefined && specOf(old, id) !== spec) {
      changed.push({ column: SPEC, id, before: specOf(old, id), cell: spec })
      for (const term of terms) {
        worse(`${journey} ${term}`, 'changed')
      }
    }
    for (const term of terms) {
      const value = cellValue(fresh, id, term)
      const key = `${journey} ${term}`
      const before = known ? cellValue(old, id, term) : old.size > 0 ? '(new)' : undefined
      if (before !== undefined && before !== value) {
        worse(key, 'changed')
        changed.push({ column: term, id, before, cell: value })
      }
      if (!owed(fresh, id, term)) {
        continue
      }
      const gap = explained(gaps, term, id, needs.get(id) ?? [])
      if (!gap) {
        worse(key, 'broken')
        unexplained.push({ term, id, value, spec })
        continue
      }
      used.add(gap)
      const capability = lacking(gap)
      worse(key, capability ? 'lacks' : 'gap')
      count(term, capability ? `@${capability}` : gap.kind)
      notes.push(`${term} ${id}: ${value} (spec ${spec}) — ${capability ? `@${capability}` : gap.kind}: ${gap.reason}`)
    }
  }
  const complete = journeys.length === JOURNEYS.length
  const walked = (id: string) => journeys.some((journey) => journey.id === id.split('.')[0])
  const ids = [...new Set([...fresh.keys(), ...old.keys()])]
  const wide: string[][] = []
  const stale: Gap[] = []
  for (const gap of gaps.filter((g) => terms.includes(g.term))) {
    if (lacking(gap)) {
      if (complete && !used.has(gap)) {
        stale.push(gap)
      }
      continue
    }
    const covered = ids.filter((id) => glob(gap.fact, id))
    const idle = covered.filter(
      (id) =>
        fresh.has(id) && !(owed(fresh, id, gap.term) && explained(gaps, gap.term, id, needs.get(id) ?? []) === gap),
    )
    if (!used.has(gap) && covered.every(walked)) {
      stale.push(gap)
    } else if (idle.length > 0) {
      wide.push([
        gap.term,
        gap.fact,
        `${idle.slice(0, 3).join(' ')}${idle.length > 3 ? ` and ${idle.length - 3} more` : ''}`,
      ])
    }
  }
  const meets = (term: Term, journey: Journey) => RANK.indexOf(status.get(`${journey.id} ${term}`) ?? 'same') <= 1
  const labels = [...Object.keys(CAPABILITIES).map((capability) => `@${capability}`), ...KINDS]
  const lead = Math.max(...journeys.map((j) => j.id.length), ...labels.map((label) => label.length)) + 2
  const room = live ? process.stdout.columns || Number.POSITIVE_INFINITY : Number.POSITIVE_INFINITY
  const spaced = (names: string[], gap: number) => names.map((name) => Math.max(name.length, 5) + gap)
  const roomy = spaced(terms, 2)
  const wideOut = lead + roomy.reduce((sum, width) => sum + width, 0) <= room
  const names = wideOut ? [...terms] : terms.map((term) => SHORT[term] ?? term)
  const widths = wideOut ? roomy : spaced(names, 1)
  const row = (head: string, cells: [string, string][], code = '') =>
    `${tint(code, head.padEnd(lead))}${cells.map(([text, tone], at) => `${tint(tone, text)}${' '.repeat(Math.max(0, (widths[at] ?? 0) - text.length))}`).join('')}`.trimEnd()
  console.log(
    row(
      'journey',
      names.map((name) => [name, '1'] as [string, string]),
      '1',
    ),
  )
  for (const journey of journeys) {
    console.log(
      row(
        journey.id,
        terms.map((term) => {
          const mark = status.get(`${journey.id} ${term}`) ?? 'same'
          return [MARK[mark], TINT[mark]] as [string, string]
        }),
      ),
    )
  }
  console.log(tint('2', '─'.repeat(lead + widths.reduce((sum, width) => sum + width, 0))))
  console.log(
    row(
      'meets',
      terms.map((term) => {
        const n = journeys.filter((journey) => meets(term, journey)).length
        return [`${n}/${journeys.length}`, n === journeys.length ? TINT.same : ''] as [string, string]
      }),
    ),
  )
  for (const label of labels) {
    console.log(
      row(
        label,
        terms.map((term) => {
          const n = counts.get(`${term}\t${label}`) ?? 0
          return [n ? String(n) : '', label === 'layer' ? TINT.changed : TINT.gap] as [string, string]
        }),
      ),
    )
  }
  const everywhere = journeys.filter((journey) => terms.every((term) => meets(term, journey)))
  const whole = everywhere.filter((journey) =>
    terms.every((term) => (status.get(`${journey.id} ${term}`) ?? 'same') === 'same'),
  )
  console.log(
    `\n${everywhere.length}/${journeys.length} journeys meet the spec in every terminal${terms.length < TERMS.length ? ' walked' : ''}, ${whole.length} with nothing missing`,
  )
  const short = terms.filter((term, at) => names[at] !== term)
  console.log(
    tint(
      '2',
      [
        `\n${MARK.same} meets the spec  ${MARK.lacks} meets it but for a capability the terminal lacks  ${MARK.gap} explained in gaps.tsv  ${MARK.changed} a fact changed  ${MARK.broken} unexplained`,
        'meets: journeys ✓ or ○; @capability: facts a capability the terminal lacks explains; cannot, layer, deferred: facts gaps.tsv explains',
        '  cannot    the terminal cannot express it',
        '  layer     ttheme could close it',
        '  deferred  left out on purpose',
        `the spec: what each look in journeys.ts says the tab shows; a screen is ${REFERENCE}'s, approved with --update`,
        ...(short.length > 0 ? [short.map((term) => `${SHORT[term]} ${term}`).join(' · ')] : []),
      ].join('\n'),
    ),
  )
  const compat = readCompat()
  const open = terms.flatMap((term): [string, string[]][] => {
    const cases = unmeasured(compat, term)
    if (cases === undefined) {
      return [[term, ['every case — the model follows its source']]]
    }
    return cases.length > 0 ? [[term, cases]] : []
  })
  if (open.length > 0) {
    const width = Math.max(...open.map(([term]) => term.length)) + 2
    console.log('\nthe model assumes these, since mise run compat left them ? or skip:')
    for (const [term, cases] of open) {
      const lines = cases.reduce<string[]>((out, id) => {
        const last = out.at(-1)
        if (last !== undefined && 2 + width + last.length + 1 + id.length <= room) {
          out[out.length - 1] = `${last} ${id}`
        } else {
          out.push(id)
        }
        return out
      }, [])
      lines.forEach((text, at) => {
        console.log(`  ${(at === 0 ? term : '').padEnd(width)}${text}`)
      })
    }
  }
  if (values.verbose) {
    console.log('')
    for (const note of notes) {
      console.log(`  ${note}`)
    }
  }
  section(
    'changed facts — mise run parity --update records them once they are right',
    TINT.changed,
    changed.map(({ column, id, before, cell }) => [column, id, `${before} → ${cell}`]),
  )
  section(
    'unexplained — fix each, or give it a reason in tests/parity/gaps.tsv',
    TINT.broken,
    unexplained.map(({ term, id, value, spec }) => [term, id, `${value}, spec ${spec}`]),
  )
  section('loose gaps — narrow each in tests/parity/gaps.tsv to the facts it explains', TINT.changed, wide)
  section(
    'stale gaps — remove them from tests/parity/gaps.tsv, they explain nothing now',
    TINT.changed,
    stale.map((gap) => [gap.term, gap.fact]),
  )
  for (const { column, id } of [...changed, ...unexplained.map(({ term, id }) => ({ column: term, id }))]) {
    const match = /^([\w-]+)\.([\w-]+)\.text$/.exec(id)
    if (column === SPEC || !match) {
      continue
    }
    const [, journey, label] = match
    const mine = screens.get(`${column} ${journey}.${label}`)
    const theirs = screens.get(`${REFERENCE} ${journey}.${label}`)
    if (mine !== undefined) {
      console.error(
        `${column === REFERENCE ? '' : `\n--- spec (${REFERENCE}) ${journey}.${label}\n${theirs ?? '(not run)'}`}\n--- ${column} ${journey}.${label}\n${mine}`,
      )
    }
  }
  const ok = changed.length + unexplained.length + wide.length + stale.length === 0
  if (!ok && values.verbose) {
    for (const [key, journal] of journals) {
      if (journal.length > 0) {
        console.error(`${key}: ${journal.join(' · ')}`)
      }
    }
  }
  return ok
}

async function main(): Promise<void> {
  const work = workDir()
  try {
    const bin = shims(work)
    const started = performance.now()
    const slots = Math.max(1, Math.min(Number(values.slots), journeys.length))
    const bare = journeys.some((journey) => journey.unwired)
    const built = async (term: Term, slot: string, wiring: boolean) => {
      const fixture = await build(term, work, bin, REPO, slot, wiring)
      step(term)
      return fixture
    }
    begin('Building fixture homes', terms.length * (slots + (bare ? 1 : 0)))
    const lanes = await Promise.all(
      terms.flatMap((term) =>
        Array.from({ length: slots }, async (_, slot): Promise<Lane> => {
          const [wired, unwired] = await Promise.all([
            built(term, String(slot), true),
            bare && slot === 0 ? built(term, 'bare', false) : undefined,
          ])
          return { term, wired, ...(unwired ? { unwired } : {}) }
        }),
      ),
    )
    const walkable = (lane: Lane, journey: Journey) => !journey.unwired || lane.unwired !== undefined
    const results = new Map<Term, Facts>(terms.map((term) => [term, {}]))
    const queues = new Map<Term, Journey[]>(terms.map((term) => [term, [...journeys]]))
    begin('Walking journeys', terms.length * journeys.length)
    await pool(lanes, Math.max(lanes.length, availableParallelism()), async (lane) => {
      const queue = queues.get(lane.term) ?? []
      for (
        let at = queue.findIndex((j) => walkable(lane, j));
        at >= 0;
        at = queue.findIndex((j) => walkable(lane, j))
      ) {
        const [journey] = queue.splice(at, 1) as [Journey]
        Object.assign(results.get(lane.term) ?? {}, await walk(fixtureFor(lane, journey), journey))
        step(`${lane.term} ${journey.id}`)
      }
    })
    const old = readTable()
    const gaps = readGaps()
    const moves = (term: Term, journey: Journey) => {
      const facts = results.get(term) ?? {}
      const ids = [...new Set([...Object.keys(facts), ...old.keys()])].filter((id) => id.split('.')[0] === journey.id)
      const astray = (seen: Facts, id: string) =>
        wanted[id] !== undefined &&
        (seen[id] ?? '-') !== wanted[id] &&
        explained(gaps, term, id, needs.get(id) ?? []) === undefined
      return {
        ids,
        moved: (seen: Facts) =>
          ids.some((id) => (old.has(id) && (seen[id] ?? '-') !== cellValue(old, id, term)) || astray(seen, id)),
      }
    }
    const moved = terms.flatMap((term) =>
      journeys
        .filter((journey) => moves(term, journey).moved(results.get(term) ?? {}))
        .map((journey) => ({ term, journey })),
    )
    if (moved.length > Math.max(3, Math.ceil(terms.length * journeys.length * 0.15))) {
      line.say(
        `${moved.length} journeys moved or missed the spec — too many to be a loaded machine, so none is walked again`,
      )
    } else if (moved.length > 0) {
      begin('Walking again, one at a time', moved.length)
      for (const { term, journey } of moved) {
        const lane = lanes.find((l) => l.term === term && walkable(l, journey)) as Lane
        const facts = results.get(term) ?? {}
        const { ids, moved: still } = moves(term, journey)
        for (let attempt = 0; attempt < 2; attempt++) {
          const retry = await walk(fixtureFor(lane, journey), journey)
          for (const id of ids) {
            delete facts[id]
          }
          Object.assign(facts, retry)
          if (!still(retry)) {
            break
          }
        }
        step(`${term} ${journey.id}`)
      }
      const one = moved.length === 1
      line.say(
        `walked ${moved.length} ${one ? 'journey' : 'journeys'} again, one at a time, since ${one ? 'its' : 'their'} facts moved or missed the spec${values.verbose ? `: ${moved.map(({ term, journey }) => `${term} ${journey.id}`).join(', ')}` : ` (-v lists ${one ? 'it' : 'them'})`}`,
      )
    }
    line.done()
    clearInterval(beat)
    const fresh = tableOf(results, wanted, old)
    const scoped: Table = new Map([...old].filter(([id]) => journeys.some((j) => id.split('.')[0] === j.id)))
    if (values.update) {
      writeTable(
        merged(
          old,
          fresh,
          terms,
          journeys.map((j) => j.id),
        ),
      )
      console.log(`wrote tests/parity/facts.tsv (${seconds(started)})`)
      report(fresh, fresh)
      return
    }
    const ok = report(fresh, scoped)
    console.log(
      `\n${ok ? tint(TINT.same, MARK.same) : tint(TINT.broken, MARK.broken)} parity ${ok ? 'ok' : 'failed'} — ${journeys.length} journeys × ${terms.length} terminals in ${seconds(started)}`,
    )
    if (!ok) {
      process.exitCode = 1
    }
  } finally {
    if (!values.keep) {
      rmSync(work, { recursive: true, force: true })
    } else {
      console.log(`kept ${work}`)
    }
  }
}

await main()
process.exit()
