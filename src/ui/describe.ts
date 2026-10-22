import { formatLength, type CutGroup, type Units } from '../engine'

export function describeEnds(g: CutGroup, units: Units): string {
  const taps = g.ends.filter((t) => t !== null)
  if (!taps.length) return '—'
  const t = taps[0]
  const where = taps.length === 2 ? 'both ends' : 'one end'
  return `Tap ${where} ${t.thread}, ${formatLength(t.depth, units)} deep`
}

export function describeHoles(g: CutGroup, units: Units): string[] {
  const byKind = new Map<string, { diameter: number; offset: number; ends: Set<number>; roles: Set<number>; n: number }>()
  for (const h of g.holes) {
    const key = `${h.diameter}|${h.offset}`
    const k = byKind.get(key) ?? { diameter: h.diameter, offset: h.offset, ends: new Set(), roles: new Set(), n: 0 }
    k.ends.add(h.end)
    k.roles.add(h.faceRole)
    k.n++
    byKind.set(key, k)
  }
  return [...byKind.values()].map((k) => {
    const where = k.ends.size === 2 ? 'each end' : 'one end'
    const faces = [...k.roles].sort().join(' & ')
    return `${k.n}× Ø${k.diameter} mm, ${formatLength(k.offset, units)} from ${where}, face${k.roles.size > 1 ? 's' : ''} ${faces}`
  })
}
