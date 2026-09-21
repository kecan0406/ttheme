import { type ParseArgsOptionsConfig, parseArgs } from 'node:util'
import pkg from '../package.json' with { type: 'json' }
import { build, TERMINALS } from './build.ts'
import { runFind } from './find.ts'
import { runImage } from './images.ts'
import { runInit } from './init.ts'
import { runAdd, runBrowse, runDefault, runList, runRemove, runUpdate } from './market.ts'

export interface Flags {
  yes?: boolean
  only?: string[]
}

interface Flag {
  type: 'boolean' | 'string'
  multiple?: true
  value?: string
  choices?: readonly string[]
  about: string
}

export interface Verb {
  name: string
  args: string[]
  about: string
  hidden?: true
  flags?: Record<string, Flag>
  run(args: string[], flags: Flags): unknown
}

export const VERBS: Verb[] = [
  {
    name: 'build',
    args: [],
    about: 'emit dist/ for every terminal, plus the zsh palette table',
    flags: {
      only: {
        type: 'string',
        multiple: true,
        value: '<terminal>',
        choices: TERMINALS,
        about: 'rebuild just this terminal — repeat it for more',
      },
    },
    run: (_, { only }) => build({ only }),
  },
  {
    name: 'init',
    args: [],
    about: 'install the palettes and wire your terminal configs',
    flags: { yes: { type: 'boolean', about: 'accept every default without prompting' } },
    run: (_, { yes }) => runInit({ yes }),
  },
  { name: 'browse', args: [], about: 'pick palettes from the catalog in a live picker', run: () => runBrowse() },
  {
    name: 'list',
    args: ['[query]'],
    about: 'show the catalog, marking what is installed',
    run: ([query]) => runList(query),
  },
  { name: 'add', args: ['<palette...>'], about: 'install palettes from the catalog', run: (names) => runAdd(names) },
  { name: 'remove', args: ['<palette...>'], about: 'uninstall palettes', run: (names) => runRemove(names) },
  {
    name: 'default',
    args: ['<palette>'],
    about: 'make an installed palette the one new tabs open with',
    run: ([name]) => runDefault(name as string),
  },
  {
    name: 'find',
    args: ['<palette>'],
    about: 'pick a safebooru background for a palette — preview opens this on tab',
    hidden: true,
    run: ([name]) => runFind(name as string),
  },
  {
    name: 'image',
    args: ['<palette>', '<action>'],
    about: 'switch a palette between its saved backgrounds, or remove the one shown — preview calls this',
    hidden: true,
    run: ([name, action]) => runImage(name as string, action as string),
  },
  { name: 'update', args: [], about: 'refresh the catalog from the registry', run: () => runUpdate() },
]

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
  for (const [name, { type, multiple }] of Object.entries(verb.flags ?? {})) {
    options[name] = { type, multiple: multiple === true }
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

function columns(rows: [string, string][]): string[] {
  const width = Math.max(...rows.map(([left]) => left.length))
  return rows.map(([left, right]) => `  ${left.padEnd(width)}  ${right}`)
}

export function help(verb?: Verb): string {
  if (verb) {
    const flags = Object.entries(verb.flags ?? {}).map(([name, { value, about }]): [string, string] => [
      `--${name}${value ? ` ${value}` : ''}`,
      about,
    ])
    return [
      `Usage: ttheme ${usage(verb)}`,
      '',
      verb.about,
      ...(flags.length > 0 ? ['', 'Options:', ...columns(flags)] : []),
    ].join('\n')
  }
  return [
    'Usage: ttheme <command>',
    '',
    pkg.description,
    '',
    'Commands:',
    ...columns(VERBS.filter((v) => !v.hidden).map((v): [string, string] => [usage(v), v.about])),
    '',
    'ttheme <command> --help describes one command · ttheme --version prints the version',
  ].join('\n')
}

export async function runCli(argv: readonly string[]): Promise<number> {
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
    const code = await call.verb.run(call.args, call.flags)
    return typeof code === 'number' ? code : 0
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(`ttheme${error.verb ? ` ${error.verb.name}` : ''}: ${error.message}\n\n${help(error.verb)}`)
      return 1
    }
    console.error(`\n${error instanceof Error ? error.message : String(error)}`)
    return 1
  }
}
