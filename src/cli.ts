import { Command, CommanderError, Option } from 'commander'
import pkg from '../package.json' with { type: 'json' }
import { build, TERMINALS } from './build.ts'
import { runInit } from './init.ts'

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
    .option('--link', 'symlink from this checkout instead of copying')
    .action((opts: { yes?: boolean; link?: boolean }) => runInit(opts))

  return program
}

export async function runCli(argv: readonly string[]): Promise<number> {
  try {
    await createProgram().parseAsync(argv)
    return 0
  } catch (error) {
    if (error instanceof CommanderError) {
      return error.exitCode
    }
    console.error(`\n${error instanceof Error ? error.message : String(error)}`)
    return 1
  }
}
