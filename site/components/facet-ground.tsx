import {
  FACET_DRIFT,
  FACET_HEIGHT,
  FACET_LAMP,
  FACET_WIDTH,
  facetCorners,
  facetMesh,
  facetPoints,
  shade,
} from '@/lib/facets'

const MESH = facetMesh()
const VIEW = `0 0 ${FACET_WIDTH} ${FACET_HEIGHT + FACET_DRIFT}`

export function FacetGround() {
  return (
    <facet-ground style={`--facet-width:${FACET_WIDTH};--facet-height:${FACET_HEIGHT};--facet-drift:${FACET_DRIFT}`}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox={VIEW} preserveAspectRatio="none" aria-hidden="true">
        {MESH.facets.map((facet) => {
          const corners = facetCorners(MESH.points, facet)
          const { tint, lift } = shade(facet.tint, corners, FACET_LAMP)
          return (
            <polygon
              class={`t${facet.tone}`}
              points={facetPoints(corners)}
              style={`--tint:${(tint * 100).toFixed(2)};--lift:${lift.toFixed(4)}`}
            />
          )
        })}
      </svg>
    </facet-ground>
  )
}
