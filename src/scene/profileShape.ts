import * as THREE from 'three'
import type { Profile } from '../engine'

/** Extrusion cross-section, centred on the origin: 4 T-slots + centre bore. */
export function profileShape(p: Profile): THREE.Shape {
  const h = p.size / 2
  const o = p.slotOpening / 2
  const lip = p.slotLipThickness
  const cw = p.slotCavityWidth / 2
  const floor = h - p.slotDepth

  // Cavity side walls. With a known web thickness the wall is the face of the
  // 45° diagonal web (line y = x + off); otherwise a generic short shoulder + slope.
  let shoulderY: number
  let floorX: number
  if (p.webThickness) {
    const off = (p.webThickness / 2) * Math.SQRT2
    shoulderY = Math.min(cw + off, h - lip)
    floorX = Math.max(floor - off, 0.5)
  } else {
    shoulderY = h - lip - Math.min(0.8, (p.slotDepth - lip) / 3)
    floorX = o * 0.9
  }

  const mouth: [number, number][] = p.slotMouth
    ? [
        [-p.slotMouth.width / 2, h],
        [-p.slotMouth.width / 2, h - p.slotMouth.depth],
        [-o, h - p.slotMouth.depth],
      ]
    : [[-o, h]]
  const mirror = (pts: [number, number][]) => pts.map(([x, y]) => [-x, y] as [number, number]).reverse()

  // Corner + one slot along the top edge, left → right. Rotating it 4× clockwise traces the outline.
  const left: [number, number][] = [...mouth, [-o, h - lip], [-cw, h - lip], [-cw, shoulderY], [-floorX, floor]]
  const side: [number, number][] = [[-h, h], ...left, ...mirror(left)]

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
