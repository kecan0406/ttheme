import { existsSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { availableParallelism } from 'node:os'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { pending } from '../../src/tui/pending.ts'
import { explained, type Facts, readGaps } from './facts.ts'
import { build, type Fixture, PALETTES, PICTURED, reap, restore, shims, workDir } from './home.ts'
import type { Journey, Probe } from './journeys.ts'
import { App, type Tab } from './model.ts'
import { probe, type Recorder } from './probe.ts'
import { CAPABILITIES, TERMS, type Term } from './terms.ts'

const REPO = join(import.meta.dirname, '..', '..')
const STAGGER_MS = 40

const { values } = parseArgs({
  options: {
    only: { type: 'string', multiple: true },
    seed: { type: 'string' },
    steps: { type: 'string', default: '12' },
    runs: { type: 'string', default: '1' },
    slots: { type: 'string', default: String(availableParallelism() >= 8 ? 2 : 1) },
    jitter: { type: 'boolean', default: false },
    whole: { type: 'boolean', default: false },
  },
})

const terms = (values.only?.flatMap((item) => item.split(',')).filter(Boolean) ?? [...TERMS]) as Term[]
const unknown = terms.find((term) => !TERMS.includes(term))

if (unknown !== undefined) {
  console.error(`unknown terminal ${unknown} — one of ${TERMS.join(', ')}`)
  process.exit(2)
}

const RESET = "print -n '\\e]112\\e\\\\\\e]111\\e\\\\'"
const LETTERS = 'konatakitamikurei'
const SLUGS = PALETTES.map((name) => name.split('/')[1] ?? name)

type Step =
  | { do: 'open' }
  | { do: 'focus'; tab: number }
  | { do: 'type'; line: string }
  | { do: 'pin'; palette: string }
  | { do: 'preview'; keys: string[] }

interface Failure {
  at: number
  kind: 'wears' | 'echo' | 'picture' | 'stuck'
  detail: string
}

function random(seed: number): () => number {
  let state = seed >>> 0

  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function stepsOf(seed: number, count: number): Step[] {
  const next = random(seed)
  const pick = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)] as T
  const steps: Step[] = [{ do: 'open' }]
  let tabs = 1
  let away = true

  const weighted: [number, () => Step | undefined][] = [
    [10, () => (tabs < 4 ? { do: 'open' } : undefined)],
    [14, () => (tabs > 1 ? { do: 'focus', tab: Math.floor(next() * tabs) } : undefined)],
    [16, () => ({ do: 'type', line: `ttheme use ${pick(SLUGS)}` })],
    [12, () => ({ do: 'type', line: `ttheme default ${pick(SLUGS)}` })],
    [6, () => ({ do: 'type', line: 'ttheme off' })],
    [6, () => ({ do: 'type', line: 'ttheme on' })],
    [8, () => ({ do: 'type', line: RESET })],
    [7, () => ({ do: 'pin', palette: pick(PALETTES) })],
    [
      10,
      () => {
        away = !away

        return { do: 'type', line: away ? 'cd ~' : 'mkdir -p ~/work && cd ~/work' }
      },
    ],
    [3, () => ({ do: 'type', line: pick(['ttheme light', 'ttheme dark']) })],
    [4, () => ({ do: 'preview', keys: Array.from({ length: 1 + Math.floor(next() * 3) }, () => pick([...LETTERS])) })],
  ]

  const total = weighted.reduce((sum, [weight]) => sum + weight, 0)

  while (steps.length < count) {
    let roll = next() * total
    let make = weighted[0]?.[1] ?? (() => undefined)

    for (const [weight, one] of weighted) {
      if (roll < weight) {
        make = one
        break
      }

      roll -= weight
    }

    const step = make()

    if (step) {
      steps.push(step)
      tabs += step.do === 'open' ? 1 : 0
    }
  }

  return steps
}

function described(step: Step): string {
  switch (step.do) {
    case 'open':
      return 'open'
    case 'focus':
      return `focus t${step.tab}`
    case 'type':
      return step.line
    case 'pin':
      return `pin ~/work to ${step.palette}`
    case 'preview':
      return `ttheme, type ${step.keys.join('')}, esc`
  }
}

function journeyOf(term: Term, seed: number, steps: readonly Step[], failure: Failure): string {
  const lines: string[] = []
  let tabs = 0
  let front = 't0'

  for (const step of steps) {
    switch (step.do) {
      case 'open':
        front = `t${tabs++}`
        lines.push(`const ${front} = await p.open()`)
        break
      case 'focus':
        front = `t${step.tab}`
        lines.push(`await p.focus(${front})`)
        break
      case 'type':
        lines.push(`await p.type(${front}, ${JSON.stringify(step.line)})`)
        break
      case 'pin':
        lines.push(`p.pin('work', ${JSON.stringify(step.palette)})`)
        break
      case 'preview':
        lines.push(
          `await p.launch(${front}, 'ttheme', 'Browse')`,
          `await p.keys(${front}, ${step.keys.map((key) => JSON.stringify(key)).join(', ')})`,
          `await p.quit(${front})`,
        )
        break
    }
  }

  return [
    '  {',
    `    id: 'walk-${term}-${seed}',`,
    `    about: ${JSON.stringify(`${failure.kind}: ${failure.detail}`)},`,
    '    async run(p) {',
    ...lines.map((text) => `      ${text}`),
    "      await p.look('end', { want: '?' })",
    '    },',
    '  },',
  ].join('\n')
}

const gaps = readGaps()
const line = pending()
const journey: Journey = { id: 'walk', about: 'a random walk', run: async () => {} }

function judged(term: Term, facts: Facts, at: number, off: boolean): Failure | undefined {
  const fact = (key: string) => facts[`walk.s${at}.${key}`] ?? '-'
  const issue = fact('issue')
  const colors = fact('colors')
  const picture = fact('picture')
  const lenient = off && explained(gaps, term, 'off.here.issue', []) !== undefined

  if (issue.includes('echo')) {
    return { at, kind: 'echo', detail: 'an escape sequence reached the screen as text' }
  }

  if (issue.includes('wears') && !lenient) {
    return { at, kind: 'wears', detail: `the tab shows ${colors}, the shell believes ${fact('wears')}` }
  }

  if (CAPABILITIES.pictures(term) && !colors.includes(':') && !lenient) {
    const want = PICTURED.includes(colors) ? colors : 'none'

    if (picture !== want) {
      return { at, kind: 'picture', detail: `the tab shows ${colors} with the picture ${picture}, not ${want}` }
    }
  }

  return undefined
}

async function walked(fixture: Fixture, steps: readonly Step[], seed: number): Promise<Failure | undefined> {
  await restore(fixture)
  const app = new App(fixture.term, fixture.place)
  const extra: App[] = []
  const facts: Facts = {}
  const shake = random(seed ^ 0x9e3779b9)

  if (values.jitter) {
    app.jitter = () => Math.floor(shake() * 300)
  }

  const recorder: Recorder = {
    wanted: {},
    needs: new Map(),
    screens: new Map(),
    shows: [],
    say: (text) => line.say(text),
  }

  const p: Probe = probe(app, fixture, journey, facts, extra, recorder)
  const tabs: Tab[] = []
  let off = false

  try {
    for (const [at, step] of steps.entries()) {
      try {
        switch (step.do) {
          case 'open':
            tabs.push(await p.open())
            break
          case 'focus':
            await p.focus(tabs[step.tab] as Tab)
            break
          case 'type':
            await p.type(app.front as Tab, step.line)
            off = step.line === 'ttheme off' ? true : step.line === 'ttheme on' ? false : off
            break
          case 'pin':
            p.pin('work', step.palette)
            break
          case 'preview':
            await p.launch(app.front as Tab, 'ttheme', 'Browse')
            await p.keys(app.front as Tab, ...step.keys)
            await p.quit(app.front as Tab)
            break
        }

        await p.look(`s${at}`, { want: '-' })
      } catch (error) {
        return {
          at,
          kind: 'stuck',
          detail: (error instanceof Error ? error.message : String(error)).split('\n')[0] ?? '',
        }
      }

      const failure = judged(fixture.term, facts, at, off)

      if (failure) {
        return failure
      }
    }

    return undefined
  } finally {
    await app.close()

    for (const other of extra) {
      await other.close()
    }

    await reap(fixture.place.home)
  }
}

function playable(steps: readonly Step[]): boolean {
  let tabs = 0

  for (const step of steps) {
    if (step.do === 'open') {
      tabs++
    } else if (tabs === 0 || (step.do === 'focus' && step.tab >= tabs)) {
      return false
    }
  }

  return tabs > 0
}

async function shrunk(fixture: Fixture, steps: Step[], seed: number, kind: Failure['kind']) {
  let best = steps
  let failure: Failure | undefined
  let budget = 40

  for (let at = 0; at < best.length && budget > 0; budget--) {
    const fewer = best.toSpliced(at, 1)

    if (!playable(fewer)) {
      at++
      continue
    }

    const again = await walked(fixture, fewer, seed)

    if (again?.kind === kind) {
      best = fewer.slice(0, again.at + 1)
      failure = again
    } else {
      at++
    }
  }

  return { steps: best, failure }
}

const STORE = join(realpathSync(process.env.TMPDIR ?? '/tmp'), 'ttheme-walks.json')

interface Kept {
  term: Term
  seed: number
  steps: Step[]
}

function kept(): Kept[] {
  try {
    return existsSync(STORE) ? (JSON.parse(readFileSync(STORE, 'utf8')) as Kept[]) : []
  } catch {
    return []
  }
}

async function main(): Promise<void> {
  const work = workDir()
  const bin = shims(work)
  const count = Math.max(2, Number(values.steps))
  const runs = Math.max(1, Number(values.runs))
  const first = values.seed === undefined ? Math.floor(Math.random() * 1e9) : Number(values.seed)
  const slots = Math.max(1, Number(values.slots))
  const found: { term: Term; seed: number; failure: Failure; steps: Step[]; reproduced: boolean }[] = []
  const still: Kept[] = []
  let done = 0
  const total = terms.length * runs

  try {
    line.set(`Building fixture homes 0/${terms.length * slots}`)

    const lanes = await Promise.all(
      terms.flatMap((term) =>
        Array.from({ length: slots }, async (_, slot) => build(term, work, bin, REPO, `walk${slot}`, true)),
      ),
    )

    const queue = terms.flatMap((term) => [
      ...kept()
        .filter((one) => one.term === term)
        .map((one) => ({ term, seed: one.seed, steps: one.steps, again: true })),
      ...Array.from({ length: runs }, (_, i) => ({
        term,
        seed: first + i,
        steps: stepsOf(first + i, count),
        again: false,
      })),
    ])

    await Promise.all(
      lanes.map(async (fixture, at) => {
        await Bun.sleep(at * STAGGER_MS)

        for (let next = queue.findIndex((one) => one.term === fixture.term); next >= 0; ) {
          const [walk] = queue.splice(next, 1)

          if (!walk) {
            break
          }

          const failure = await walked(fixture, walk.steps, walk.seed)
          done += walk.again ? 0 : 1
          line.set(`Walking ${done}/${total} · ${walk.term} seed ${walk.seed}${failure ? ` · ${failure.kind}` : ''}`)

          if (failure) {
            const steps = walk.steps.slice(0, failure.at + 1)
            const twice = await walked(fixture, steps, walk.seed)
            const reproduced = twice?.kind === failure.kind

            const small =
              reproduced && !values.whole ? await shrunk(fixture, steps, walk.seed, failure.kind) : undefined

            const end = small?.steps ?? steps
            found.push({ term: walk.term, seed: walk.seed, failure: small?.failure ?? failure, steps: end, reproduced })

            if (reproduced) {
              still.push({ term: walk.term, seed: walk.seed, steps: end })
            }
          }

          next = queue.findIndex((one) => one.term === fixture.term)
        }
      }),
    )
  } finally {
    line.done()
    rmSync(work, { recursive: true, force: true })
  }

  writeFileSync(STORE, `${JSON.stringify(still, null, 2)}\n`)

  for (const { term, seed, failure, steps, reproduced } of found) {
    console.log(
      `\n✗ ${term} seed ${seed}, step ${failure.at + 1} of ${steps.length}: ${failure.kind} — ${failure.detail}${reproduced ? '' : ' (not seen again when walked a second time)'}`,
    )
    console.log(steps.map((step, at) => `  ${at + 1}. ${described(step)}`).join('\n'))

    if (reproduced) {
      console.log(`a journey to start from:\n${journeyOf(term, seed, steps, failure)}`)
    }
  }

  const real = found.filter((one) => one.reproduced)
  console.log(
    `\n${real.length === 0 ? '✓' : '✗'} walk — ${total} walks of ${count} steps in ${terms.length} terminals from seed ${first}${values.jitter ? ', reloads jittered' : ''}: ${real.length} failed twice, ${found.length - real.length} once`,
  )

  if (real.length > 0) {
    process.exitCode = 1
  }
}

await main()

process.exit()
