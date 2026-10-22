import { dimOf } from '../frame'
import type { Frame } from '../frameContext'
import { MEMBER_NAMES, axisIndex, others, sideName } from '../geometry'
import type { Axis, CutGroup, FrameNode, HeadType, Member, Profile, Side } from '../types'
import { formatLength } from '../units'

export type HeadSpec = { diameter: number; height: number; hexKey: number }

// Head geometry by nominal thread: ISO 7380 button head / ISO 4762 socket head.
const HEADS: Record<number, Record<HeadType, HeadSpec>> = {
  4: { BHCS: { diameter: 7.6, height: 2.2, hexKey: 2.5 }, SHCS: { diameter: 7.0, height: 4.0, hexKey: 3 } },
  5: { BHCS: { diameter: 9.5, height: 2.75, hexKey: 3 }, SHCS: { diameter: 8.5, height: 5.0, hexKey: 4 } },
  6: { BHCS: { diameter: 10.5, height: 3.3, hexKey: 4 }, SHCS: { diameter: 10.0, height: 6.0, hexKey: 5 } },
}

export const HEAD_LABELS: Record<HeadType, string> = {
  BHCS: 'button head (BHCS)',
  SHCS: 'socket head (SHCS)',
}

export function headSpec(nominal: number, type: HeadType): HeadSpec {
  const table = HEADS[nominal]
  if (!table) throw new Error(`no head data for M${nominal}`)
  return table[type]
}

/** Common metric screw lengths, mm. */
export const SCREW_LENGTHS = [6, 8, 10, 12, 14, 16, 20, 25, 30, 35, 40]

export const fmtFor = (frame: Frame) => (mm: number) => formatLength(mm, frame.design.units)

/** One owner/butting pair at a corner node, with coordinates resolved. */
export interface ButtJoint {
  node: FrameNode
  /** Owner axis and the butting member's axis; T is the remaining axis. */
  O: Axis
  B: Axis
  T: Axis
  owner: Member
  butting: Member
  sO: Side
  sB: Side
  sT: Side
  /** Coordinate `inset` mm in from the node's side of the frame along `axis`. */
  at(axis: Axis, inset: number): number
  /** +1 if moving away from this node along `axis` increases the coordinate. */
  inward(axis: Axis): 1 | -1
}

/** Every owner/butting pair in an owner-scheme frame (two per corner). */
export function buttJoints(frame: Frame): ButtJoint[] {
  const out: ButtJoint[] = []
  for (const node of frame.nodes) {
    const O = node.owner
    if (!O) throw new Error('this joint method needs a corner owner')
    for (const B of others(O)) {
      const T = others(O).find((a) => a !== B)!
      const side = (a: Axis) => node.corner[axisIndex(a)]
      out.push({
        node,
        O,
        B,
        T,
        owner: frame.member(node.members[O]),
        butting: frame.member(node.members[B]),
        sO: side(O),
        sB: side(B),
        sT: side(T),
        at: (axis, inset) => (side(axis) === 0 ? inset : dimOf(frame.ext, axis) - inset),
        inward: (axis) => (side(axis) === 0 ? 1 : -1),
      })
    }
  }
  return out
}

export function plural(axis: Axis): string {
  return `${MEMBER_NAMES[axis].toLowerCase()}s`
}

export function labelsFor(frame: Frame, axis: Axis): string {
  return [...new Set(frame.members.filter((m) => m.axis === axis).map((m) => m.group))].sort().join(', ')
}

export function groupList(labels: string[]): string {
  return labels.length === 1 ? `group ${labels[0]}` : `groups ${labels.join(', ')}`
}

export function cutStep(groups: CutGroup[]): string {
  const total = groups.reduce((n, g) => n + g.qty, 0)
  return `Cut all ${total} members to length (see cut list). Cut each group in one batch against a stop block so matching parts are identical, then deburr and check every end is square.`
}

export function tapStep(frame: Frame, groups: CutGroup[], depth: number): string | null {
  const { profile } = frame
  const tapped = groups.filter((g) => g.ends.some(Boolean))
  if (!tapped.length) return null
  const count = tapped.reduce((n, g) => n + g.qty * g.ends.filter(Boolean).length, 0)
  const bore =
    profile.centerBore === profile.endTap.drill
      ? `The ${profile.centerBore} mm centre bore is already tap-drill size — no drilling needed.`
      : `Drill the centre bore to Ø${profile.endTap.drill} first.`
  return `Tap both ends of every member in ${groupList(tapped.map((g) => g.label))} — ${count} ends — ${profile.endTap.thread}, ${fmtFor(frame)(depth)} deep. ${bore}`
}

/** Owner-scheme assembly: build two opposite faces, then join them. `how` says how one joint is made. */
export function faceAssemblySteps(frame: Frame, how: string): string[] {
  const O = frame.nodes[0].owner!
  const B: Axis = O === 'z' ? 'y' : 'z'
  const A = others(O).find((a) => a !== B)!
  return [
    `Build the ${sideName(B, 0)} frame: join two ${plural(A)} (${labelsFor(frame, A)}) between the ends of two ${plural(O)} (${labelsFor(frame, O)}). ${how} Snug only — don't fully tighten yet.`,
    `Build the ${sideName(B, 1)} frame the same way.`,
    `Join the two frames with the four ${plural(B)} (${labelsFor(frame, B)}), same joint at each end, and snug.`,
  ]
}

export function squareStep(frame: Frame, tighten: string): string {
  return `Square the frame: on each face, measure the corner-to-corner diagonals and nudge until they match within ~${fmtFor(frame)(1)} (targets in the diagonal table). Then ${tighten} and re-check.`
}

export function tappingTools(profile: Profile): string[] {
  return [
    `${profile.endTap.thread} tap + tap handle (spiral-point or forming tap works well in aluminium)`,
    ...(profile.centerBore === profile.endTap.drill ? [] : [`Ø${profile.endTap.drill} mm tap drill`]),
    'Cutting fluid / WD-40 for tapping',
  ]
}

export const BASE_TOOLS = [
  'Saw with a stop block (chop/mitre saw with non-ferrous blade)',
  'Deburring tool or file',
  "Engineer's square and tape measure",
]

/** Engagement / tap-depth sanity for a screw threaded into an end tap. */
export function engagementWarnings(frame: Frame, size: string, screwLength: number, consumed: number, consumedWhat: string, tapDepth: number): string[] {
  const fmt = fmtFor(frame)
  const d = frame.profile.endTap.nominal
  const engagement = screwLength - consumed
  const out: string[] = []
  if (engagement < 1.5 * d)
    out.push(
      `Thread engagement is only ${fmt(engagement)} (${size}×${screwLength} minus ${fmt(consumed)} ${consumedWhat}). Aim for ≥ ${fmt(1.5 * d)} in aluminium — use a longer screw.`,
    )
  if (tapDepth < engagement + 1)
    out.push(`Tap depth ${fmt(tapDepth)} is too shallow for ${fmt(engagement)} of thread engagement — tap at least ${fmt(Math.ceil(engagement + 1))}.`)
  return out
}

/** Box from per-axis inset ranges, measured in from a joint's node. */
export function insetBox(at: (axis: Axis, inset: number) => number, r: Record<Axis, [number, number]>): { min: [number, number, number]; max: [number, number, number] } {
  const lo = (a: Axis) => Math.min(at(a, r[a][0]), at(a, r[a][1]))
  const hi = (a: Axis) => Math.max(at(a, r[a][0]), at(a, r[a][1]))
  return { min: [lo('x'), lo('y'), lo('z')], max: [hi('x'), hi('y'), hi('z')] }
}

/** Range record helper: ranges for O, B and T axes of a butt joint. */
export function ranges(j: ButtJoint, o: [number, number], b: [number, number], t: [number, number]): Record<Axis, [number, number]> {
  const r = {} as Record<Axis, [number, number]>
  r[j.O] = o
  r[j.B] = b
  r[j.T] = t
  return r
}
