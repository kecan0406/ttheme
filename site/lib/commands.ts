import generated from '@/commands.json' with { type: 'json' }
import { type Heading, slugOf } from '@/lib/markdown'

export interface Command {
  name: string
  usage: string
  head: string
  about: string
  actions: [string, string][]
  flags: [string, string][]
  notes: string[]
  exits: boolean
}

export interface CommandSection {
  title: string
  commands: Command[]
}

export interface Commands {
  sections: CommandSection[]
  exits: [string, string][]
}

export const COMMANDS = generated as Commands

export function sectionId(section: CommandSection): string {
  return slugOf(section.title)
}

export function commandsToc(commands: Commands): Heading[] {
  return commands.sections.flatMap((section) => [
    { depth: 2 as const, id: sectionId(section), text: section.title },
    ...section.commands.map((command) => ({ depth: 3 as const, id: command.name, text: command.name })),
  ])
}
