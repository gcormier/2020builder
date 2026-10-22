import type { Frame } from '../frameContext'
import { axisIndex, face, others } from '../geometry'
import type { Axis, CutGroup, Joint, MemberOp, Vec3 } from '../types'
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

export const throughBoltJoint: JointMethod = {
  id: 'through',
  name: 'Through-bolt (end tap + bolt through the owner)',
  description:
    'Bolt goes in from the outside, straight through the owner member, into the end tap of the butting member. Simple and strong; bolt heads stand proud of the outside.',
  ownership: 'owner',

  apply(frame: Frame): JointResult {
    const { profile, ext } = frame
    const opts = frame.design.jointOptions.through
    const P = profile.size
    const d = profile.endTap.nominal
    const size = `M${d}`
    const head = headSpec(d, opts.headType)
    const joints: Joint[] = []
    const ops: MemberOp[] = []

    for (const j of buttJoints(frame)) {
      const { O, B, T, owner, butting, sO, sB } = j
      ops.push({ kind: 'tap', memberId: butting.id, end: sB, tap: { thread: profile.endTap.thread, drill: profile.endTap.drill, depth: opts.tapDepth } })
      const holeFace = face(B, sB)
      ops.push({
        kind: 'hole',
        memberId: owner.id,
        hole: {
          end: sO,
          offset: P / 2,
          face: holeFace,
          faceRole: owner.outerFaces[0] === holeFace ? 1 : 2,
          diameter: opts.clearanceHole,
          note: 'bolt clearance — drill straight through both walls',
        },
      })
      const c: Vec3 = [0, 0, 0]
      c[axisIndex(O)] = j.at(O, P / 2)
      c[axisIndex(T)] = j.at(T, P / 2)
      c[axisIndex(B)] = j.at(B, -head.height / 2)
      joints.push({
        id: `${j.node.id}-${B}`,
        nodeId: j.node.id,
        owner: owner.id,
        ownerEnd: sO,
        butting: butting.id,
        buttingEnd: sB,
        method: 'through',
        fasteners: [
          { kind: opts.headType, size, diameter: d, length: opts.screwLength, headDiameter: head.diameter, headHeight: head.height, headCenter: c, dir: face(B, sB === 0 ? 1 : 0) },
        ],
        connectors: [],
      })
    }

    const fmt = fmtFor(frame)
    const warnings = engagementWarnings(frame, size, opts.screwLength, P, 'through the owner', opts.tapDepth)
    if (opts.clearanceHole < d) warnings.push(`Clearance hole Ø${opts.clearanceHole} mm is smaller than the ${size} bolt.`)
    if (opts.clearanceHole > profile.slotOpening)
      warnings.push(`Clearance hole Ø${opts.clearanceHole} mm is wider than the ${fmt(profile.slotOpening)} slot opening — the drill will cut the lips.`)

    const O = frame.nodes[0].owner!
    const grow = (a: Axis) => (others(O).includes(a) ? 2 * head.height : 0)
    const env = { w: ext.w + grow('x'), d: ext.d + grow('y'), h: ext.h + grow('z') }

    return {
      joints,
      ops,
      hardware: [{ key: `${size}x${opts.screwLength}-${opts.headType}`, category: 'fastener', description: `${size}×${opts.screwLength} ${HEAD_LABELS[opts.headType]}`, qty: joints.length }],
      tools: [...tappingTools(profile), `Ø${opts.clearanceHole} mm drill bit (drill press recommended)`, `${head.hexKey} mm hex key`, 'Centre punch', ...BASE_TOOLS],
      warnings,
      notes: [
        `Bolt heads stand ${fmt(head.height)} proud of the outside at ${joints.length} places, so the overall envelope is ${fmt(env.w)} × ${fmt(env.d)} × ${fmt(env.h)}.`,
      ],
    }
  },

  steps(frame: Frame, groups: CutGroup[]): string[] {
    const { profile } = frame
    const opts = frame.design.jointOptions.through
    const fmt = fmtFor(frame)
    const drilled = groups.filter((g) => g.holes.length > 0)
    const holeCount = drilled.reduce((n, g) => n + g.qty * g.holes.length, 0)
    return [
      cutStep(groups),
      tapStep(frame, groups, opts.tapDepth)!,
      `Drill bolt holes in ${groupList(drilled.map((g) => g.label))}: at each end, centre-punch the middle of the slot ${fmt(profile.size / 2)} from the end on both outer faces (faces 1 and 2), then drill Ø${opts.clearanceHole} mm straight through and out the opposite face. ${holeCount} holes. Keep the drill square — a drill press makes this easy.`,
      ...faceAssemblySteps(frame, `Push an M${profile.endTap.nominal}×${opts.screwLength} ${opts.headType} in from the outside through each bolt hole and into the butting end tap.`),
      squareStep(frame, 'fully tighten every bolt'),
    ]
  },
}
