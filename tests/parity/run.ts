import { createHash } from 'node:crypto'
import { appendFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { availableParallelism } from 'node:os'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { colorless } from '../../src/osc.ts'
import { pending } from '../../src/pending.ts'
import {
  cellValue,
  explained,
  type Facts,
  glob,
  journeyOrder,
  KINDS,
  merged,
  owed,
  readCompat,
  readGaps,
  readTable,
  type Table,
  tableOf,
  unmeasured,
  writeTable,
} from './facts.ts'
import { build, cli, type Fixture, reap, restore, shims, workDir } from './home.ts'
import { JOURNEYS, type Journey, type LookOptions, type Probe } from './journeys.ts'
import { pictureOf } from './looks.ts'
import { App, backgrounds, type Look, type Tab } from './model.ts'
import { BEHAVIOR, REFERENCE, TERMS, type Term } from './terms.ts'

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

function issues(
  term: Term,
  seen: Look,
  wears: string | undefined,
  pictured: boolean,
  text: string | undefined,
  fixture: Fixture,
): string {
  const out: string[] = []
  const whole = !seen.colors.includes(':')
  if (wears !== undefined && whole) {
    const want = seen.colors === 'own' ? 'none' : seen.colors
    if (wears !== want) {
      out.push('wears')
    }
  }
  if (BEHAVIOR[term].pictures !== 'none' && whole && seen.colors !== 'own' && (wears !== undefined || pictured)) {
    const want = pictureOf(backgrounds(fixture.place), seen.colors)
    if (seen.picture !== want) {
      out.push('picture')
    }
  }
  if (text?.includes('^[')) {
    out.push('echo')
  }
  return out.length > 0 ? out.join(',') : '-'
}

function probe(app: App, fixture: Fixture, journey: Journey, facts: Facts, extra: App[]): Probe {
  const marks = new Map<Tab, number>()
  const put = (label: string, key: string, value: string) => {
    facts[`${journey.id}.${label}.${key}`] = value
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
    async look(label: string, options: LookOptions = {}) {
      const tab = app.front
      if (!tab) {
        throw new Error(`look ${label}: no tab`)
      }
      const seen = app.look(tab)
      put(label, 'colors', seen.colors)
      put(label, 'picture', seen.picture)
      let wears: string | undefined
      if (options.wears !== false && !options.busy) {
        wears = await app.wears(tab)
        put(label, 'wears', wears)
      }
      if (options.repaints) {
        put(label, 'repaints', String(tab.bgs.length - 1))
      }
      if (options.opacity) {
        put(label, 'opacity', seen.opacity)
      }
      let text: string | undefined
      if (options.text) {
        text = normalized(tab.screen(fixture.place.home))
        put(label, 'text', digest(text))
        screens.set(`${app.term} ${journey.id}.${label}`, text)
      }
      if (shows.some((pattern) => glob(pattern, `${journey.id}.${label}`))) {
        line.say(
          `--- ${app.term} ${journey.id}.${label}\n${tab.screen(fixture.place.home)}\n--- journal: ${app.journal.join(' · ')}`,
        )
      }
      put(
        label,
        'issue',
        issues(
          app.term,
          seen,
          wears,
          app.layered(tab) !== undefined || options.busy === true,
          text ?? tab.screen(fixture.place.home),
          fixture,
        ),
      )
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
        async look(label) {
          const tab = other.front
          if (!tab) {
            throw new Error(`look ${label}: no ${terminal} tab`)
          }
          const seen = other.look(tab)
          put(label, 'colors', seen.colors)
          put(label, 'picture', seen.picture)
          put(label, 'opacity', seen.opacity)
          put(label, 'wears', await other.wears(tab))
        },
      }
    },
    pin(dir, palette) {
      mkdirSync(join(fixture.place.home, dir), { recursive: true })
      writeFileSync(join(fixture.place.configHome, 'ttheme', 'pins'), `~/${dir}/**  ${palette}\n`)
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

const MARK = { same: '✓', gap: '·', changed: '!', broken: '✗' } as const

type Mark = keyof typeof MARK

const TINT: Record<Mark, string> = { same: '32', gap: '2', changed: '33', broken: '31' }

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
  term: Term
  id: string
  before: string
  cell: string
}

interface Loose {
  term: Term
  id: string
  value: string
  reference?: string
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
  const used = new Set<string>()
  const changed: Change[] = []
  const loose: Loose[] = []
  const notes: string[] = []
  const status = new Map<string, Mark>()
  const kinds = new Map<string, number>()
  const worse = (key: string, mark: Mark) => {
    const rank = ['same', 'gap', 'changed', 'broken']
    if (rank.indexOf(mark) > rank.indexOf(status.get(key) ?? 'same')) {
      status.set(key, mark)
    }
  }
  for (const [id, row] of fresh) {
    const journey = id.split('.')[0] ?? ''
    for (const term of terms) {
      const cell = row.get(term) ?? '-'
      const value = cellValue(fresh, id, term)
      const key = `${journey} ${term}`
      const before = old.get(id)?.get(term)
      if (before !== undefined && before !== cell) {
        worse(key, 'changed')
        changed.push({ term, id, before, cell })
      } else if (before === undefined && old.size > 0) {
        worse(key, 'changed')
        changed.push({ term, id, before: '(new)', cell })
      }
      if (!owed(term, id, value, cell)) {
        continue
      }
      const gap = explained(gaps, term, id)
      if (gap) {
        used.add(`${gap.term}\t${gap.fact}`)
        worse(key, 'gap')
        notes.push(`${term} ${id}: ${value} (ghostty ${cellValue(fresh, id, REFERENCE)}) — ${gap.kind}: ${gap.reason}`)
        const counted = `${term}\t${gap.kind}`
        kinds.set(counted, (kinds.get(counted) ?? 0) + 1)
      } else {
        worse(key, 'broken')
        loose.push({
          term,
          id,
          value,
          ...(term === REFERENCE || id.endsWith('.issue') ? {} : { reference: cellValue(fresh, id, REFERENCE) }),
        })
      }
    }
  }
  const complete = journeys.length === JOURNEYS.length
  const stale = gaps.filter((gap) => complete && terms.includes(gap.term) && !used.has(`${gap.term}\t${gap.fact}`))
  const same = (term: Term) => journeys.filter((j) => (status.get(`${j.id} ${term}`) ?? 'same') === 'same').length
  const lead = Math.max(...journeys.map((j) => j.id.length), 'deferred'.length) + 2
  const room = live ? process.stdout.columns || Number.POSITIVE_INFINITY : Number.POSITIVE_INFINITY
  const spaced = (labels: string[], gap: number) => labels.map((label) => Math.max(label.length, 5) + gap)
  const roomy = spaced(terms, 2)
  const wide = lead + roomy.reduce((sum, width) => sum + width, 0) <= room
  const labels = wide ? [...terms] : terms.map((term) => SHORT[term] ?? term)
  const widths = wide ? roomy : spaced(labels, 1)
  const row = (head: string, cells: [string, string][], code = '') =>
    `${tint(code, head.padEnd(lead))}${cells.map(([text, tone], at) => `${tint(tone, text)}${' '.repeat(Math.max(0, (widths[at] ?? 0) - text.length))}`).join('')}`.trimEnd()
  console.log(
    row(
      'journey',
      labels.map((label) => [label, '1'] as [string, string]),
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
      'same',
      terms.map((term) => {
        const n = same(term)
        return [`${n}/${journeys.length}`, n === journeys.length ? TINT.same : ''] as [string, string]
      }),
    ),
  )
  for (const kind of KINDS) {
    console.log(
      row(
        kind,
        terms.map((term) => {
          const n = kinds.get(`${term}\t${kind}`) ?? 0
          return [n ? String(n) : '', kind === 'layer' ? TINT.changed : TINT.gap] as [string, string]
        }),
      ),
    )
  }
  const short = terms.filter((term, at) => labels[at] !== term)
  console.log(
    tint(
      '2',
      [
        `\n${MARK.same} same as Ghostty  ${MARK.gap} explained in gaps.tsv  ${MARK.changed} a fact changed  ${MARK.broken} unexplained`,
        'same: journeys same as Ghostty; cannot, layer, deferred: facts gaps.tsv explains',
        '  cannot    the terminal cannot express it',
        '  layer     ttheme could close it',
        '  deferred  left out on purpose',
        ...(short.length > 0 ? [short.map((term) => `${SHORT[term]} ${term}`).join(' · ')] : []),
      ].join('\n'),
    ),
  )
  const compat = readCompat()
  const open = terms.flatMap((term): [string, string[]][] => {
    const ids = unmeasured(compat, term)
    if (ids === undefined) {
      return [[term, ['every case — the model follows its source']]]
    }
    return ids.length > 0 ? [[term, ids]] : []
  })
  if (open.length > 0) {
    const width = Math.max(...open.map(([term]) => term.length)) + 2
    console.log('\nthe model assumes these, since mise run compat left them ? or skip:')
    for (const [term, ids] of open) {
      const lines = ids.reduce<string[]>((out, id) => {
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
    changed.map(({ term, id, before, cell }) => [term, id, `${before} → ${cell}`]),
  )
  section(
    'unexplained — fix each, or give it a reason in tests/parity/gaps.tsv',
    TINT.broken,
    loose.map(({ term, id, value, reference }) => [
      term,
      id,
      reference === undefined ? value : `${value}, ghostty ${reference}`,
    ]),
  )
  section(
    'stale gaps — remove them from tests/parity/gaps.tsv, they explain nothing now',
    TINT.changed,
    stale.map((gap) => [gap.term, gap.fact]),
  )
  for (const { term, id } of [...changed, ...loose]) {
    const match = /^([\w-]+)\.([\w-]+)\.text$/.exec(id)
    if (match) {
      const [, journey, label] = match
      const mine = screens.get(`${term} ${journey}.${label}`)
      const theirs = screens.get(`${REFERENCE} ${journey}.${label}`)
      if (mine !== undefined) {
        console.error(
          `\n--- ${REFERENCE} ${journey}.${label}\n${theirs ?? '(not run)'}\n--- ${term} ${journey}.${label}\n${mine}`,
        )
      }
    }
  }
  const ok = changed.length + loose.length + stale.length === 0
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
    const moves = (term: Term, journey: Journey) => {
      const facts = results.get(term) ?? {}
      const ids = [...new Set([...Object.keys(facts), ...old.keys()])].filter((id) => id.split('.')[0] === journey.id)
      return {
        ids,
        moved: (seen: Facts) => ids.some((id) => old.has(id) && (seen[id] ?? '-') !== cellValue(old, id, term)),
      }
    }
    const moved =
      old.size === 0
        ? []
        : terms.flatMap((term) =>
            journeys
              .filter((journey) => moves(term, journey).moved(results.get(term) ?? {}))
              .map((journey) => ({ term, journey })),
          )
    if (moved.length > Math.max(3, Math.ceil(terms.length * journeys.length * 0.15))) {
      line.say(`${moved.length} journeys moved — too many to be a loaded machine, so none is walked again`)
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
        `walked ${moved.length} ${one ? 'journey' : 'journeys'} again, one at a time, since ${one ? 'its' : 'their'} facts moved${values.verbose ? `: ${moved.map(({ term, journey }) => `${term} ${journey.id}`).join(', ')}` : ` (-v lists ${one ? 'it' : 'them'})`}`,
      )
    }
    line.done()
    clearInterval(beat)
    const fresh = tableOf(results, old)
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
