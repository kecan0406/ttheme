import { faceOf, paint, type Theme } from '@/lib/themes'

export function dotColors(theme: Theme): string[] {
  return [
    paint(theme, (shade) => shade.background),
    ...faceOf(theme).map((_, index) => paint(theme, (shade) => faceOf(shade)[index] as string)),
  ]
}

export function Dots({ colors }: { colors?: readonly string[] }) {
  return (
    <span
      aria-hidden="true"
      data-slot="signature-dots"
      style={colors?.map((color, index) => (index === 0 ? `--bg:${color}` : `--sg${index - 1}:${color}`)).join(';')}
    />
  )
}
