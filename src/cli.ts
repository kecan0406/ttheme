import { type ParseArgsOptionsConfig, parseArgs } from 'node:util'
import pkg from '../package.json' with { type: 'json' }
import { build } from './build.ts'
import { runFind } from './find.ts'
import { runImage } from './images.ts'
import { Cancelled, runInit } from './init.ts'
import { runAdd, runBrowse, runDefault, runList, runOff, runOn, runRemove, runUpdate } from './market.ts'
import { runUninstall } from './uninstall.ts'
import { type Section, VERB_SPECS, type VerbSpec } from './verbs.ts'

export interface Flags {
  yes?: boolean
  only?: string[]
  json?: boolean
}

export interface Verb extends VerbSpec {
  run?(args: string[], flags: Flags): unknown
}

const RUNS: Record<string, Verb['run']> = {
  default: ([name]) => runDefault(name as string),
  on: () => runOn(),
  off: () => runOff(),
  browse: () => runBrowse(),
  list: ([query], { json }) => runList(query, json),
  add: (names) => runAdd(names),
  remove: (names) => runRemove(names),
  update: () => runUpdate(),
  init: (_, { yes }) => runInit({ yes }),
  uninstall: (_, { yes }) => runUninstall(yes),
  build: (_, { only }) => build({ only }),
  find: ([name]) => runFind(name as string),
  image: ([name, action]) => runImage(name as string, action as string),
}

export const VERBS: Verb[] = VERB_SPECS.map((spec) => ({ ...spec, run: RUNS[spec.name] }))

export type Invocation =
  | { kind: 'help'; verb?: Verb; code: number }
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
    return rest[0] === undefined ? { kind: 'help', code: 0 } : { kind: 'help', verb: verbNamed(rest[0]), code: 0 }
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

function usage(verb: Verb): string {
  const flags = Object.entries(verb.flags ?? {}).map(([name, { value }]) => `[--${name}${value ? ` ${value}` : ''}]`)
  return [verb.name, ...flags, ...verb.args].join(' ')
}

function columns(rows: [string, string][], width = Math.max(...rows.map(([left]) => left.length))): string[] {
  return rows.map(([left, right]) => `  ${left.padEnd(width)}  ${right}`)
}

const SECTIONS: Section[] = ['tab', 'catalog', 'setup']

export function help(verb?: Verb): string {
  if (verb) {
    const flags = Object.entries(verb.flags ?? {}).map(([name, { short, value, about }]): [string, string] => [
      `${short ? `-${short}, ` : ''}--${name}${value ? ` ${value}` : ''}`,
      about,
    ])
    return [
      `Usage: ttheme ${usage(verb)}`,
      '',
      verb.about,
      ...(flags.length > 0 ? ['', 'Options:', ...columns(flags)] : []),
    ].join('\n')
  }
  const shown = VERBS.filter((v) => !v.hidden)
  const commands = (section: Section) =>
    shown.filter((v) => v.section === section).map((v): [string, string] => [usage(v), v.about])
  const width = Math.max(...shown.map((v) => usage(v).length))
  return [
    'Usage: ttheme <command>',
    '',
    pkg.description,
    '',
    'Commands:',
    ...SECTIONS.flatMap((section, i) => [...(i > 0 ? [''] : []), ...columns(commands(section), width)]),
    '',
    'Examples:',
    '  npx @kecan0406/ttheme init -y   wire the terminals found here, no prompts',
    '  ttheme add homura madoka        install two palettes',
    '  ttheme use homura              paint this tab with one',
    '  ttheme list --json madoka       the madoka series as JSON',
    '',
    'ttheme <command> --help describes one command · ttheme --version prints the version',
    'https://kecan0406.github.io/ttheme',
  ].join('\n')
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
        console.log(help(call.verb))
      } else {
        console.error(help(call.verb))
      }
      return call.code
    }
    running = call.verb
    if (!call.verb.run) {
      throw new Error('runs in the shell layer — open a new tab once `ttheme init` has wired it')
    }
    const code = await call.verb.run(call.args, call.flags)
    return typeof code === 'number' ? code : 0
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(`ttheme${error.verb ? ` ${error.verb.name}` : ''}: ${error.message}\n\n${help(error.verb)}`)
      return 1
    }
    if (error instanceof Cancelled) {
      return 1
    }
    const detail = process.env.TTHEME_DEBUG && error instanceof Error ? error.stack : undefined
    console.error(
      `\nttheme${running ? ` ${running.name}` : ''}: ${detail ?? (error instanceof Error ? error.message : String(error))}`,
    )
    return 1
  }
}
