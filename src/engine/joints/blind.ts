import type { Frame } from '../frameContext'
import { axisIndex, face } from '../geometry'
import type { BlindJointOptions, CutGroup, Joint, MemberOp, Profile, Vec3 } from '../types'
import type { JointMethod, JointResult } from './types'
import {
  BASE_TOOLS,
  HEAD_LABELS,
  buttJoints,
  cutStep,
  engagementWarnings,
  faceAssemblySteps,
  fmtFor,
  groupList,
  headSpec,
  squareStep,
  tapStep,
  tappingTools,
} from './common'

/** Sensible starting options for a profile's end-tap thread. */
export function recommendedBlindOptions(profile: Profile): BlindJointOptions {
  return profile.endTap.nominal >= 6
    ? { headType: 'BHCS', screwLength: 12, wrenchHoleDiameter: 6, tapDepth: 14 }
    : { headType: 'BHCS', screwLength: 10, wrenchHoleDiameter: 5, tapDepth: 12 }
}

/** Shank left exposed under the head: lip thickness plus a little slide clearance. */
function standoffOf(lip: number): number {
  return Math.round((lip + 0.3) * 10) / 10
}

export const blindJoint: JointMethod = {
  id: 'blind',
  name: 'Blind joint (end tap + wrench hole)',
  description:
    "Butting member is tapped at the end; a screw head rides in the owner's slot and is tightened with a hex key through a wrench hole drilled from the outside face. No brackets, nothing protrudes.",
  ownership: 'owner',

  apply(frame: Frame): JointResult {
    const { profile } = frame
    const opts = frame.design.jointOptions.blind
    const P = profile.size
    const d = profile.endTap.nominal
    const head = headSpec(d, opts.headType)
    const size = `M${d}`
    const lip = profile.slotLipThickness
    const joints: Joint[] = []
    const ops: MemberOp[] = []

    for (const j of buttJoints(frame)) {
      const { O, B, T, owner, butting, sO, sB } = j
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

      const headCenter: Vec3 = [0, 0, 0]
      headCenter[axisIndex(O)] = j.at(O, P / 2)
      headCenter[axisIndex(T)] = j.at(T, P / 2)
      headCenter[axisIndex(B)] = j.at(B, P - lip - head.height / 2)

      joints.push({
        id: `${j.node.id}-${B}`,
        nodeId: j.node.id,
        owner: owner.id,
        ownerEnd: sO,
        butting: butting.id,
        buttingEnd: sB,
        method: 'blind',
        fasteners: [
          {
            kind: opts.headType,
            size,
            diameter: d,
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

    const fmt = fmtFor(frame)
    const warnings = engagementWarnings(frame, size, opts.screwLength, standoffOf(lip), 'stand-off', opts.tapDepth)
    const cavity = profile.slotDepth - lip
    if (head.height > cavity)
      warnings.push(
        `${opts.headType} head is ${fmt(head.height)} tall but the slot cavity is only ~${fmt(cavity)} deep — the head won't slide in. Use BHCS.`,
      )
    if (head.diameter > profile.slotCavityWidth)
      warnings.push(`${opts.headType} head (Ø${fmt(head.diameter)}) is wider than the slot cavity (${fmt(profile.slotCavityWidth)}).`)
    if (d > profile.slotOpening)
      warnings.push(`${size} shank is wider than the ${fmt(profile.slotOpening)} slot opening — the screw can't pass the lips.`)
    if (opts.wrenchHoleDiameter < head.hexKey + 1)
      warnings.push(`Wrench hole Ø${opts.wrenchHoleDiameter} is tight for a ${head.hexKey} mm hex key — use ≥ Ø${head.hexKey + 1}.`)
    if (opts.wrenchHoleDiameter > profile.slotOpening)
      warnings.push(`Wrench hole Ø${opts.wrenchHoleDiameter} mm is wider than the ${fmt(profile.slotOpening)} slot opening and will cut into the lips.`)

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
      tools: [
        ...tappingTools(profile),
        `Ø${opts.wrenchHoleDiameter} mm drill bit`,
        `${head.hexKey} mm hex key, long arm (to reach through the wrench holes)`,
        'Centre punch',
        ...BASE_TOOLS,
      ],
      warnings,
      notes: [],
    }
  },

  steps(frame: Frame, groups: CutGroup[]): string[] {
    const { profile } = frame
    const opts = frame.design.jointOptions.blind
    const fmt = fmtFor(frame)
    const drilled = groups.filter((g) => g.holes.length > 0)
    const holeCount = drilled.reduce((n, g) => n + g.qty * g.holes.length, 0)
    const size = `M${profile.endTap.nominal}`
    return [
      cutStep(groups),
      tapStep(frame, groups, opts.tapDepth)!,
      `Drill wrench holes in ${groupList(drilled.map((g) => g.label))}: at each end, centre-punch the middle of the slot ${fmt(profile.size / 2)} from the end on both outer faces (faces 1 and 2, adjacent), then drill Ø${opts.wrenchHoleDiameter} mm through the slot floor and core until you break into the opposite slot. ${holeCount} holes. Drill both ends on the same two faces.`,
      `Thread an ${size}×${opts.screwLength} ${opts.headType} into every tapped end, leaving about ${fmt(standoffOf(profile.slotLipThickness))} of shank between the head and the end of the extrusion.`,
      ...faceAssemblySteps(frame, 'Slide each screw head into the slot end of the upright-side member, flush with its end, and snug through the wrench hole.'),
      squareStep(frame, 'fully tighten every screw through its wrench hole'),
    ]
  },
}
