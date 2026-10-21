import { GLYPH, pathOf, STROKES } from '../../src/core/mark.ts'

const BOX = `${GLYPH.x} ${GLYPH.y} ${GLYPH.width} ${GLYPH.height}`

export function Mark() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={BOX}
      fill="none"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      data-slot="mark"
    >
      {STROKES.map((stroke) => (
        <path d={pathOf(stroke)} stroke={`var(--mark${stroke.tone})`} stroke-width={String(stroke.width)} />
      ))}
    </svg>
  )
}
