import { Command, CommanderError, Option } from 'commander'
import pkg from '../package.json' with { type: 'json' }
import { build, TERMINALS } from './build.ts'

export function createProgram(): Command {
  const program = new Command()

  program.name('ttheme').description(pkg.description).version(pkg.version).showHelpAfterError().exitOverride()

  program
    .command('build')
    .description('emit dist/ for every terminal, plus the zsh palette table')
    .addOption(new Option('--only <terminal...>', 'rebuild just these terminals').choices(TERMINALS))
    .action((opts: { only?: string[] }) => build(opts))

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

if (import.meta.main) {
  process.exitCode = await runCli(process.argv)
}
