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

const MINOR = new Set(['a', 'an', 'and', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with'])

/* The CLI's help keeps its section titles in sentence case; the docs set them in Title Case. */
export function sectionTitle(section: CommandSection): string {
  return section.title
    .split(' ')
    .map((word, at) => (at > 0 && MINOR.has(word) ? word : `${word.charAt(0).toUpperCase()}${word.slice(1)}`))
    .join(' ')
}

export function commandsToc(commands: Commands): Heading[] {
  return commands.sections.flatMap((section) => [
    { depth: 2 as const, id: sectionId(section), text: sectionTitle(section) },
    ...section.commands.map((command) => ({ depth: 3 as const, id: command.name, text: command.name })),
  ])
}
