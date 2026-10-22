import { dimOf } from '../frame'
import type { Frame } from '../frameContext'
import { AXES, axisIndex, face, others } from '../geometry'
import type { Axis, Connector, CutGroup, Joint, MemberOp, Vec3 } from '../types'
import type { JointMethod, JointResult } from './types'
import { BASE_TOOLS, HEAD_LABELS, cutStep, engagementWarnings, fmtFor, headSpec, labelsFor, plural, squareStep, tapStep, tappingTools } from './common'

export const cubeJoint: JointMethod = {
  id: 'cube',
  name: '3-way corner cube',
  description:
    'A 20 mm cube at every corner (printed or cast) with three counterbored holes; every member is tapped at both ends and screwed in from the outside of the cube. Symmetric — no member runs through.',
  ownership: 'cube',

  apply(frame: Frame): JointResult {
    const { profile, ext } = frame
    const opts = frame.design.jointOptions.cube
    const C = profile.size
    const d = profile.endTap.nominal
    const size = `M${d}`
    const head = headSpec(d, opts.headType)
    const joints: Joint[] = []
    const ops: MemberOp[] = []

    for (const node of frame.nodes) {
      const side = (a: Axis) => node.corner[axisIndex(a)]
      const at = (a: Axis, inset: number) => (side(a) === 0 ? inset : dimOf(ext, a) - inset)
      const cube: Connector = {
        kind: 'cube',
        color: '#6b7280',
        boxes: [{ min: AXES.map((a) => Math.min(at(a, 0), at(a, C))) as Vec3, max: AXES.map((a) => Math.max(at(a, 0), at(a, C))) as Vec3 }],
      }
      for (const k of AXES) {
        const member = frame.member(node.members[k])
        const end = side(k)
        ops.push({ kind: 'tap', memberId: member.id, end, tap: { thread: profile.endTap.thread, drill: profile.endTap.drill, depth: opts.tapDepth } })
        const c: Vec3 = [0, 0, 0]
        c[axisIndex(k)] = at(k, C - opts.wall - head.height / 2)
        for (const a of others(k)) c[axisIndex(a)] = at(a, C / 2)
        joints.push({
          id: `${node.id}-${k}`,
          nodeId: node.id,
          owner: `cube-${node.id}`,
          ownerEnd: 0,
          butting: member.id,
          buttingEnd: end,
          method: 'cube',
          fasteners: [
            { kind: opts.headType, size, diameter: d, length: opts.screwLength, headDiameter: head.diameter, headHeight: head.height, headCenter: c, dir: face(k, end === 0 ? 1 : 0) },
          ],
          connectors: k === 'x' ? [cube] : [],
        })
      }
    }

    const warnings = engagementWarnings(frame, size, opts.screwLength, opts.wall, 'cube wall', opts.tapDepth)
    if (opts.wall >= C / 2) warnings.push(`A ${fmtFor(frame)(opts.wall)} cube wall leaves no room for the three counterbores to meet — check your cube.`)

    return {
      joints,
      ops,
      hardware: [
        { key: 'cube-3way', category: 'connector', description: `3-way corner cube, ${C} mm, three ${size} counterbored holes`, qty: frame.nodes.length },
        { key: `${size}x${opts.screwLength}-${opts.headType}`, category: 'fastener', description: `${size}×${opts.screwLength} ${HEAD_LABELS[opts.headType]}`, qty: joints.length },
      ],
      tools: [...tappingTools(profile), `${head.hexKey} mm hex key`, ...BASE_TOOLS],
      warnings,
      notes: [],
    }
  },

  steps(frame: Frame, groups: CutGroup[]): string[] {
    const { profile } = frame
    const opts = frame.design.jointOptions.cube
    const screw = `M${profile.endTap.nominal}×${opts.screwLength} ${opts.headType}`
    return [
      cutStep(groups),
      tapStep(frame, groups, opts.tapDepth)!,
      `Build the bottom frame: four cubes, two ${plural('x')} (${labelsFor(frame, 'x')}) and two ${plural('y')} (${labelsFor(frame, 'y')}). Screw a ${screw} through each cube into the rail's end tap. Snug only.`,
      `Stand the four ${plural('z')} (${labelsFor(frame, 'z')}) in the bottom cubes and screw them in from underneath.`,
      'Build the top frame the same way, set it on the uprights and screw down through the top cubes.',
      squareStep(frame, 'fully tighten all cube screws'),
    ]
  },
}
