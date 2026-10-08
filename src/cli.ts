import { type ParseArgsOptionsConfig, parseArgs } from 'node:util'
import pkg from '../package.json' with { type: 'json' }
import { runBrowse } from './browse.ts'
import { build } from './build.ts'
import { Cancelled } from './cancelled.ts'
import { runCheck, runEdit, runNew, runShare, runTone, shareThisTab, thisTab } from './craft.ts'
import { runFind } from './find/find.ts'
import { runBake, runFlatten, runImage } from './images.ts'
import { runInfo } from './info.ts'
import { runInit } from './init.ts'
import { runAdd, runDefault, runList, runOff, runOn, runRemove, runSync, runUpdate } from './installs.ts'
import { runMarketplace } from './marketplaces.ts'
import { startNamesUpdate, updateNames } from './names-update.ts'
import { runRedraw } from './redraw.ts'
import { autoRefresh } from './refresh.ts'
import { checkLatest, startReleaseCheck, tellRelease } from './release.ts'
import { Signalled } from './tui/terminal.ts'
import { runUninstall } from './uninstall.ts'
import { briefText, commandHelp, helpText, VERB_SPECS, type VerbSpec } from './verbs.ts'
import { runWire } from './wire.ts'

interface Flags {
  yes?: boolean
  only?: string[]
  json?: boolean
  fix?: boolean
  from?: string
  in?: string
  marketplace?: string
  tone?: string
}

const REFRESHES = new Set(['add', 'remove', 'marketplace', 'default', 'on', 'off'])

interface Verb extends VerbSpec {
  run?(args: string[], flags: Flags): unknown
}

const RUNS: Record<string, Verb['run']> = {
  default: ([name]) => runDefault(name as string),
  on: () => runOn(),
  off: () => runOff(),
  browse: () => runBrowse(),
  list: ([query], { json }) => runList(query, json),
  add: (names, { marketplace }) => runAdd(names, marketplace),
  remove: (names) => runRemove(names),
  update: (marketplaces) => runUpdate(marketplaces),
  marketplace: ([action, arg]) => runMarketplace(action, arg),
  new: ([name], { from, in: into }) => runNew(name as string, from, into),
  edit: async (args) => runEdit(await paletteOf(args, 'edit')),
  check: async (args, { fix }) => runCheck(await paletteOf(args, 'check'), fix),
  share: async ([name], { tone }) => {
    const asked = tone as 'tuned' | 'original' | undefined
    if (name !== undefined) {
      return runShare(name, asked)
    }
    const here = await shareThisTab(asked)
    if (!here) {
      throw new UsageError('name a palette', verbNamed('share'))
    }
    return runShare(here.name, here.tone)
  },
  init: (_, { yes }) => runInit({ yes }),
  uninstall: (_, { yes }) => runUninstall(yes),
  wire: ([name]) => runWire(name as string),
  info: () => runInfo(),
  build: (_, { only }) => build({ only }),
  find: ([name]) => runFind(name as string),
  image: ([name, action, key]) => runImage(name as string, action as string, key),
  sync: () => runSync(),
  redraw: () => runRedraw(),
  names: () => updateNames(),
  latest: () => checkLatest(),
  tone: ([name, action, width]) => runTone(name as string, action as string, width),
  flatten: ([source, out, background, opacity, canvas, place, into]) =>
    runFlatten(source as string, out as string, background as string, opacity as string, canvas, place, into),
  bake: ([source, out, canvas, place]) => runBake(source as string, out as string, canvas as string, place as string),
}

export const VERBS: Verb[] = VERB_SPECS.map((spec) => ({ ...spec, run: RUNS[spec.name] }))

type Invocation =
  | { kind: 'brief' }
  | { kind: 'help'; verb?: Verb; all?: boolean }
  | { kind: 'version' }
  | { kind: 'run'; verb: Verb; args: string[]; flags: Flags }

export class UsageError extends Error {
  readonly verb: Verb | undefined

  constructor(message: string, verb?: Verb) {
    super(message)
    this.verb = verb
  }
}

function verbNamed(name: string): Verb {
  const verb = VERBS.find((v) => v.name === name)
  if (!verb) {
    throw new UsageError(name.startsWith('-') ? `unknown option '${name}'` : `unknown command '${name}'`)
  }
  return verb
}

async function paletteOf([name]: string[], verb: string): Promise<string> {
  const chosen = name ?? (await thisTab())
  if (chosen === undefined) {
    const worn = process.env.TTHEME_WORN
    throw new UsageError(`name a palette${worn ? ` — this tab wears ${worn}` : ''}`, verbNamed(verb))
  }
  return chosen
}

function parseFlags(verb: Verb, args: string[]) {
  const options: ParseArgsOptionsConfig = { help: { type: 'boolean', short: 'h' } }
  for (const [name, { type, short, multiple }] of Object.entries(verb.flags ?? {})) {
    options[name] = { type, multiple: multiple === true, ...(short ? { short } : {}) }
  }
  try {
    return parseArgs({ args, options, allowPositionals: true })
  } catch (error) {
    const [message = ''] = (error instanceof Error ? error.message : String(error)).split('. ')
    throw new UsageError(`${message.charAt(0).toLowerCase()}${message.slice(1)}`, verb)
  }
}

export function parse(argv: readonly string[]): Invocation {
  const [first, ...rest] = argv
  if (first === undefined) {
    return { kind: 'brief' }
  }
  if (first === '-h' || first === '--help') {
    return { kind: 'help' }
  }
  if (first === '-v' || first === '--version') {
    return { kind: 'version' }
  }
  if (first === 'help') {
    if (rest[0] === undefined || rest[0] === 'all') {
      return { kind: 'help', all: rest[0] === 'all' }
    }
    return { kind: 'help', verb: verbNamed(rest[0]) }
  }
  const verb = verbNamed(first)
  const parsed = parseFlags(verb, rest)
  if (parsed.values.help) {
    return { kind: 'help', verb }
  }
  for (const [name, { choices }] of Object.entries(verb.flags ?? {})) {
    for (const value of [parsed.values[name] ?? []].flat()) {
      if (choices && !choices.includes(String(value))) {
        throw new UsageError(`--${name} takes ${choices.join(', ')} — not ${value}`, verb)
      }
    }
  }
  const args = parsed.positionals
  const least = verb.args.filter((a) => a.startsWith('<')).length
  const most = verb.args.some((a) => a.includes('...')) ? Number.POSITIVE_INFINITY : verb.args.length
  if (args.length < least) {
    throw new UsageError(`missing ${verb.args[args.length]}`, verb)
  }
  if (args.length > most) {
    throw new UsageError(`too many arguments: ${args.slice(most).join(' ')}`, verb)
  }
  const { help: _, ...given } = parsed.values
  return { kind: 'run', verb, args, flags: given as Flags }
}

const CRASHES = [TypeError, RangeError, ReferenceError, SyntaxError]

export function isCrash(error: unknown): boolean {
  return CRASHES.some((kind) => error instanceof kind) || (error instanceof Error && 'code' in error)
}

export async function runCli(argv: readonly string[]): Promise<number> {
  let running: Verb | undefined
  try {
    const call = parse(argv)
    if (call.kind === 'version') {
      console.log(pkg.version)
      return 0
    }
    if (call.kind === 'brief') {
      console.error(briefText())
      return 1
    }
    if (call.kind === 'help') {
      console.log(call.verb ? commandHelp(call.verb) : helpText(call.all === true))
      return 0
    }
    running = call.verb
    if (!call.verb.run) {
      throw new Error('runs in the shell layer — open a new tab once `ttheme init` has wired it')
    }
    if (REFRESHES.has(call.verb.name)) {
      await autoRefresh()
    }
    const code = await call.verb.run(call.args, call.flags)
    if (!call.verb.hidden && call.verb.name !== 'uninstall') {
      startNamesUpdate()
      if (call.verb.name !== 'update' && call.verb.name !== 'init') {
        startReleaseCheck()
        tellRelease()
      }
    }
    return typeof code === 'number' ? code : 0
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(
        error.verb
          ? `ttheme ${error.verb.name}: ${error.message}\n\n${commandHelp(error.verb)}`
          : `ttheme: ${error.message} — see \`ttheme help\``,
      )
      return 1
    }
    if (error instanceof Cancelled) {
      return 1
    }
    if (error instanceof Signalled) {
      return error.exit
    }
    const detail = process.env.TTHEME_DEBUG && error instanceof Error ? error.stack : undefined
    console.error(
      `\nttheme${running ? ` ${running.name}` : ''}: ${detail ?? (error instanceof Error ? error.message : String(error))}${isCrash(error) ? '\nReport a bug with the output of `ttheme info`' : ''}`,
    )
    return 1
  }
}
