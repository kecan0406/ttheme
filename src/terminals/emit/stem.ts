import { STEM_RULES } from '../../core/theme.ts'

export function stemPython(value: string): string {
  return STEM_RULES.reduce((text, [from, to]) => `${text}.replace('${from}', '${to}', 1)`, value)
}

export function stemLua(value: string): string {
  return STEM_RULES.reduce((text, [from, to]) => `(${text}:gsub('${from}', '${to}', 1))`, value)
}

export function stemZsh(value: string): string {
  return STEM_RULES.reduce((text, [from, to]) => `\${${text}/${from === '/' ? '\\/' : from}/${to}}`, value)
}
