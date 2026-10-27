import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { parseArgs } from 'node:util'
import { pending } from '../src/tui/pending.ts'
import { build, type Fixture, reap, restore, shims, workDir } from './parity/home.ts'
import type { Journey, Probe } from './parity/journeys.ts'
import { App, type Tab } from './parity/model.ts'
import { probe } from './parity/probe.ts'
import { TERMS, type Term } from './parity/terms.ts'

const REPO = join(import.meta.dirname, '..')
const COSTS = join(import.meta.dirname, 'costs.tsv')
const RESET = "print -n '\\e]112\\e\\\\\\e]111\\e\\\\'"
const KEYS = ['cli', 'signals', 'writes', 'watched'] as const
const STAGGER_MS = 40

type Cost = Record<(typeof KEYS)[number], number> & { paths: string[] }

interface Action {
  id: string
  run(p: Probe, tab: Tab): Promise<void>
}

const ACTIONS: Action[] = [
  { id: 'empty', run: (p, tab) => p.type(tab, '') },
  { id: 'use', run: (p, tab) => p.type(tab, 'ttheme use kita') },
  { id: 'use-plain', run: (p, tab) => p.type(tab, 'ttheme use miku') },
  { id: 'default', run: (p, tab) => p.type(tab, 'ttheme default rei') },
  {
    id: 'pin',
    async run(p, tab) {
      p.pin('work', 'ttheme/kita')
      await p.type(tab, 'mkdir -p ~/work && cd ~/work')
    },
  },
  { id: 'unpin', run: (p, tab) => p.type(tab, 'cd ~') },
  { id: 'reset', run: (p, tab) => p.type(tab, RESET) },
  { id: 'light', run: (p, tab) => p.type(tab, 'ttheme light') },
  { id: 'dark', run: (p, tab) => p.type(tab, 'ttheme dark') },
  {
    id: 'preview',
    async run(p, tab) {
      await p.launch(tab, 'ttheme', 'Browse')
      await p.keys(tab, 'k', 'i')
      await p.quit(tab)
    },
  },
  { id: 'off', run: (p, tab) => p.type(tab, 'ttheme off') },
  { id: 'on', run: (p, tab) => p.type(tab, 'ttheme on') },
]

const { values } = parseArgs({
  options: {
    update: { type: 'boolean', default: false },
    only: { type: 'string', multiple: true },
    show: { type: 'boolean', default: false },
  },
})

const terms = (values.only?.flatMap((item) => item.split(',')).filter(Boolean) ?? [...TERMS]) as Term[]
const line = pending()
const journey: Journey = { id: 'costs', about: 'what each action costs', run: async () => {} }

function lines(file: string): string[] {
  return existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean) : []
}

function written(fixture: Fixture, app: App, trace: readonly string[]): Pick<Cost, 'writes' | 'watched' | 'paths'> {
  const parity = join(fixture.place.home, '.parity')
  const watched = new Set((app.kind.watched?.(app) ?? []).map((file) => dirname(file)).filter((dir) => dir !== parity))

  return {
    writes: trace.filter((path) => !/\.(ttheme-)?\d+$/.test(path)).length,
    watched: trace.filter((path) => watched.has(dirname(path))).length,
    paths: trace.map((path) => `${watched.has(dirname(path)) ? '*' : ' '} ${path.replace(fixture.place.home, '~')}`),
  }
}

async function measured(fixture: Fixture): Promise<Map<string, Cost>> {
  await restore(fixture)
  const trace = join(fixture.place.root, 'writes')
  rmSync(trace, { force: true })
  fixture.place.env.TTHEME_WRITES = trace
  const app = new App(fixture.term, fixture.place)
  const extra: App[] = []

  const p = probe(app, fixture, journey, {}, extra, {
    wanted: {},
    needs: new Map(),
    screens: new Map(),
    shows: [],
    say: (text) => line.say(text),
  })

  const out = new Map<string, Cost>()
  const parity = join(fixture.place.home, '.parity')

  const counts = () => ({
    cli: lines(join(parity, 'cli')).length,
    signals: lines(join(parity, 'signals')).length,
    trace: lines(trace).length,
  })

  try {
    let before = counts()
    const tab = await p.open()

    const record = (id: string) => {
      const now = counts()
      out.set(id, {
        cli: now.cli - before.cli,
        signals: now.signals - before.signals,
        ...written(fixture, app, lines(trace).slice(before.trace)),
      })
      before = now
    }

    record('open')

    for (const action of ACTIONS) {
      await action.run(p, tab)
      record(action.id)
    }
  } finally {
    await app.close()
    await reap(fixture.place.home)
    delete fixture.place.env.TTHEME_WRITES
  }

  return out
}

const cell = (cost: Cost | undefined) => (cost ? KEYS.map((key) => cost[key]).join('/') : '-')

function read(): Map<string, Map<string, string>> {
  const [head = [], ...rows] = lines(COSTS).map((row) => row.split('\t'))

  return new Map(
    rows.map((row) => [row[0] ?? '', new Map(head.slice(1).map((term, at) => [term, row[at + 1] ?? '-']))]),
  )
}

function write(results: Map<Term, Map<string, Cost>>, old: Map<string, Map<string, string>>): void {
  const ids = ['open', ...ACTIONS.map((action) => action.id)]

  const rows = ids.map((id) =>
    [
      id,
      ...TERMS.map((term) => (results.has(term) ? cell(results.get(term)?.get(id)) : (old.get(id)?.get(term) ?? '-'))),
    ].join('\t'),
  )

  writeFileSync(COSTS, `${['action', ...TERMS].join('\t')}\n${rows.join('\n')}\n`)
}

function drifts(term: Term, costs: Map<string, Cost>, old: Map<string, Map<string, string>>): string[] {
  return [...costs].flatMap(([id, cost]) => (old.get(id)?.get(term) === cell(cost) ? [] : [`${id}=${cell(cost)}`]))
}

function agreed(term: Term, runs: readonly Map<string, Cost>[], old: Map<string, Map<string, string>>) {
  const last = runs.at(-1) ?? new Map<string, Cost>()

  return new Map(
    [...last].map(([id, cost]) => {
      const kept = runs.find((run) => {
        const one = run.get(id)

        return one !== undefined && old.get(id)?.get(term) === cell(one)
      })

      return [id, kept?.get(id) ?? cost] as const
    }),
  )
}

async function main(): Promise<void> {
  const work = workDir()
  const bin = shims(work)
  const results = new Map<Term, Map<string, Cost>>()
  const old = read()
  const again: string[] = []

  try {
    line.set(`Building fixture homes for ${terms.length} terminals`)
    const fixtures = await Promise.all(terms.map((term) => build(term, work, bin, REPO, 'costs', true)))
    let done = 0

    await Promise.all(
      fixtures.map(async (fixture, at) => {
        await Bun.sleep(at * STAGGER_MS)
        results.set(fixture.term, await measured(fixture))
        line.set(`Measuring ${++done}/${fixtures.length} · ${fixture.term}`)
      }),
    )

    for (const fixture of values.update ? [] : fixtures) {
      const runs = [results.get(fixture.term) ?? new Map<string, Cost>()]
      const first = drifts(fixture.term, runs[0] ?? new Map(), old)

      for (
        let attempt = 0;
        attempt < 2 && drifts(fixture.term, agreed(fixture.term, runs, old), old).length > 0;
        attempt++
      ) {
        line.set(`Measuring ${fixture.term} again, alone`)
        runs.push(await measured(fixture))
      }

      if (runs.length > 1) {
        again.push(`  ${fixture.term}: ${first.join(' ')}`)
        results.set(fixture.term, agreed(fixture.term, runs, old))
      }
    }
  } finally {
    line.done()
    rmSync(work, { recursive: true, force: true })
  }

  if (again.length > 0) {
    console.error(
      `measured again, alone, since a cost differed from ${COSTS} on the first measure:\n${again.join('\n')}`,
    )
  }

  if (values.show) {
    for (const [term, costs] of results) {
      for (const [id, cost] of costs) {
        console.log(`${term} ${id}: ${cell(cost)}${cost.paths.length > 0 ? `\n${cost.paths.join('\n')}` : ''}`)
      }
    }
  }

  if (values.update) {
    write(results, old)
    console.log(`wrote tests/costs.tsv — ${KEYS.join('/')} per action`)

    return
  }

  const more: string[] = []
  const less: string[] = []

  for (const [term, costs] of results) {
    for (const [id, cost] of costs) {
      const was = old.get(id)?.get(term)

      if (was === undefined || was === '-') {
        more.push(`${term} ${id}: ${cell(cost)}, none recorded`)
        continue
      }

      const before = was.split('/').map(Number)

      KEYS.forEach((key, at) => {
        const then = before[at] ?? 0

        if (cost[key] > then) {
          more.push(
            `${term} ${id}: ${key} ${then} → ${cost[key]}${key === 'writes' || key === 'watched' ? `\n${cost.paths.join('\n')}` : ''}`,
          )
        } else if (cost[key] < then) {
          less.push(`${term} ${id}: ${key} ${then} → ${cost[key]}`)
        }
      })
    }
  }

  for (const text of more) {
    console.error(`✗ ${text}`)
  }

  for (const text of less) {
    console.error(`+ ${text}`)
  }

  if (less.length > 0) {
    console.error(`+: cheaper than ${COSTS} — lock the win in with \`mise run costs --update\``)
  }

  console.log(
    `${more.length + less.length === 0 ? '✓' : '✗'} costs — ${KEYS.join('/')} of ${ACTIONS.length + 1} actions in ${results.size} terminals`,
  )

  if (more.length + less.length > 0) {
    process.exitCode = 1
  }
}

await main()

process.exit()
