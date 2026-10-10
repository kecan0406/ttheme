export const FACET_WIDTH = 1440
export const FACET_HEIGHT = 900
export const FACET_DRIFT = 480

const SIZE = 120
const JITTER = 0.64
const RELIEF = 34
const HEIGHT = 200
const GLOW = 220
const BUMP = 30
const REACH = 95
const SHINE = 16
const GLINT = 0.06

export type Point = { x: number; y: number }

export type Vertex = Point & { z: number }

export type Corners = [Vertex, Vertex, Vertex]

export type Facet = { corners: [number, number, number]; tone: 0 | 1 | 2; tint: number }

export type FacetMesh = { points: Vertex[]; facets: Facet[] }

export type Shade = { tint: number; lift: number }

export type Lean = Point & { angle: number }

export const FACET_LAMP: Point = { x: FACET_WIDTH * 0.22, y: FACET_HEIGHT * 0.12 }

const UPRIGHT: Lean = { x: 0, y: -1, angle: 0 }

function hash(seed: number): number {
  const wave = Math.sin(seed * 12.9898) * 43758.5453
  return wave - Math.floor(wave)
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
          tint: Math.round((0.06 + 0.1 * hash(i * 19 + j * 37 + half * 3 + 11)) * 1000) / 1000,
        })
      }
    }
  }
  return { points, facets }
}

export function facetCorners(points: Vertex[], facet: Facet): Corners {
  return facet.corners.map((corner) => points[corner] as Vertex) as Corners
}

export function facetCenter([a, b, c]: Corners): Point {
  return { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 }
}

export function facetPoints(corners: Corners): string {
  return corners.map((point) => `${point.x},${point.y}`).join(' ')
}

export function raise(point: Vertex, pointer: Point, amount: number): Vertex {
  const distance = (point.x - pointer.x) ** 2 + (point.y - pointer.y) ** 2
  return { ...point, z: point.z + amount * BUMP * Math.exp(-distance / (2 * REACH * REACH)) }
}

export function shade(tint: number, [a, b, c]: Corners, lamp: Point, lean: Lean = UPRIGHT): Shade {
  const ux = b.x - a.x
  const uy = b.y - a.y
  const uz = b.z - a.z
  const vx = c.x - a.x
  const vy = c.y - a.y
  const vz = c.z - a.z
  const nx = uy * vz - uz * vy
  const ny = uz * vx - ux * vz
  const nz = ux * vy - uy * vx
  const unit = (Math.sign(nz) || 1) / (Math.hypot(nx, ny, nz) || 1)
  const cos = Math.cos(lean.angle)
  const sin = Math.sin(lean.angle)
  const swing = (ny * lean.x - nx * lean.y) * (1 - cos)
  const rx = (nx * cos + lean.x * nz * sin - lean.y * swing) * unit
  const ry = (ny * cos + lean.y * nz * sin + lean.x * swing) * unit
  const rz = (nz * cos - (lean.x * nx + lean.y * ny) * sin) * unit
  const lx = lamp.x - (a.x + b.x + c.x) / 3
  const ly = lamp.y - (a.y + b.y + c.y) / 3
  const lz = HEIGHT - (a.z + b.z + c.z) / 3
  const reach = Math.hypot(lx, ly, lz) || 1
  const diffuse = Math.max(0, (rx * lx + ry * ly + rz * lz) / reach)
  const half = Math.hypot(lx, ly, lz + reach) || 1
  const glint = Math.max(0, (rx * lx + ry * ly + rz * (lz + reach)) / half) ** SHINE
  const near = Math.exp(-(lx * lx + ly * ly) / (2 * GLOW * GLOW))
  const lift = (diffuse - 0.75) * (0.05 + near * 0.05) + near * 0.03 + glint * GLINT
  return { tint: Math.min(0.5, tint + near * 0.12), lift }
}
