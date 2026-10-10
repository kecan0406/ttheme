import { FACET_DRIFT, FACET_HEIGHT, FACET_WIDTH, facetFace, facetMesh, facetPoints } from '@/lib/facets'

const MESH = facetMesh()
const VIEW = `0 0 ${FACET_WIDTH} ${FACET_HEIGHT + FACET_DRIFT}`

export function FacetGround() {
  return (
    <facet-ground style={`--facet-width:${FACET_WIDTH};--facet-height:${FACET_HEIGHT};--facet-drift:${FACET_DRIFT}`}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox={VIEW} preserveAspectRatio="none" aria-hidden="true">
        <g id="facet-mesh">
          {MESH.facets.map((facet) => {
            const face = facetFace(MESH, facet)
            return (
              <polygon
                class={`t${facet.tone}`}
                points={facetPoints(MESH, facet)}
                style={`--t:${facet.tint};--lit:${face.lit};--cx:${face.cx};--cy:${face.cy}`}
              />
            )
          })}
        </g>
      </svg>
      <div class="lamp">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox={VIEW} preserveAspectRatio="none" aria-hidden="true" />
      </div>
    </facet-ground>
  )
}
