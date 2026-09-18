import { Command, CommanderError, Option } from 'commander'
import pkg from '../package.json' with { type: 'json' }
import { build, TERMINALS } from './build.ts'
import { runFind } from './find.ts'
import { runInit } from './init.ts'
import { runAdd, runBrowse, runDefault, runList, runRemove, runUpdate } from './market.ts'

export function createProgram(): Command {
  const program = new Command()

  program.name('ttheme').description(pkg.description).version(pkg.version).showHelpAfterError().exitOverride()

  program
    .command('build')
    .description('emit dist/ for every terminal, plus the zsh palette table')
    .addOption(new Option('--only <terminal...>', 'rebuild just these terminals').choices(TERMINALS))
    .action((opts: { only?: string[] }) => build(opts))

  program
    .command('init')
    .description('install the palettes and wire your terminal configs')
    .option('--yes', 'accept every default without prompting')
    .action((opts: { yes?: boolean }) => runInit(opts))

  program
    .command('browse')
    .description('pick palettes from the catalog in a live picker')
    .action(() => runBrowse())

  program
    .command('list')
    .argument('[query]', 'match a palette, series or ANSI source')
    .description('show the catalog, marking what is installed')
    .action((query?: string) => runList(query))

  program
    .command('add')
    .argument('<palette...>')
    .description('install palettes from the catalog')
    .action((names: string[]) => runAdd(names))

  program
    .command('remove')
    .argument('<palette...>')
    .description('uninstall palettes')
    .action((names: string[]) => runRemove(names))

  program
    .command('default')
    .argument('<palette>')
    .description('make an installed palette the one new tabs open with')
    .action((name: string) => runDefault(name))

  program
    .command('find', { hidden: true })
    .argument('<palette>')
    .description('pick a safebooru background for a palette — preview opens this on tab')
    .action(async (name: string) => {
      process.exitCode = await runFind(name)
    })

  program
    .command('update')
    .description('refresh the catalog from the registry')
    .action(() => runUpdate())

  return program
}

export async function runCli(argv: readonly string[]): Promise<number> {
  try {
    await createProgram().parseAsync(argv)
    return Number(process.exitCode ?? 0)
  } catch (error) {
    if (error instanceof CommanderError) {
      return error.exitCode
    }
    console.error(`\n${error instanceof Error ? error.message : String(error)}`)
    return 1
  }
}
