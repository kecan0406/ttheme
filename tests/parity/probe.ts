import { createHash } from 'node:crypto'
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { type Facts, glob } from './facts.ts'
import { cli, type Fixture, PICTURED } from './home.ts'
import type { Journey, Probe, Want } from './journeys.ts'
import { App, type Look, type Tab } from './model.ts'
import type { Capability } from './terms.ts'

export interface Recorder {
  wanted: Facts
  needs: Map<string, readonly Capability[]>
  screens: Map<string, string>
  shows: readonly string[]
  say(text: string): void
}

const PROMPT = /^[│◇◆├└┌]/

export function normalized(text: string): string {
  const lines: string[] = []

  for (const line of text.split('\n')) {
    if (PROMPT.test(line)) {
      if (lines.at(-1) !== '‹prompt›') lines.push('‹prompt›')
      continue
    }

    lines.push(
      line
        .replace(/Search….*?\s{2,}(?=\d+\/\d+)/, 'Search… ‹hint›  ')
        .replace(/Search… e\.g\..*$/, 'Search… ‹hint›')
        .replace(/ttheme \d+\.\d+\.\d+/, 'ttheme ‹version›'),
    )
  }

  return lines.join('\n')
}

function digest(text: string): string {
  return `txt:${createHash('sha1').update(text).digest('hex').slice(0, 10)}`
}

export function issues(seen: Look, wears: string | undefined, text: string): string {
  const out: string[] = []

  if (wears !== undefined && !seen.colors.includes(':') && wears !== (seen.colors === 'own' ? 'none' : seen.colors)) {
    out.push('wears')
  }

  if (text.includes('^[')) {
    out.push('echo')
  }

  return out.length > 0 ? out.join(',') : '-'
}

function wornMode(home: string): string {
  const text = readFileSync(join(home, '.config', 'ttheme', 'palettes.zsh'), 'utf8')

  return /^typeset -g TTHEME_MODE_WORN=(\w+)/m.exec(text)?.[1] ?? '-'
}

export function expected({ want, picture, opacity }: Want) {
  return {
    colors: want,
    wears: want === 'own' ? 'none' : want,
    picture: picture ?? (PICTURED.includes(want) ? want : 'none'),
    opacity,
  }
}

export function probe(
  app: App,
  fixture: Fixture,
  journey: Journey,
  facts: Facts,
  extra: App[],
  recorder: Recorder,
): Probe {
  const marks = new Map<Tab, number>()

  const put = (label: string, key: string, value: string, want?: string, depends: readonly Capability[] = []) => {
    const id = `${journey.id}.${label}.${key}`
    facts[id] = value

    if (want !== undefined) {
      recorder.wanted[id] = want
    }

    if (depends.length > 0) {
      recorder.needs.set(id, depends)
    }
  }

  const launch = async (on: App, tab: Tab, line: string, marker?: string) => {
    marks.set(tab, tab.prompts())
    tab.write(`${line}\r`)
    await on.until(
      () =>
        tab.pending === 0 &&
        (marker ? tab.screen(fixture.place.home).includes(marker) : tab.xterm.buffer.active.type === 'alternate'),
      15000,
      `${line} never took the screen`,
    )
    await on.settle()
  }

  return {
    open: () => app.open(),
    type: (tab, line) => app.type(tab, line),
    launch: (tab, line, marker) => launch(app, tab, line, marker),
    keys: (tab, ...keys) => app.keys(tab, keys),
    async answer(tab, line, question, keys) {
      const before = tab.prompts()
      tab.write(`${line}\r`)
      await app.until(
        () => tab.prompts() > before || tab.screen(fixture.place.home).includes(question),
        30000,
        `${line} never asked or gave its prompt back`,
      )

      if (tab.prompts() <= before) {
        await app.keys(tab, keys)
        await app.until(() => tab.prompts() > before, 30000, `${line} never gave its prompt back`)
      }

      await app.settle()
    },
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
      const start = tab.raw.length
      const home = () => tab.xterm.buffer.active.type === 'normal' && tab.prompts() > mark && tab.pending === 0
      const left = () => tab.raw.includes('\x1b[?1049l', start)

      const reacted = async (before: number) => {
        const end = performance.now() + 2500
        let size = before
        let still = performance.now()

        while (!home() && !left() && performance.now() < end) {
          await Bun.sleep(20)

          if (tab.raw.length !== size) {
            size = tab.raw.length
            still = performance.now()
          } else if (size > before && performance.now() - still >= 300) {
            return
          }
        }
      }

      for (let i = 0; i < 8 && !home() && !left(); i++) {
        const before = tab.raw.length
        tab.write('\x1b')
        await reacted(before)
      }

      await app.until(home, 10000, 'the TUI never gave the prompt back')
      await app.settle()
    },
    focus: (tab) => app.focus(tab),
    async appear(mode) {
      for (const one of [app, ...extra]) {
        one.appear(mode)
      }

      for (const one of [app, ...extra]) {
        await one.settle()
      }
    },
    async look(label, options) {
      const tab = options.at ?? app.front

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

      if (options.mode !== undefined) {
        put(label, 'mode', wornMode(fixture.place.home), options.mode)
      }

      if (want.opacity !== undefined) {
        put(label, 'opacity', seen.opacity, want.opacity, ['pictures'])
      }

      let text: string | undefined

      if (options.text) {
        text = normalized(tab.screen(fixture.place.home))
        put(label, 'text', digest(text), undefined, [...fresh, ...(options.text === true ? [] : [options.text])])
        recorder.screens.set(`${app.term} ${journey.id}.${label}`, text)
      }

      if (recorder.shows.some((pattern) => glob(pattern, `${journey.id}.${label}`))) {
        recorder.say(
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
        launch: (tab, line, marker) => launch(other, tab, line, marker),
        focus: (tab) => other.focus(tab),
        leave: () => other.leave(),
        async appear(mode) {
          for (const one of new Set([other, app, ...extra])) {
            one.appear(mode)
          }

          await other.settle()
          await app.settle()
        },
        async look(label, options) {
          const tab = options.at ?? other.front

          if (!tab) {
            throw new Error(`look ${label}: no ${terminal} tab`)
          }

          const seen = other.look(tab)
          const want = expected(options)
          put(label, 'colors', seen.colors, want.colors)
          put(label, 'picture', seen.picture, want.picture)

          if (!options.busy) {
            put(label, 'wears', await other.wears(tab), want.wears)
          }

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
