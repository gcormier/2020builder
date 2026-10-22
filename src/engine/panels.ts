import { dimOf } from './frame'
import { axisIndex, faceAxis, others } from './geometry'
import type { Box } from './sizing'
import type { Axis, FaceName, Joint, Panel, PanelGroup, PanelMaterial, PanelOptions, Profile, Side, Vec3 } from './types'
import { formatLength } from './units'

export const FACES: Record<FaceName, { axis: Axis; side: Side }> = {
  front: { axis: 'y', side: 0 },
  back: { axis: 'y', side: 1 },
  left: { axis: 'x', side: 0 },
  right: { axis: 'x', side: 1 },
  bottom: { axis: 'z', side: 0 },
  top: { axis: 'z', side: 1 },
}

export const MATERIALS: Record<PanelMaterial, { name: string; color: string; opacity: number }> = {
  acrylic: { name: 'Clear acrylic', color: '#9fd3ff', opacity: 0.3 },
  abs: { name: 'Black ABS', color: '#1c1d20', opacity: 0.92 },
  polycarbonate: { name: 'Polycarbonate', color: '#cfe8d8', opacity: 0.35 },
  acm: { name: 'ACM / Dibond', color: '#d9dce0', opacity: 0.95 },
  wood: { name: 'Plywood / MDF', color: '#c9a36b', opacity: 0.95 },
}

type AABB = { min: Vec3; max: Vec3 }

/** Joint hardware as boxes: screw heads, shanks and connector bodies. */
function obstacles(joints: Joint[]): AABB[] {
  const out: AABB[] = []
  for (const j of joints) {
    for (const c of j.connectors) out.push(...c.boxes)
    for (const f of j.fasteners) {
      const k = axisIndex(faceAxis(f.dir))
      const s = f.dir[0] === '-' ? -1 : 1
      const cyl = (center: number, half: number, r: number): AABB => {
        const min = f.headCenter.map((v) => v - r) as Vec3
        const max = f.headCenter.map((v) => v + r) as Vec3
        min[k] = center - half
        max[k] = center + half
        return { min, max }
      }
      out.push(cyl(f.headCenter[k], f.headHeight / 2, f.headDiameter / 2))
      const shankMid = f.headCenter[k] + s * (f.headHeight / 2 + f.length / 2)
      out.push(cyl(shankMid, f.length / 2, f.diameter / 2))
    }
  }
  return out
}

const ceilHalf = (n: number) => Math.ceil(n * 2) / 2

/** Slot-inserted sheet panels for the selected faces, sized from the opening plus groove depth. */
export function computePanels(
  opts: PanelOptions,
  profile: Profile,
  ext: Box,
  joints: Joint[],
  units: 'mm' | 'in',
): { panels: Panel[]; groups: PanelGroup[]; warnings: string[]; notes: string[] } {
  const fmt = (mm: number) => formatLength(mm, units)
  const P = profile.size
  const insert = profile.slotDepth - opts.clearance
  const mat = MATERIALS[opts.material]
  const obs = obstacles(joints)
  const panels: Panel[] = []

  for (const face of opts.faces) {
    const { axis: n, side } = FACES[face]
    const [u, v] = others(n)
    const min: Vec3 = [0, 0, 0]
    const max: Vec3 = [0, 0, 0]
    const nMid = side === 0 ? P / 2 : dimOf(ext, n) - P / 2
    min[axisIndex(n)] = nMid - opts.thickness / 2
    max[axisIndex(n)] = nMid + opts.thickness / 2
    for (const a of [u, v]) {
      min[axisIndex(a)] = P - insert
      max[axisIndex(a)] = dimOf(ext, a) - P + insert
    }

    // Square corner notch that clears every piece of hardware poking into the panel's footprint.
    let notch = 0
    for (const o of obs) {
      const hit = [0, 1, 2].every((k) => Math.min(o.max[k], max[k]) - Math.max(o.min[k], min[k]) > 0.01)
      if (!hit) continue
      const reach = [u, v].map((a) => {
        const k = axisIndex(a)
        const lo = Math.max(o.min[k], min[k]) - min[k]
        const hi = max[k] - Math.min(o.max[k], max[k])
        // Distance from the nearer panel edge to the far side of the obstacle.
        return lo < hi ? Math.min(o.max[k], max[k]) - min[k] : max[k] - Math.max(o.min[k], min[k])
      })
      notch = Math.max(notch, ...reach)
    }
    notch = notch > 0 ? ceilHalf(notch + 0.5) : 0

    panels.push({
      id: `panel-${face}`,
      face,
      group: '',
      width: max[axisIndex(u)] - min[axisIndex(u)],
      height: max[axisIndex(v)] - min[axisIndex(v)],
      thickness: opts.thickness,
      material: opts.material,
      min,
      max,
      color: mat.color,
      opacity: mat.opacity,
      cornerNotch: notch,
    })
  }

  // Group identical sheets (rotation doesn't matter for a cut sheet).
  const groups: PanelGroup[] = []
  for (const p of panels) {
    const [a, b] = [p.width, p.height].sort((x, y) => y - x)
    const g = groups.find((x) => x.width === a && x.height === b && x.cornerNotch === p.cornerNotch)
    if (g) {
      g.qty++
      g.faces.push(p.face)
      p.group = g.label
    } else {
      const label = `P${groups.length + 1}`
      groups.push({ label, width: a, height: b, thickness: p.thickness, material: p.material, qty: 1, faces: [p.face], cornerNotch: p.cornerNotch })
      p.group = label
    }
  }

  const warnings: string[] = []
  const notes: string[] = []
  if (panels.length) {
    if (opts.thickness > profile.slotOpening - 0.2)
      warnings.push(`${fmt(opts.thickness)} panels won't fit the ${fmt(profile.slotOpening)} slot opening.`)
    else if (profile.slotOpening - opts.thickness > 2)
      notes.push(
        `${fmt(opts.thickness)} sheet in a ${fmt(profile.slotOpening)} slot leaves ${fmt(profile.slotOpening - opts.thickness)} of play — add slot gasket / edge trim if you don't want panels to rattle.`,
      )
    if (opts.clearance < 0 || insert <= 1) warnings.push('Panel clearance leaves almost no edge in the slot — reduce it.')
    const notched = groups.filter((g) => g.cornerNotch > 0)
    if (notched.length)
      notes.push(
        `Corner hardware sits where panel corners go: notch all four corners of ${notched.map((g) => `${g.label} (${fmt(g.cornerNotch)} square)`).join(', ')}.`,
      )
  }
  return { panels, groups, warnings, notes }
}
