import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

export const SKILL = 'ttheme-palette'

export const SKILL_FORMAT = 3

export const SKILL_TARGETS = ['agents', 'claude'] as const

export type SkillTarget = (typeof SKILL_TARGETS)[number]

export const SKILL_LABELS: Readonly<Record<SkillTarget, string>> = {
  agents: 'Codex, Cline, Warp, Zed and the other agents that read ~/.agents/skills',
  claude: 'Claude Code',
}

export interface AgentHomes {
  home: string
  claude: string
}

export interface Placed {
  placed: SkillTarget[]
  failed: string[]
}

const PLUGINS = join('plugins', 'installed_plugins.json')

export function agentHomes(home: string, env: NodeJS.ProcessEnv): AgentHomes {
  return { home, claude: env.CLAUDE_CONFIG_DIR ?? join(home, '.claude') }
}

export function skillPath(target: SkillTarget, { home, claude }: AgentHomes): string {
  return target === 'agents' ? join(home, '.agents', 'skills', SKILL) : join(claude, 'skills', SKILL)
}

export function detectedSkill(env: NodeJS.ProcessEnv): SkillTarget | undefined {
  if (env.CLAUDECODE || env.CLAUDE_CODE) return 'claude'

  return env.CODEX_SANDBOX || env.CODEX_CI || env.CODEX_THREAD_ID ? 'agents' : undefined
}

export function offeredSkills({ home, claude }: AgentHomes): SkillTarget[] {
  return SKILL_TARGETS.filter((target) =>
    target === 'claude' ? existsSync(claude) : [join(home, '.agents'), join(home, '.codex')].some(existsSync),
  )
}

function present(path: string): boolean {
  try {
    lstatSync(path)

    return true
  } catch {
    return false
  }
}

function pluginHolds(claude: string): boolean {
  try {
    return readFileSync(join(claude, PLUGINS), 'utf8').includes(`"${SKILL}@`)
  } catch {
    return false
  }
}

export function heldElsewhere(target: SkillTarget, homes: AgentHomes, ours: readonly SkillTarget[]): boolean {
  if (target === 'claude' && pluginHolds(homes.claude)) return true

  return !ours.includes(target) && present(skillPath(target, homes))
}

function sameFolder(a: string, b: string): boolean {
  try {
    return realpathSync(a) === realpathSync(b)
  } catch {
    return false
  }
}

function place(target: SkillTarget, from: string, homes: AgentHomes, placed: readonly SkillTarget[]): void {
  const to = skillPath(target, homes)
  const canonical = skillPath('agents', homes)
  const linked = target === 'claude' && placed.includes('agents')

  if (linked && sameFolder(dirname(to), dirname(canonical))) return

  rmSync(to, { recursive: true, force: true })
  mkdirSync(dirname(to), { recursive: true })

  if (!linked) {
    cpSync(from, to, { recursive: true })

    return
  }

  try {
    symlinkSync(relative(dirname(to), canonical), to, 'dir')
  } catch {
    cpSync(canonical, to, { recursive: true })
  }
}

export function placeSkill(root: string, targets: readonly SkillTarget[], homes: AgentHomes): Placed {
  const from = join(root, 'skills', SKILL)
  const order = SKILL_TARGETS.filter((target) => targets.includes(target))
  const placed: SkillTarget[] = []
  const failed: string[] = []

  for (const target of order) {
    try {
      place(target, from, homes, placed)
      placed.push(target)
    } catch (error) {
      failed.push(`${skillPath(target, homes)} — ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return { placed, failed }
}

export function placedSkills(targets: readonly SkillTarget[], homes: AgentHomes): string[] {
  return SKILL_TARGETS.flatMap((target) => (targets.includes(target) ? [skillPath(target, homes)] : [])).filter(present)
}
