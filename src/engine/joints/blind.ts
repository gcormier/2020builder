import { dimOf } from '../frame'
import type { Frame } from '../frameContext'
import { MEMBER_NAMES, axisIndex, face, others, sideName } from '../geometry'
import type { Axis, BlindJointOptions, CutGroup, Joint, MemberOp, Profile, Side, Vec3 } from '../types'
import { formatLength } from '../units'
import type { JointMethod, JointResult } from './types'

type HeadSpec = { diameter: number; height: number; hexKey: number }

// Head geometry by nominal thread: ISO 7380 button head / ISO 4762 socket head.
const HEADS: Record<number, Record<BlindJointOptions['headType'], HeadSpec>> = {
  5: { BHCS: { diameter: 9.5, height: 2.75, hexKey: 3 }, SHCS: { diameter: 8.5, height: 5.0, hexKey: 4 } },
  6: { BHCS: { diameter: 10.5, height: 3.3, hexKey: 4 }, SHCS: { diameter: 10.0, height: 6.0, hexKey: 5 } },
}

const HEAD_LABELS: Record<BlindJointOptions['headType'], string> = {
  BHCS: 'button head (BHCS)',
  SHCS: 'socket head (SHCS)',
}

/** Sensible starting options for a profile's end-tap thread. */
export function recommendedBlindOptions(profile: Profile): BlindJointOptions {
  return profile.endTap.nominal >= 6
    ? { headType: 'BHCS', screwLength: 12, wrenchHoleDiameter: 6, tapDepth: 14 }
    : { headType: 'BHCS', screwLength: 10, wrenchHoleDiameter: 5, tapDepth: 12 }
}

function headOf(profile: Profile, type: BlindJointOptions['headType']): HeadSpec {
  const table = HEADS[profile.endTap.nominal]
  if (!table) throw new Error(`no head data for M${profile.endTap.nominal}`)
  return table[type]
}

/** Shank left exposed under the head: lip thickness plus a little slide clearance. */
function standoffOf(lip: number): number {
  return Math.round((lip + 0.3) * 10) / 10
}

/** Pick the axis whose members join two pre-built faces. */
function connectingAxis(owner: Axis): Axis {
  return owner === 'z' ? 'y' : 'z'
}

function plural(axis: Axis): string {
  return `${MEMBER_NAMES[axis].toLowerCase()}s`
}

function labelsFor(frame: Frame, axis: Axis): string {
  const labels = [...new Set(frame.members.filter((m) => m.axis === axis).map((m) => m.group))]
  return labels.sort().join(', ')
}

function list(labels: string[]): string {
  return labels.length === 1 ? `group ${labels[0]}` : `groups ${labels.join(', ')}`
}

export const blindJoint: JointMethod = {
  id: 'blind',
  name: 'Blind joint (end tap + wrench hole)',
  description:
    'Butting member is tapped at the end (M5 or M6, per profile); a screw head rides in the owner\'s slot and is tightened with a hex key through a wrench hole drilled from the outside face. No brackets, nothing protrudes.',
  ownership: 'owner',

  apply(frame: Frame): JointResult {
    const { profile, ext } = frame
    const opts = frame.design.jointOptions.blind
    const P = profile.size
    const head = headOf(profile, opts.headType)
    const size = `M${profile.endTap.nominal}`
    const lip = profile.slotLipThickness
    const joints: Joint[] = []
    const ops: MemberOp[] = []

    for (const node of frame.nodes) {
      const O = node.owner
      if (!O) throw new Error('blind joint needs a corner owner')
      const owner = frame.member(node.members[O])
      const sO = node.corner[axisIndex(O)]

      for (const B of others(O)) {
        const butting = frame.member(node.members[B])
        const sB = node.corner[axisIndex(B)]
        const T = others(O).find((a) => a !== B)! // remaining axis
        const sT = node.corner[axisIndex(T)]

        ops.push({
          kind: 'tap',
          memberId: butting.id,
          end: sB,
          tap: { thread: profile.endTap.thread, drill: profile.endTap.drill, depth: opts.tapDepth },
        })

        const holeFace = face(B, sB)
        ops.push({
          kind: 'hole',
          memberId: owner.id,
          hole: {
            end: sO,
            offset: P / 2,
            face: holeFace,
            faceRole: owner.outerFaces[0] === holeFace ? 1 : 2,
            diameter: opts.wrenchHoleDiameter,
            note: 'wrench access — drill through into the opposite slot',
          },
        })

        const at = (axis: Axis, side: Side, inset: number) =>
          side === 0 ? inset : dimOf(ext, axis) - inset
        const headCenter: Vec3 = [0, 0, 0]
        headCenter[axisIndex(O)] = at(O, sO, P / 2)
        headCenter[axisIndex(T)] = at(T, sT, P / 2)
        headCenter[axisIndex(B)] = at(B, sB, P - lip - head.height / 2)

        joints.push({
          id: `${node.id}-${B}`,
          nodeId: node.id,
          owner: owner.id,
          ownerEnd: sO,
          butting: butting.id,
          buttingEnd: sB,
          method: 'blind',
          fasteners: [
            {
              kind: opts.headType,
              size,
              diameter: profile.endTap.nominal,
              length: opts.screwLength,
              headDiameter: head.diameter,
              headHeight: head.height,
              headCenter,
              dir: face(B, sB === 0 ? 1 : 0),
            },
          ],
          connectors: [],
        })
      }
    }

    const fmt = (mm: number) => formatLength(mm, frame.design.units)
    const warnings: string[] = []
    const standoff = standoffOf(lip)
    const engagement = opts.screwLength - standoff
    const d = profile.endTap.nominal
    if (engagement < 1.5 * d)
      warnings.push(
        `Thread engagement is only ${fmt(engagement)} (${size}×${opts.screwLength} minus ${fmt(standoff)} stand-off). Aim for ≥ ${fmt(1.5 * d)} in aluminium — use a longer screw.`,
      )
    if (opts.tapDepth < engagement + 1)
      warnings.push(
        `Tap depth ${fmt(opts.tapDepth)} is too shallow for ${fmt(engagement)} of thread engagement — tap at least ${fmt(Math.ceil(engagement + 1))}.`,
      )
    const cavity = profile.slotDepth - lip
    if (head.height > cavity)
      warnings.push(
        `${opts.headType} head is ${fmt(head.height)} tall but the slot cavity is only ~${fmt(cavity)} deep — the head won't slide in. Use BHCS.`,
      )
    if (head.diameter > profile.slotCavityWidth)
      warnings.push(`${opts.headType} head (Ø${fmt(head.diameter)}) is wider than the slot cavity (${fmt(profile.slotCavityWidth)}).`)
    if (profile.endTap.nominal > profile.slotOpening)
      warnings.push(`${size} shank is wider than the ${fmt(profile.slotOpening)} slot opening — the screw can't pass the lips.`)
    if (opts.wrenchHoleDiameter < head.hexKey + 1)
      warnings.push(`Wrench hole Ø${opts.wrenchHoleDiameter} is tight for a ${head.hexKey} mm hex key — use ≥ Ø${head.hexKey + 1}.`)
    if (opts.wrenchHoleDiameter > profile.slotOpening)
      warnings.push(`Wrench hole Ø${opts.wrenchHoleDiameter} mm is wider than the ${fmt(profile.slotOpening)} slot opening and will cut into the lips.`)

    const tools = [
      `${profile.endTap.thread} tap + tap handle (spiral-point or forming tap works well in aluminium)`,
      ...(profile.centerBore === profile.endTap.drill ? [] : [`Ø${profile.endTap.drill} mm tap drill`]),
      `Ø${opts.wrenchHoleDiameter} mm drill bit`,
      `${head.hexKey} mm hex key, long arm (to reach through the wrench holes)`,
      'Centre punch',
      'Saw with a stop block (chop/mitre saw with non-ferrous blade)',
      'Deburring tool or file',
      'Engineer\'s square and tape measure',
      'Cutting fluid / WD-40 for tapping',
    ]

    return {
      joints,
      ops,
      hardware: [
        {
          key: `${size}x${opts.screwLength}-${opts.headType}`,
          category: 'fastener',
          description: `${size}×${opts.screwLength} ${HEAD_LABELS[opts.headType]}`,
          qty: joints.length,
        },
      ],
      tools,
      warnings,
    }
  },

  steps(frame: Frame, groups: CutGroup[]): string[] {
    const { profile } = frame
    const opts = frame.design.jointOptions.blind
    const fmt = (mm: number) => formatLength(mm, frame.design.units)
    const P = profile.size
    const O = frame.nodes[0].owner!
    const B = connectingAxis(O)
    const A = others(O).find((a) => a !== B)!
    const tapped = groups.filter((g) => g.ends.some(Boolean))
    const drilled = groups.filter((g) => g.holes.length > 0)
    const tapCount = tapped.reduce((n, g) => n + g.qty * g.ends.filter(Boolean).length, 0)
    const holeCount = drilled.reduce((n, g) => n + g.qty * g.holes.length, 0)
    const total = groups.reduce((n, g) => n + g.qty, 0)
    const boreNote =
      profile.centerBore === profile.endTap.drill
        ? `The ${profile.centerBore} mm centre bore is already tap-drill size — no drilling needed.`
        : `Drill the centre bore to Ø${profile.endTap.drill} first.`

    return [
      `Cut all ${total} members to length (see cut list). Cut each group in one batch against a stop block so matching parts are identical, then deburr and check every end is square.`,
      `Tap both ends of every member in ${list(tapped.map((g) => g.label))} — ${tapCount} ends — ${profile.endTap.thread}, ${fmt(opts.tapDepth)} deep. ${boreNote}`,
      `Drill wrench holes in ${list(drilled.map((g) => g.label))}: at each end, centre-punch the middle of the slot ${fmt(P / 2)} from the end on both outer faces (faces 1 and 2, adjacent), then drill Ø${opts.wrenchHoleDiameter} mm through the slot floor and core until you break into the opposite slot. ${holeCount} holes. Drill both ends on the same two faces.`,
      `Thread an M${profile.endTap.nominal}×${opts.screwLength} ${opts.headType} into every tapped end, leaving about ${fmt(standoffOf(profile.slotLipThickness))} of shank between the head and the end of the extrusion.`,
      `Build the ${sideName(B, 0)} frame: slide the screw heads of two ${plural(A)} (${labelsFor(frame, A)}) into the slot ends of two ${plural(O)} (${labelsFor(frame, O)}), flush with the ends. Snug them through the wrench holes — don't fully tighten yet.`,
      `Build the ${sideName(B, 1)} frame the same way.`,
      `Join the two frames with the four ${plural(B)} (${labelsFor(frame, B)}): slide their screw heads into the remaining slot ends of the ${plural(O)} and snug.`,
      `Square the frame: on each face, measure the corner-to-corner diagonals and nudge until they match within ~${fmt(1)} (targets in the diagonal table). Then fully tighten every screw through its wrench hole and re-check.`,
    ]
  },
}
