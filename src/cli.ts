import { type ParseArgsOptionsConfig, parseArgs } from 'node:util'
import pkg from '../package.json' with { type: 'json' }
import { runBrowse } from './browse.ts'
import { build } from './build.ts'
import { runCheck, runEdit, runNew, runShare } from './craft.ts'
import { runFind } from './find.ts'
import { runBake, runFlatten, runImage } from './images.ts'
import { runInfo } from './info.ts'
import { Cancelled, runInit } from './init.ts'
import { runAdd, runDefault, runList, runOff, runOn, runRemove, runUpdate } from './market.ts'
import { runMarket } from './markets.ts'
import { runRedraw } from './redraw.ts'
import { autoRefresh } from './refresh.ts'
import { runTone } from './tone-server.ts'
import { runUninstall } from './uninstall.ts'
import { helpText, usageOf, VERB_SPECS, type VerbSpec } from './verbs.ts'

export interface Flags {
  yes?: boolean
  only?: string[]
  json?: boolean
  fix?: boolean
  from?: string
  in?: string
  market?: string
  tone?: string
}

const REFRESHES = new Set(['add', 'remove', 'market', 'default', 'on', 'off'])

export interface Verb extends VerbSpec {
  run?(args: string[], flags: Flags): unknown
}

const RUNS: Record<string, Verb['run']> = {
  default: ([name]) => runDefault(name as string),
  on: () => runOn(),
  off: () => runOff(),
  browse: () => runBrowse(),
  list: ([query], { json }) => runList(query, json),
  add: (names, { market }) => runAdd(names, market),
  remove: (names) => runRemove(names),
  update: () => runUpdate(),
  market: ([action, arg]) => runMarket(action, arg),
  new: ([name], { from, in: into }) => runNew(name as string, from, into),
  edit: ([name]) => runEdit(name as string),
  check: ([name], { fix }) => runCheck(name as string, fix),
  share: ([name], { tone }) => runShare(name as string, tone as 'tuned' | 'original' | undefined),
  init: (_, { yes }) => runInit({ yes }),
  uninstall: (_, { yes }) => runUninstall(yes),
  info: () => runInfo(),
  build: (_, { only }) => build({ only }),
  find: ([name]) => runFind(name as string),
  image: ([name, action, key]) => runImage(name as string, action as string, key),
  redraw: () => runRedraw(),
  tone: ([name]) => runTone(name as string),
  flatten: ([source, out, background, opacity, canvas, place]) =>
    runFlatten(source as string, out as string, background as string, opacity as string, canvas, place),
  bake: ([source, out, canvas, place]) => runBake(source as string, out as string, canvas as string, place as string),
}

export const VERBS: Verb[] = VERB_SPECS.map((spec) => ({ ...spec, run: RUNS[spec.name] }))

export type Invocation =
  | { kind: 'help'; verb?: Verb; all?: boolean; code: number }
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
    return { kind: 'help', code: 1 }
  }
  if (first === '-h' || first === '--help') {
    return { kind: 'help', code: 0 }
  }
  if (first === '-V' || first === '--version') {
    return { kind: 'version' }
  }
  if (first === 'help') {
    if (rest[0] === undefined || rest[0] === 'all') {
      return { kind: 'help', all: rest[0] === 'all', code: 0 }
    }
    return { kind: 'help', verb: verbNamed(rest[0]), code: 0 }
  }
  const verb = verbNamed(first)
  const parsed = parseFlags(verb, rest)
  if (parsed.values.help) {
    return { kind: 'help', verb, code: 0 }
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

function rows(pairs: [string, string][]): string[] {
  const width = Math.max(0, ...pairs.map(([left]) => left.length))
  return pairs.map(([left, right]) => `  ${left.padEnd(width)}  ${right}`)
}

export function help(verb?: Verb, all = false): string {
  if (!verb) {
    return helpText(all)
  }
  const flags = Object.entries(verb.flags ?? {}).map(([name, { short, value, about }]): [string, string] => [
    `${short ? `-${short}, ` : ''}--${name}${value ? ` ${value}` : ''}`,
    about,
  ])
  return [
    `Usage: ttheme ${usageOf(verb)}`,
    '',
    verb.about,
    ...(verb.actions ? ['', 'Actions:', ...rows(verb.actions)] : []),
    ...(flags.length > 0 ? ['', 'Options:', ...rows(flags)] : []),
  ].join('\n')
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
    if (call.kind === 'help') {
      if (call.code === 0) {
        console.log(help(call.verb, call.all))
      } else {
        console.error(help(call.verb, call.all))
      }
      return call.code
    }
    running = call.verb
    if (!call.verb.run) {
      throw new Error('runs in the shell layer — open a new tab once `ttheme init` has wired it')
    }
    if (REFRESHES.has(call.verb.name)) {
      await autoRefresh()
    }
    const code = await call.verb.run(call.args, call.flags)
    return typeof code === 'number' ? code : 0
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(
        error.verb
          ? `ttheme ${error.verb.name}: ${error.message}\n\n${help(error.verb)}`
          : `ttheme: ${error.message} — see \`ttheme help\``,
      )
      return 1
    }
    if (error instanceof Cancelled) {
      return 1
    }
    const detail = process.env.TTHEME_DEBUG && error instanceof Error ? error.stack : undefined
    console.error(
      `\nttheme${running ? ` ${running.name}` : ''}: ${detail ?? (error instanceof Error ? error.message : String(error))}${isCrash(error) ? '\nReport a bug with the output of `ttheme info`' : ''}`,
    )
    return 1
  }
}
