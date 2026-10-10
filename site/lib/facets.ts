export const FACET_WIDTH = 1440
export const FACET_HEIGHT = 900
export const FACET_DRIFT = 480

const SIZE = 120
const JITTER = 0.64
const RELIEF = 34
const LIGHT = { x: FACET_WIDTH * 0.22, y: FACET_HEIGHT * 0.12, z: 245 }

type Vertex = { x: number; y: number; z: number }

export type Facet = { corners: [number, number, number]; tone: 0 | 1 | 2; tint: number }

export type FacetMesh = { points: Vertex[]; facets: Facet[] }

export type FacetFace = { cx: number; cy: number; lit: number }

function hash(seed: number): number {
  const wave = Math.sin(seed * 12.9898) * 43758.5453
  return wave - Math.floor(wave)
}

function corners(points: Vertex[], facet: Facet): [Vertex, Vertex, Vertex] {
  return facet.corners.map((corner) => points[corner] as Vertex) as [Vertex, Vertex, Vertex]
}

export function facetMesh(): FacetMesh {
  const columns = Math.ceil(FACET_WIDTH / SIZE) + 3
  const rows = Math.ceil((FACET_HEIGHT + FACET_DRIFT) / SIZE) + 3
  const points = Array.from({ length: rows * columns }, (_, index) => {
    const i = index % columns
    const j = Math.floor(index / columns)
    return {
      x: Math.round((i - 1) * SIZE + (hash(i * 31 + j * 17 + 1) - 0.5) * JITTER * SIZE),
      y: Math.round((j - 1) * SIZE + (hash(i * 13 + j * 29 + 7) - 0.5) * JITTER * SIZE),
      z: hash(i * 7 + j * 11 + 3) * RELIEF,
    }
  })
  const facets: Facet[] = []
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < columns - 1; i++) {
      const a = j * columns + i
      const c = a + columns
      const halves: [number, number, number][] =
        hash(i * 5 + j * 3 + 9) > 0.5
          ? [
              [a, a + 1, c + 1],
              [a, c + 1, c],
            ]
          : [
              [a, a + 1, c],
              [a + 1, c + 1, c],
            ]
      for (const [half, triangle] of halves.entries()) {
        const seed = hash(i * 41 + j * 23 + half * 7 + 5)
        facets.push({
          corners: triangle,
          tone: seed < 0.5 ? 0 : seed < 0.8 ? 1 : 2,
          tint: Math.round((6 + 10 * hash(i * 19 + j * 37 + half * 3 + 11)) * 10) / 10,
        })
      }
    }
  }
  return { points, facets }
}

export function facetPoints(mesh: FacetMesh, facet: Facet): string {
  return corners(mesh.points, facet)
    .map((point) => `${point.x},${point.y}`)
    .join(' ')
}

export function facetFace(mesh: FacetMesh, facet: Facet): FacetFace {
  const [a, b, c] = corners(mesh.points, facet)
  const ux = b.x - a.x
  const uy = b.y - a.y
  const uz = b.z - a.z
  const vx = c.x - a.x
  const vy = c.y - a.y
  const vz = c.z - a.z
  const nx = uy * vz - uz * vy
  const ny = uz * vx - ux * vz
  const nz = ux * vy - uy * vx
  const cx = (a.x + b.x + c.x) / 3
  const cy = (a.y + b.y + c.y) / 3
  const lx = LIGHT.x - cx
  const ly = LIGHT.y - cy
  const toward = (Math.sign(nz) || 1) * (nx * lx + ny * ly + nz * LIGHT.z)
  const lit = Math.max(0, toward / ((Math.hypot(nx, ny, nz) || 1) * Math.hypot(lx, ly, LIGHT.z)))
  return { cx: Math.round(cx), cy: Math.round(cy), lit: Math.round(lit * 100) / 100 }
}
