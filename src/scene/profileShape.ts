import * as THREE from 'three'
import type { Profile } from '../engine'

/** Simplified extrusion cross-section, centred on the origin: 4 T-slots + centre bore. */
export function profileShape(p: Profile): THREE.Shape {
  const h = p.size / 2
  const o = p.slotOpening / 2
  const lip = p.slotLipThickness
  const cw = p.slotCavityWidth / 2
  const floor = h - p.slotDepth
  const shoulder = Math.min(0.8, (p.slotDepth - lip) / 3)

  // Corner + one slot along the top edge, left → right. Rotating it 4× clockwise traces the outline.
  const side: [number, number][] = [
    [-h, h],
    [-o, h],
    [-o, h - lip],
    [-cw, h - lip],
    [-cw, h - lip - shoulder],
    [-o * 0.9, floor],
    [o * 0.9, floor],
    [cw, h - lip - shoulder],
    [cw, h - lip],
    [o, h - lip],
    [o, h],
  ]
  const pts: THREE.Vector2[] = []
  for (let k = 0; k < 4; k++) {
    for (const [x0, y0] of side) {
      let x = x0
      let y = y0
      for (let r = 0; r < k; r++) [x, y] = [y, -x]
      pts.push(new THREE.Vector2(x, y))
    }
  }
  const shape = new THREE.Shape(pts)
  const bore = new THREE.Path()
  bore.absarc(0, 0, p.centerBore / 2, 0, Math.PI * 2, true)
  shape.holes.push(bore)
  return shape
}
