import { createHash } from 'node:crypto'
import { appendFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { availableParallelism } from 'node:os'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import {
  cellValue,
  explained,
  type Facts,
  glob,
  journeyOrder,
  KINDS,
  merged,
  owed,
  readGaps,
  readTable,
  type Table,
  tableOf,
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
  layered: boolean,
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
  if (BEHAVIOR[term].pictures !== 'none' && whole && seen.colors !== 'own' && (wears !== undefined || layered)) {
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
      if (options.wears !== false) {
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
        console.log(
          `--- ${app.term} ${journey.id}.${label}\n${tab.screen(fixture.place.home)}\n--- journal: ${app.journal.join(' · ')}`,
        )
      }
      put(
        label,
        'issue',
        issues(app.term, seen, wears, app.layered(tab) !== undefined, text ?? tab.screen(fixture.place.home), fixture),
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
  await restore(fixture)
  const facts: Facts = {}
  const app = new App(fixture.term, fixture.place)
  const extra: App[] = []
  try {
    await journey.run(probe(app, fixture, journey, facts, extra))
  } catch (error) {
    facts[`${journey.id}.error`] = (error instanceof Error ? error.message : String(error)).split('\n')[0] ?? 'error'
    if (values.verbose) {
      console.error(`${fixture.term} ${journey.id}: ${error instanceof Error ? error.message : error}`)
    }
  } finally {
    await app.close()
    for (const other of extra) {
      await other.close()
    }
    await reap(fixture.place)
    journals.set(`${fixture.term} ${journey.id}`, app.journal)
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

const MARK = { same: '✓', gap: '·', broken: '✗', changed: '!' } as const

function report(fresh: Table, old: Table): boolean {
  const gaps = readGaps()
  const used = new Set<string>()
  const problems: string[] = []
  const notes: string[] = []
  const status = new Map<string, keyof typeof MARK>()
  const kinds = new Map<string, number>()
  const worse = (key: string, mark: keyof typeof MARK) => {
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
        problems.push(`${term} ${id}: was ${before}, now ${cell}`)
      } else if (before === undefined && old.size > 0) {
        worse(key, 'changed')
        problems.push(`${term} ${id}: new fact ${cell}`)
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
        problems.push(
          term === REFERENCE || id.endsWith('.issue')
            ? `${term} ${id}: ${value} — unexplained; fix it or give it a reason in tests/parity/gaps.tsv`
            : `${term} ${id}: ${value}, ghostty ${cellValue(fresh, id, REFERENCE)} — unexplained; fix it or give it a reason in tests/parity/gaps.tsv`,
        )
      }
    }
  }
  for (const gap of gaps) {
    const ran = terms.includes(gap.term) && journeys.length === JOURNEYS.length
    if (ran && !used.has(`${gap.term}\t${gap.fact}`)) {
      problems.push(`gaps.tsv: ${gap.term} ${gap.fact} explains nothing any more — remove it`)
    }
  }
  const width = Math.max(...journeys.map((j) => j.id.length)) + 2
  console.log(`${'journey'.padEnd(width)}${terms.map((t) => t.padEnd(18)).join('')}`)
  for (const journey of journeys) {
    const cells = terms.map((term) => MARK[status.get(`${journey.id} ${term}`) ?? 'same'].padEnd(18))
    console.log(`${journey.id.padEnd(width)}${cells.join('')}`)
  }
  console.log('─'.repeat(width + 18 * terms.length))
  for (const kind of KINDS) {
    const cells = terms.map((term) => String(kinds.get(`${term}\t${kind}`) ?? '').padEnd(18))
    console.log(`${`${kind}`.padEnd(width)}${cells.join('')}`)
  }
  console.log(
    `\n${MARK.same} same as Ghostty  ${MARK.gap} a gap gaps.tsv explains  ${MARK.changed} a fact changed  ${MARK.broken} unexplained — cannot: the terminal cannot express it · layer: ttheme could close it · deferred: left out on purpose`,
  )
  if (values.verbose) {
    for (const note of notes) {
      console.log(`  ${note}`)
    }
  }
  if (problems.length > 0) {
    console.error('')
    for (const problem of problems) {
      console.error(problem)
    }
    for (const line of problems) {
      const match = /^(\S+) ([\w-]+)\.([\w-]+)\.text/.exec(line)
      if (match) {
        const [, term, journey, label] = match
        const mine = screens.get(`${term} ${journey}.${label}`)
        const theirs = screens.get(`${REFERENCE} ${journey}.${label}`)
        if (mine !== undefined) {
          console.error(
            `--- ${REFERENCE} ${journey}.${label}\n${theirs ?? '(not run)'}\n--- ${term} ${journey}.${label}\n${mine}`,
          )
        }
      }
    }
    if (values.verbose) {
      for (const [key, journal] of journals) {
        if (journal.length > 0) {
          console.error(`${key}: ${journal.join(' · ')}`)
        }
      }
    }
  }
  return problems.length === 0
}

async function main(): Promise<void> {
  const work = workDir()
  try {
    const bin = shims(work)
    const started = performance.now()
    const slots = Math.max(1, Math.min(Number(values.slots), journeys.length))
    const bare = journeys.some((journey) => journey.unwired)
    const lanes = await Promise.all(
      terms.flatMap((term) =>
        Array.from({ length: slots }, async (_, slot): Promise<Lane> => {
          const [wired, unwired] = await Promise.all([
            build(term, work, bin, REPO, String(slot), true),
            bare ? build(term, work, bin, REPO, `${slot}-bare`, false) : undefined,
          ])
          return { term, wired, ...(unwired ? { unwired } : {}) }
        }),
      ),
    )
    const results = new Map<Term, Facts>(terms.map((term) => [term, {}]))
    const queues = new Map<Term, Journey[]>(terms.map((term) => [term, [...journeys]]))
    await pool(lanes, Math.max(lanes.length, availableParallelism()), async (lane) => {
      const queue = queues.get(lane.term) ?? []
      for (let journey = queue.shift(); journey; journey = queue.shift()) {
        Object.assign(results.get(lane.term) ?? {}, await walk(fixtureFor(lane, journey), journey))
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
      console.log(`${moved.length} journeys moved — too many to be a loaded machine, so none is walked again`)
    } else if (moved.length > 0) {
      for (const { term, journey } of moved) {
        const lane = lanes.find((l) => l.term === term) as Lane
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
      }
      console.log(
        `walked again, one at a time: ${moved.map(({ term, journey }) => `${term} ${journey.id}`).join(', ')}`,
      )
    }
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
      console.log(`wrote tests/parity/facts.tsv (${((performance.now() - started) / 1000).toFixed(1)}s)`)
      report(fresh, fresh)
      return
    }
    const ok = report(fresh, scoped)
    console.log(
      `\nparity ${ok ? 'ok' : 'failed'} — ${journeys.length} journeys × ${terms.length} terminals in ${((performance.now() - started) / 1000).toFixed(1)}s`,
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
